import cron from 'node-cron';
import { getContactsList, getRecentMessages, getAllProactiveContactsIds } from '../brain/memory';
import { sendManualMessage } from '../messageHandler';
import { generateResponse } from '../ai';

// Rodar a cada hora (0 * * * *)
// Para teste, podemos usar '*/15 * * * *' (a cada 15 min)
export function startProactivityCron() {
    console.log('[Proatividade] Cron iniciado.');
    
    cron.schedule('0 * * * *', async () => {
        console.log('[Proatividade] Verificando contatos para puxar assunto...');
        
        try {
            const proactiveIds = await getAllProactiveContactsIds();
            if (proactiveIds.length === 0) {
                console.log('[Proatividade] Rotina desativada ou nenhum contato com proatividade habilitada.');
                return;
            }

            const contacts = await getContactsList();
            const now = Date.now();
            const ONE_DAY = 24 * 60 * 60 * 1000;
            
            // Filtra contatos que conversaram conosco, mas a última atividade foi > 24h atrás
            // E que não são grupos (opcional, melhor focar em DMs para não ser irritante)
            const idleContacts = contacts.filter(c => {
                const elapsed = now - c.last_activity;
                if (elapsed <= ONE_DAY || c.chat_id.includes('@g.us')) return false;

                if (!proactiveIds.includes(c.chat_id)) {
                    return false;
                }

                return true;
            });

            if (idleContacts.length === 0) return;

            // Escolhe um aleatório para mandar mensagem (10% de chance para não parecer bot spammer)
            if (Math.random() > 0.1) return;

            const randomContact = idleContacts[Math.floor(Math.random() * idleContacts.length)];
            const chatId = randomContact.chat_id;
            
            console.log(`[Proatividade] A IA decidiu puxar assunto com ${randomContact.pushname || chatId}.`);
            
            // Gera a mensagem de proatividade
            const history = await getRecentMessages(chatId, 5);
            // Simula uma nova mensagem do nada para a IA saber que deve puxar assunto
            const promptMaluco = "IMPORTANTE: Você está muito tempo sem falar com essa pessoa. Invente uma desculpa, faça uma pergunta boba ou puxe assunto de forma natural. Responda como se você mesmo tivesse tomado a iniciativa de chamar.";
            
            const aiResponse = await generateResponse(history, promptMaluco, {
                chatId,
                chatName: randomContact.pushname || randomContact.first_name || 'Desconhecido',
            });

            if (aiResponse) {
                await sendManualMessage(chatId, aiResponse);
            }
        } catch (err) {
            console.error('[Proatividade] Erro na rotina:', err);
        }
    });
}
