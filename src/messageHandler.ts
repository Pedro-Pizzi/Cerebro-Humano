import { Message, Client } from 'whatsapp-web.js';
import { generateResponse } from './ai';
import { saveContact, saveMessage, getRecentMessages, clearMemory, getLastResponseTime } from './brain/memory';
import { io } from './server';
import { extractAndSaveProfile } from './ai/profiler';

export let whatsappClient: Client | null = null;
import { transcribeAudio, describeImage } from './ai/multimodal';
import { getSettings, getAllAllowedContactsIds } from './brain/memory';
export function setWhatsappClient(client: Client) {
    whatsappClient = client;
}

export async function sendManualMessage(chatId: string, message: string) {
    if (!whatsappClient) throw new Error("Client do WhatsApp não está pronto.");
    await whatsappClient.sendMessage(chatId, message);
    await saveMessage(chatId, 'bot', 'Pedro (Manual)', false, message, 'outgoing');
    if (io) {
        io.emit('message_sent', { chatId, body: message });
    }
}

type ChatLike = Awaited<ReturnType<Message['getChat']>>;

type ContactMeta = {
    firstName?: string;
    lastActivity: number;
};

type PendingMessage = {
    body: string;
    senderId: string;
    senderName: string;
    isGroup: boolean;
};

type PendingBatch = {
    chat: ChatLike;
    chatId: string;
    chatName?: string;
    isGroup: boolean;
    messages: PendingMessage[];
    replyTo: Message;
    timer: NodeJS.Timeout;
};

const contactMeta: Record<string, ContactMeta> = {};
const pendingBatches: Record<string, PendingBatch> = {};

const MAX_HISTORY_ITEMS = 40;
const PRIVATE_REPLY_DELAY_MS = readNumberEnv('PRIVATE_REPLY_DELAY_MS', 4500);
const GROUP_REPLY_DELAY_MS = readNumberEnv('GROUP_REPLY_DELAY_MS', 9000);
const GROUP_MIN_RESPONSE_GAP_MS = readNumberEnv('GROUP_MIN_RESPONSE_GAP_MS', 45000);

const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'ptt', 'sticker', 'document']);
const MEDIA_PLACEHOLDERS = new Set(['foto', 'video', 'audio', 'sticker', 'figurinha', 'imagem']);

function readNumberEnv(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
}



function normalizeText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

async function extractTextBody(msg: Message): Promise<string | null> {
    const body = (msg.body || '').trim();
    
    if (msg.hasMedia) {
        try {
            const media = await msg.downloadMedia();
            if (media && media.mimetype) {
                if (media.mimetype.startsWith('audio/')) {
                    const audioBuffer = Buffer.from(media.data, 'base64');
                    const transcription = await transcribeAudio(audioBuffer, media.mimetype);
                    if (transcription) {
                        return `[ÁUDIO TRANSCRITO]: "${transcription}"`;
                    }
                } else if (media.mimetype.startsWith('image/')) {
                    const description = await describeImage(media.data, media.mimetype);
                    if (description) {
                        const caption = body ? ` Com legenda: "${body}"` : '';
                        return `[IMAGEM ENVIADA] A inteligência visual descreve: ${description}${caption}`;
                    }
                }
            }
        } catch (err) {
            console.error('[Mídia] Erro ao baixar ou processar mídia:', err);
        }
    }

    if (!body) return null;

    const normalized = normalizeText(body);
    if (MEDIA_PLACEHOLDERS.has(normalized)) return null;
    if (MEDIA_TYPES.has(msg.type) && MEDIA_PLACEHOLDERS.has(normalized)) return null;

    return body.replace(/[ \t]+/g, ' ');
}

function displayNameFrom(value?: string): string | undefined {
    const clean = value?.trim();
    if (!clean) return undefined;
    // Return full name, not just first word — "Ana Rita" stays "Ana Rita"
    return clean;
}

