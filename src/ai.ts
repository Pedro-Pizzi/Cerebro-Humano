import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { SYSTEM_PROMPT as FALLBACK_PROMPT } from './persona';
import { getPersona, getKnowledgeBase, getChatProfile } from './brain/memory';
import { searchInternet, checkCalendar, addEventToCalendar } from './ai/tools';
import { io } from './server';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey || apiKey === 'sua-chave-aqui') {
    console.error("ERRO: OPENAI_API_KEY nao foi configurada no arquivo .env");
    console.error("Pegue sua chave em: https://platform.openai.com/api-keys");
    process.exit(1);
}

const openai = new OpenAI({ apiKey });
const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';

type GenerateOptions = {
    isGroup?: boolean;
    chatName?: string;
};

const VAGUE_GROUP_ANSWERS = new Set(['to', 'vou', 'sim', 'ss', 's', 'bora', 'ok', 'blz', 'fecho']);

function normalizeForCheck(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z]/g, '');
}

function normalizeLoose(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function repairVagueGroupAnswer(response: string, newMessage: string, options: GenerateOptions): string {
    if (!options.isGroup) return response;

    const responseKey = normalizeForCheck(response);
    if (!VAGUE_GROUP_ANSWERS.has(responseKey)) return response;

    const message = normalizeLoose(newMessage);
    const hasQuestionOrCondition = newMessage.includes('?') || /\b(se eu|so nos|so nois|so voces|rapidao|rapidinho|rapido|agora)\b/.test(message);
    if (!hasQuestionOrCondition) return response;

    const asksAboutOnlyUs = /\bso\s+(nos|nois|voces|2|dois)\b/.test(message);
    const needsFast = /\brapid/.test(message);

    if (asksAboutOnlyUs && needsFast) return 'acho q sim kkk entra ai rapidinho';
    if (needsFast) return 'bora mas tem q ser rapido msm';
    if (asksAboutOnlyUs) return 'acho q sim kkk';

    return responseKey === 'to' ? 'to sim' : response;
}

function cleanResponse(rawResponse: string, newMessage: string, options: GenerateOptions): string | null {
    const cleaned = rawResponse
        .replace(/^Pedro:\s*/i, '')
        .replace(/^Resposta:\s*/i, '')
        .replace(/^R:\s*/i, '')
        .replace(/^"|"$/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (!cleaned) return null;
    if (normalizeForCheck(cleaned) === 'silencio') return null;

    return repairVagueGroupAnswer(cleaned, newMessage, options);
}

function buildCurrentMessage(newMessage: string, options: GenerateOptions): string {
    if (options.isGroup) {
        return `Contexto: voce esta em um grupo de amigos${options.chatName ? ` chamado "${options.chatName}"` : ''}.
O bloco abaixo pode ter varias mensagens seguidas. Responda uma vez so.
Se uma pessoa normal nao responderia nada agora, responda exatamente SILENCIO.

Bloco recebido:
${newMessage}

Resposta do Pedro:`;
    }

    return `Contexto: voce esta no privado do WhatsApp.
O bloco abaixo pode ter uma ou varias mensagens seguidas. Responda uma vez so, no tom natural do Pedro.

Bloco recebido:
${newMessage}

Resposta do Pedro:`;
}

export async function generateResponse(
    history: string[],
    newMessage: string,
    options: GenerateOptions = {},
): Promise<string | null> {
    try {
        const dbPersona = await getPersona();
        const knowledge = await getKnowledgeBase();
        const chatProfile = await getChatProfile(options.chatId || '');
        
        let finalSystem = dbPersona || FALLBACK_PROMPT;
        
        if (chatProfile) {
            finalSystem += `\n\n## AVATAR DIGITAL (MIMETISMO)\nO Pedro conversa com esta pessoa específica do seguinte jeito:\n"${chatProfile}"\nVocê DEVE absorver esse exato estilo e usá-lo na sua resposta para parecer natural.`;
        }

        if (knowledge && knowledge.length > 0) {
            finalSystem += `\n\n## BASE DE CONHECIMENTO\nFatos que você sabe:\n` + knowledge.map(k => `- ${k}`).join('\n');
        }
        
        finalSystem += `\n\n## SENTIMENTO E FORMATO\nVocê DEVE obrigatoriamente responder num formato JSON válido contendo duas chaves:\n1. "sentiment": A emoção predominante que você percebeu na mensagem do amigo (ex: Raiva, Tristeza, Euforia, Neutro, Curiosidade).\n2. "response": A sua resposta em texto puro (ou 'SILENCIO' se for o caso).\nO sistema só entende JSON. NUNCA responda fora do JSON.`;

        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: 'system', content: finalSystem },
        ];

        for (const msg of history.slice(-30)) {
            if (msg.startsWith("Amigo: ")) {
                messages.push({ role: 'user', content: msg.substring(7) });
            } else if (msg.startsWith("Pedro: ")) {
                messages.push({ role: 'assistant', content: msg.substring(7) });
            }
        }

        messages.push({ role: 'user', content: buildCurrentMessage(newMessage, options) });

        let response = await openai.chat.completions.create({
            model: MODEL,
            messages,
            response_format: { type: "json_object" },
            tools: [
                {
                    type: "function",
                    function: {
                        name: "searchInternet",
                        description: "Pesquisa no Google informações em tempo real quando você não sabe de algo.",
                        parameters: {
                            type: "object",
                            properties: {
                                query: { type: "string", description: "Termo a pesquisar no Google" }
                            },
                            required: ["query"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "checkCalendar",
                        description: "Consulta a agenda/calendário do Pedro para ver compromissos e disponibilidade.",
                        parameters: { type: "object", properties: {} }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "addEventToCalendar",
                        description: "Marca um compromisso na agenda do Pedro.",
                        parameters: {
                            type: "object",
                            properties: {
                                title: { type: "string", description: "Título do compromisso (ex: Reunião com João)" },
                                dateStr: { type: "string", description: "Data e horário (ex: Amanhã às 15h, 20/05 às 10h)" }
                            },
                            required: ["title", "dateStr"]
                        }
                    }
                }
            ]
        });

        if (response.choices[0].message.tool_calls) {
            const toolCall = response.choices[0].message.tool_calls[0];
            let toolResult = "";
            
            if (toolCall.function.name === 'searchInternet') {
                const args = JSON.parse(toolCall.function.arguments);
                toolResult = await searchInternet(args.query);
            } else if (toolCall.function.name === 'checkCalendar') {
                toolResult = await checkCalendar();
            } else if (toolCall.function.name === 'addEventToCalendar') {
                const args = JSON.parse(toolCall.function.arguments);
                toolResult = await addEventToCalendar(args.title, args.dateStr);
            }
            
            if (toolResult) {
                messages.push(response.choices[0].message);
                messages.push({
                    role: 'tool',
                    content: toolResult,
                    tool_call_id: toolCall.id
                });
                
                response = await openai.chat.completions.create({
                    model: MODEL,
                    messages,
                    response_format: { type: "json_object" }
                });
            }
        }

        const jsonStr = response.choices[0].message.content?.trim() || '{}';
        let parsed = { response: '', sentiment: 'Neutro' };
        try {
            parsed = JSON.parse(jsonStr);
        } catch (e) {
            console.error('[AI] Erro ao fazer parse do JSON:', jsonStr);
            parsed.response = jsonStr;
        }

        if (io) {
            io.emit('sentiment_analyzed', { chatId: options.chatName || 'privado', sentiment: parsed.sentiment });
        }

        return cleanResponse(parsed.response, newMessage, options);
    } catch (error) {
        console.error("Erro ao chamar OpenAI:", error);
        return null;
    }
}

export async function prewarmModel(): Promise<void> {
    try {
        console.log(`[Pre-warm] Testando acesso ao modelo ${MODEL}...`);
        const response = await openai.chat.completions.create({
            model: MODEL,
            messages: [{ role: 'user', content: 'responda apenas: ok' }],
            max_completion_tokens: 200,
        });
        const content = response.choices[0].message.content?.trim();
        if (content) {
            console.log(`[Pre-warm] ${MODEL} pronto - respondeu "${content}"`);
        } else {
            console.log(`[Pre-warm] ${MODEL} respondeu vazio. Testando com mais tokens...`);
            const retry = await openai.chat.completions.create({
                model: MODEL,
                messages: [{ role: 'user', content: 'digame: funcionando' }],
                max_completion_tokens: 1000,
            });
            console.log(`[Pre-warm] ${MODEL} ok - "${retry.choices[0].message.content?.trim()}"`);
        }
    } catch (error: any) {
        console.error(`[Pre-warm] Falha ao acessar ${MODEL}:`, error.message);
        process.exit(1);
    }
}
