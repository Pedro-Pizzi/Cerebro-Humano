import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { Server } from 'socket.io';
import cors from 'cors';
import { 
    getRecentMessages, 
    getPersona, 
    updatePersona, 
    getKnowledgeBase, 
    addKnowledge, 
    getContactsList,
    getAllChatProfiles,
    getSettings,
    updateSettings,
    saveContact,
    updateContactPermissions
} from './brain/memory';
import { sendManualMessage, whatsappClient } from './messageHandler';
import { extractAndSaveProfile } from './ai/profiler';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
export const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// APIs
app.get('/api/memory/:chatId', async (req, res) => {
    try {
        const history = await getRecentMessages(req.params.chatId, 100);
        res.json({ history });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

app.get('/api/persona', async (req, res) => {
    try {
        const persona = await getPersona();
        res.json({ persona });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

app.post('/api/persona', async (req, res) => {
    try {
        await updatePersona(req.body.content);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

app.get('/api/contacts', async (req, res) => {
    try {
        const contacts = await getContactsList();
        res.json({ contacts });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

app.get('/api/knowledge', async (req, res) => {
    try {
        const knowledge = await getKnowledgeBase();
        res.json({ knowledge });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

app.post('/api/knowledge', async (req, res) => {
    try {
        await addKnowledge(req.body.fact);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

app.post('/api/manual-message', async (req, res) => {
    try {
        const { chatId, message } = req.body;
        await sendManualMessage(chatId, message);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

app.get('/api/profiles', async (req, res) => {
    try {
        const profiles = await getAllChatProfiles();
        res.json({ profiles });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

app.post('/api/profile/extract', async (req, res) => {
    try {
        const { chatId } = req.body;
        const profile = await extractAndSaveProfile(chatId);
        res.json({ success: true, profile });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

app.get('/api/settings', async (req, res) => {
    try {
        const settings = await getSettings();
        res.json({ settings });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        await updateSettings(req.body);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

let contactsCache: any[] | null = null;
let contactsCacheTime = 0;
let contactsPromise: Promise<any[]> | null = null;

app.get('/api/whatsapp/contacts', async (req, res) => {
    try {
        if (!whatsappClient) {
            console.log("[API] /api/whatsapp/contacts -> WhatsApp offline");
            return res.status(400).json({ error: "WhatsApp offline" });
        }
        
        console.log("[API] Buscando contatos do WhatsApp...");
        let waContacts: any[];

        if (contactsCache && Date.now() - contactsCacheTime < 60000) {
            waContacts = contactsCache;
            console.log(`[API] Usando cache: ${waContacts.length} chats ativos.`);
        } else {
            if (!contactsPromise) {
                const timeoutMs = 30000; // 30 seconds max for dashboard
                
                const fetchPromise = whatsappClient.getChats().then(chats => {
                    return chats.map(chat => ({
                        id: { _serialized: chat.id._serialized },
                        name: chat.name,
                        pushname: '',
                        number: chat.id.user,
                        isUser: !chat.isGroup,
                        isGroup: chat.isGroup
                    }));
                });

                const timeoutPromise = new Promise<any[]>((_, reject) => 
                    setTimeout(() => reject(new Error("Timeout getting chats from WA")), timeoutMs)
                );
                
                contactsPromise = Promise.race([fetchPromise, timeoutPromise])
                    .then(c => {
                        contactsCache = c;
                        contactsCacheTime = Date.now();
                        contactsPromise = null;
                        return c;
                    })
                    .catch(err => {
                        console.error("[API] Aviso: Falha ou Timeout ao buscar do WA. Retornando array vazio para permitir carregamento do Dashboard. Erro:", err.message);
                        contactsPromise = null;
                        return []; // Fallback to empty array
                    });
            } else {
                console.log("[API] Aguardando busca de chats já em andamento...");
            }
            waContacts = await contactsPromise;
            console.log(`[API] Encontrados ${waContacts.length} chats ativos.`);
        }

        const savedContacts = await getContactsList();
        const savedMap = new Map(savedContacts.map(c => [c.id, c]));

        const list = waContacts.filter(c => c.isUser || c.isGroup).map(c => {
            const id = c.id._serialized;
            const saved = savedMap.get(id);
            return {
                id,
                name: c.name || c.pushname || c.number,
                pushname: c.pushname,
                isGroup: c.isGroup,
                isAllowed: saved ? saved.is_allowed === 1 : false,
                proactivityEnabled: saved ? saved.proactivity_enabled === 1 : false,
                profilePic: '' // Can be loaded async if needed later
            };
        });

        // Ensure previously configured contacts appear in the list even if they don't have an active chat
        for (const saved of savedContacts) {
            if (!list.find(x => x.id === saved.id)) {
                list.push({
                    id: saved.id,
                    name: saved.name || saved.id,
                    pushname: '',
                    isGroup: saved.id.includes('@g.us'),
                    isAllowed: saved.is_allowed === 1,
                    proactivityEnabled: saved.proactivity_enabled === 1,
                    profilePic: ''
                });
            }
        }

        res.json({ contacts: list });
    } catch (err) {
        console.error("[API] Erro ao buscar contatos:", err);
        res.status(500).json({ error: String(err) });
    }
});

app.post('/api/contacts/permissions', async (req, res) => {
    try {
        const { id, isAllowed, proactivityEnabled, name, isGroup } = req.body;
        // Salva/Cria o contato se não existir
        await saveContact(id, name || id, undefined, isGroup);
        // Atualiza permissões
        await updateContactPermissions(id, isAllowed, proactivityEnabled);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

// Servir o Frontend (Dashboard) estaticamente se a pasta dist existir
const dashboardPath = path.join(__dirname, '../dashboard/dist');
app.use(express.static(dashboardPath));
app.use((req, res) => {
    res.sendFile(path.join(dashboardPath, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('[Dashboard] Novo cliente conectado:', socket.id);
    socket.on('disconnect', () => {
        console.log('[Dashboard] Cliente desconectado:', socket.id);
    });
});

export function startServer(port = 4000) {
    httpServer.listen(port, () => {
        console.log(`[Dashboard API] Rodando na porta ${port}`);
    });
}