async function getSenderInfo(msg: Message, isGroup: boolean): Promise<{ senderId: string; senderName: string; numberOnly: string }> {
    const senderId = isGroup ? (msg.author || msg.from) : msg.from;
    const numberOnly = senderId.split('@')[0];
    const cached = contactMeta[senderId]?.firstName;

    if (cached) {
        contactMeta[senderId].lastActivity = Date.now();
        saveContact(senderId, cached, undefined, isGroup).catch(() => {});
        return { senderId, senderName: cached, numberOnly };
    }

    let displayName = numberOnly;
    let pushname: string | undefined = undefined;
    try {
        const contact = await msg.getContact();
        const contactAny = contact as any;
        pushname = contactAny.pushname;
        // Use full display name — not truncated to first word
        displayName = displayNameFrom(pushname || contact.name || contact.shortName || contact.number) || numberOnly;
    } catch {
        // fall back to number
    }

    contactMeta[senderId] = {
        firstName: displayName,
        lastActivity: Date.now(),
    };

    saveContact(senderId, displayName, pushname, isGroup).catch(() => {});
    return { senderId, senderName: displayName, numberOnly };
}

function shouldStartGroupReply(body: string): { shouldRespond: boolean; directMention: boolean } {
    const normalized = normalizeText(body);
    const directMention = /\b(pedro|pizzi)\b/.test(normalized);
    const gameInvite = /\b(pro\s*clubs?|clubes|quem vai|bora|vamo|partiu|jogar|jogo|entra|entrar)\b/.test(normalized);
    const broadQuestion = body.includes('?') && /\b(quem|alguem|vai|bora|joga|entra)\b/.test(normalized);

    return {
        shouldRespond: directMention || gameInvite || broadQuestion,
        directMention,
    };
}

async function canRespondInGroup(chatId: string, directMention: boolean): Promise<boolean> {
    if (directMention) return true;
    const lastResponseAt = await getLastResponseTime(chatId).catch(() => 0);
    return Date.now() - lastResponseAt >= GROUP_MIN_RESPONSE_GAP_MS;
}

function formatBatchForAi(batch: PendingBatch): string {
    if (!batch.isGroup) {
        return batch.messages.map(msg => msg.body).join('\n');
    }
    return batch.messages
        .map(msg => `${msg.senderName}: ${msg.body}`)
        .join('\n');
}

function queueReply(chatId: string, chat: ChatLike, msg: Message, item: PendingMessage, chatName?: string) {
    const existing = pendingBatches[chatId];
    if (existing) {
        clearTimeout(existing.timer);
        existing.messages.push(item);
        existing.replyTo = msg;
        existing.timer = setTimeout(() => void flushPendingBatch(chatId), item.isGroup ? GROUP_REPLY_DELAY_MS : PRIVATE_REPLY_DELAY_MS);
        return;
    }

    pendingBatches[chatId] = {
        chat,
        chatId,
        chatName,
        isGroup: item.isGroup,
        messages: [item],
        replyTo: msg,
        timer: setTimeout(() => void flushPendingBatch(chatId), item.isGroup ? GROUP_REPLY_DELAY_MS : PRIVATE_REPLY_DELAY_MS),
    };
    
    if (io) {
        io.emit('thinking_start', { chatId, chatName, isGroup: item.isGroup });
    }
}

async function flushPendingBatch(chatId: string) {
    const batch = pendingBatches[chatId];
    if (!batch) return;
    delete pendingBatches[chatId];

    const startTime = Date.now();
    const currentBlock = formatBatchForAi(batch);
    console.log(`[Bloco] ${batch.messages.length} mensagem(ns): ${currentBlock.replace(/\n/g, ' | ')}`);

    try {
        // sendStateTyping was removed in newer whatsapp-web.js versions
        try { await batch.chat.sendStateTyping(); } catch { /* non-critical */ }

        const history = await getRecentMessages(chatId, MAX_HISTORY_ITEMS);
        const aiResponse = await generateResponse(history, currentBlock, {
            isGroup: batch.isGroup,
            chatName: batch.chatName,
        });

        for (const item of batch.messages) {
            await saveMessage(chatId, item.senderId, item.senderName, item.isGroup, item.body, 'incoming');
        }

        const elapsed = Date.now() - startTime;
        console.log(`[Resposta em ${elapsed}ms]`);

        if (!aiResponse) {
            console.log('[Silencio] IA decidiu nao responder.');
            if (io) {
                io.emit('thinking_end', { chatId, response: null });
            }
            return;
        }

        await batch.replyTo.reply(aiResponse);
        await saveMessage(chatId, 'bot', 'Pedro', batch.isGroup, aiResponse, 'outgoing');
        
        if (io) {
            io.emit('thinking_end', { chatId, response: aiResponse });
            io.emit('message_sent', { chatId, body: aiResponse });
        }
    } catch (error) {
        console.error('[Erro] Falha ao processar bloco:', error);

        for (const item of batch.messages) {
            await saveMessage(chatId, item.senderId, item.senderName, item.isGroup, item.body, 'incoming');
        }
        if (io) {
            io.emit('thinking_end', { chatId, response: null, error: true });
        }
    }
}

