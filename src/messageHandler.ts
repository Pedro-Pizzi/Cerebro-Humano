import { Message, Client } from 'whatsapp-web.js';
import { generateResponse } from './ai';
import { saveContact, saveMessage, getRecentMessages, clearMemory, getLastResponseTime } from './brain/memory';
import { io } from './server';
import { extractAndSaveProfile } from './ai/profiler';

export let whatsappClient: Client | null = null;
import { transcribeAudio, describeImage } from './ai/multimodal';
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

function getAllowedNumbers(): string[] {
    const numbersEnv = process.env.ALLOWED_NUMBERS;
    if (!numbersEnv) return [];
    return numbersEnv.split(',').map(n => n.trim()).filter(Boolean);
}

function getAllowedGroups(): string[] {
    const groupsEnv = process.env.ALLOWED_GROUPS;
    if (!groupsEnv) return [];
    return groupsEnv.split(',').map(n => n.trim()).filter(Boolean);
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

function firstNameFrom(value?: string): string | undefined {
    const clean = value?.trim();
    if (!clean) return undefined;
    return clean.split(/\s+/)[0];
}

async function getSenderInfo(msg: Message, isGroup: boolean): Promise<{ senderId: string; senderName: string; numberOnly: string }> {
    const senderId = isGroup ? (msg.author || msg.from) : msg.from;
    const numberOnly = senderId.split('@')[0];
    const cached = contactMeta[senderId]?.firstName;

    if (cached) {
        contactMeta[senderId].lastActivity = Date.now();
        saveContact(senderId, cached).catch(() => {});
        return { senderId, senderName: cached, numberOnly };
    }

    let firstName = numberOnly;
    try {
        const contact = await msg.getContact();
        const contactAny = contact as any;
        firstName = firstNameFrom(contactAny.pushname || contact.name || contact.shortName || contact.number) || numberOnly;
    } catch {
        // fall back to number
    }

    contactMeta[senderId] = {
        firstName,
        lastActivity: Date.now(),
    };

    saveContact(senderId, firstName).catch(() => {});
    return { senderId, senderName: firstName, numberOnly };
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
        await batch.chat.sendStateTyping();

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

    if (isGroup) {
        const allowedGroups = getAllowedGroups();
        const serializedGroupId = (chat as any).id?._serialized;
        if (allowedGroups.length === 0 || (!allowedGroups.includes(chat.name) && !allowedGroups.includes(serializedGroupId))) {
            return;
        }
    } else {
        const allowedNumbers = getAllowedNumbers();
        const numberOnly = msg.from.split('@')[0];

        if (allowedNumbers.length > 0 && !allowedNumbers.includes(numberOnly)) {
            console.log(`[Bloqueado] Mensagem de numero nao autorizado: ${numberOnly}`);
            return;
        }
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
