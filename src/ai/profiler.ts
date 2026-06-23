import OpenAI from 'openai';
import { getRecentMessages, getChatProfile, updateChatProfile } from '../brain/memory';
import * as dotenv from 'dotenv';
import { io } from '../server';

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function extractAndSaveProfile(chatId: string): Promise<string | null> {
    try {
        console.log(`[Profiler] Extraindo perfil para: ${chatId}`);
        // Pega as últimas 50 mensagens para ter contexto, focando nas que o usuário mandou
        const messages = await getRecentMessages(chatId, 50);
        
        // Filtramos apenas as mensagens que EU mandei (fromMe = true)
        // Como o BD atual armazena 'bot' para o que a IA mandou,
        // E no celular o usuário manda, precisamos garantir que identificamos quem é o "Humano Original".
        // Vamos considerar 'outgoing' com sender = 'Pedro (Manual)' ou messages que o evento fromMe marcou.
        // Como o banco armazena senderName = 'Você' quando msg.fromMe é true (vamos checar isso no messageHandler)
        const myMessages = messages.filter(m => m.sender === 'Você' || m.senderName === 'Você');
        
        if (myMessages.length < 3) {
            console.log(`[Profiler] Mensagens insuficientes enviadas por mim no chat ${chatId} para extrair perfil.`);
            return null;
        }

        const prompt = `
Aqui estão algumas mensagens recentes enviadas pelo usuário "Pedro" para uma pessoa específica no WhatsApp.
Sua tarefa é analisar o ESTILO DE ESCRITA dele EXCLUSIVAMENTE para essa pessoa.

MENSAGENS DO PEDRO:
${myMessages.map(m => `- ${m.body}`).join('\n')}

Por favor, escreva um parágrafo curto, direto e prático descrevendo exatamente:
- O tom de voz (formal, informal, zoeiro, seco, romântico).
- As gírias mais usadas.
- O tamanho médio das frases e se ele usa pontuação ou emojis.

Este parágrafo será injetado depois no seu próprio System Prompt como instrução para você imitá-lo.
Exemplo de saída: "Ele fala de forma muito informal e curta. Usa gírias como 'mano' e 'tlgd'. Raramente usa pontuação final, e adora o emoji 💀."
`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: prompt }],
            max_tokens: 300,
            temperature: 0.3
        });

        const profileText = response.choices[0].message.content?.trim();
        if (profileText) {
            await updateChatProfile(chatId, profileText);
            console.log(`[Profiler] Perfil atualizado para ${chatId}: ${profileText}`);
            
            if (io) {
                io.emit('profile_updated', { chatId, profileText });
            }
            return profileText;
        }
        return null;
    } catch (err) {
        console.error('[Profiler] Erro ao extrair perfil:', err);
        return null;
    }
}