export async function handleIncomingMessage(msg: Message) {
    if (msg.from === 'status@broadcast') return;

    const chat = await msg.getChat();
    const isGroup = chat.isGroup;
    const targetChatId = isGroup ? chat.id._serialized : (msg.fromMe ? msg.to : msg.from);
    const chatName = isGroup ? chat.name : undefined;

    if (msg.fromMe) {
        const textBody = await extractTextBody(msg);
        if (textBody) {
            await saveMessage(targetChatId, 'me', 'Você', isGroup, textBody, 'outgoing');
            if (io) {
                io.emit('message_sent', { chatId: targetChatId, body: textBody });
            }
            if (Math.random() < 0.1) {
                extractAndSaveProfile(targetChatId).catch(console.error);
            }
        }
        return;
    }

    const chatId = msg.from;
    const textBody = await extractTextBody(msg);

    if (!textBody) return;

    // Save the chat (private conversation or group) as a contact
    // so it appears in the dashboard contacts list even before permissions are set
    if (isGroup && chatName) {
        saveContact(chatId, chatName, undefined, true).catch(() => {});
    } else if (!isGroup) {
        // For private chats, the chat IS the contact — sender info saved below
        // But save the chat too in case the sender lookup fails
        const numberOnly = chatId.split('@')[0];
        saveContact(chatId, numberOnly, undefined, false).catch(() => {});
    }

    const allowedIds = await getAllAllowedContactsIds();
    const isAllowed = allowedIds.includes(chatId);

    // Se a lista de permissões tiver ALGUÉM, e este chat não estiver permitido, nós o ignoramos.
    // Se a lista estiver VAZIA (o que significa que ninguém foi permitido), nós permitimos todos,
    // ou talvez seja melhor a política "deny all" por default se o DB já existir?
    // Vamos fazer: se a tabela de allowedIds não contiver este chatId, ignoramos.
    // Mas para manter compatibilidade com antigos setups: se não houver ninguem configurado, libera pra todos.
    if (allowedIds.length > 0 && !isAllowed) {
        return;
    }

    const sender = await getSenderInfo(msg, isGroup);
    const pendingItem: PendingMessage = {
        body: textBody,
        senderId: sender.senderId,
        senderName: sender.senderName,
        isGroup,
    };

    console.log(`[${isGroup ? `${chatName}/${sender.senderName}` : sender.senderName}]: ${textBody}`);
    
    if (io) {
        io.emit('message_received', {
            chatId,
            chatName,
            senderName: sender.senderName,
            isGroup,
            body: textBody,
            timestamp: Date.now()
        });
    }

    if (textBody.trim().toLowerCase() === '/reset') {
        await clearMemory(chatId);
        if (pendingBatches[chatId]) {
            clearTimeout(pendingBatches[chatId].timer);
            delete pendingBatches[chatId];
        }
        await msg.reply("memoria apagada");
        console.log(`[Reset] Memoria de ${chatName || sender.senderName} foi apagada.`);
        return;
    }

    if (isGroup && !pendingBatches[chatId]) {
        const decision = shouldStartGroupReply(textBody);

        if (!decision.shouldRespond || !(await canRespondInGroup(chatId, decision.directMention))) {
            await saveMessage(chatId, pendingItem.senderId, pendingItem.senderName, pendingItem.isGroup, pendingItem.body, 'incoming');
            return;
        }
    }

    queueReply(chatId, chat, msg, pendingItem, chatName);
}

export function cleanupStaleMemory() {
    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000;

    for (const [key, meta] of Object.entries(contactMeta)) {
        if (now - meta.lastActivity > staleThreshold) {
            delete contactMeta[key];
        }
    }
}
