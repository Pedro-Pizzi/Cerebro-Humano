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

app.get('/api/contacts', async (_req, res) => {
    try {
        const rows = await getContactsList();
        const contacts = rows.map((c: any) => ({
            id: c.id,
            name: c.first_name || c.id,
            pushname: c.pushname || '',
            isGroup: c.is_group === 1,
            isAllowed: c.is_allowed === 1,
            proactivityEnabled: c.proactivity_enabled === 1,
        }));
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

/** Check if the WhatsApp client is fully authenticated and the browser page is available. */
function isClientReady(client: any): boolean {
    if (!client) return false;
    // info.wid is only set after successful authentication
    if (!client.info?.wid) return false;
    // pupPage is the Puppeteer page handle — must exist for evaluate() to work
    if (!client.pupPage || typeof client.pupPage.evaluate !== 'function') return false;
    return true;
}

app.get('/api/whatsapp/contacts', async (_req, res) => {
    try {
        const savedContacts = await getContactsList();

        if (!whatsappClient) {
            console.log("[API] WhatsApp client not initialized yet.");
            // Return DB contacts as fallback
            return res.json({
                contacts: savedContacts.map(c => ({
                    id: c.id,
                    name: c.first_name || c.id,
                    pushname: c.pushname || '',
                    isGroup: c.id.includes('@g.us'),
                    isAllowed: c.is_allowed === 1,
                    proactivityEnabled: c.proactivity_enabled === 1,
                })),
                source: 'database',
            });
        }

        if (!isClientReady(whatsappClient)) {
            console.log("[API] WhatsApp client exists but not fully authenticated — returning DB contacts.");
            return res.json({
                contacts: savedContacts.map(c => ({
                    id: c.id,
                    name: c.first_name || c.id,
                    pushname: c.pushname || '',
                    isGroup: c.id.includes('@g.us'),
                    isAllowed: c.is_allowed === 1,
                    proactivityEnabled: c.proactivity_enabled === 1,
                })),
                source: 'database',
                hint: 'WhatsApp is connecting. Live contacts will appear once authenticated.',
            });
        }

        console.log("[API] Fetching live contacts from WhatsApp...");
        let waContacts: any[];

        if (contactsCache && Date.now() - contactsCacheTime < 120000) {
            // 2-minute cache — contacts don't change that fast
            waContacts = contactsCache;
            console.log(`[API] Using cache: ${waContacts.length} active chats.`);
        } else {
            if (!contactsPromise) {
                const timeoutMs = 30000;

                const fetchPromise = (whatsappClient as any).pupPage.evaluate(() => {
                    const rawContacts = (window as any).Store.Contact.getModelsArray();
                    const results: any[] = [];
                    for (const c of rawContacts) {
                        if (!c.id || !c.id._serialized) continue;
                        if (c.id._serialized === 'status@broadcast') continue;

                        const displayName = c.name || c.pushname || c.verifiedName || c.formattedName || '';
                        if (!displayName && c.id._serialized.includes('@lid')) continue;

                        results.push({
                            id: { _serialized: c.id._serialized },
                            name: displayName || c.id.user,
                            pushname: c.pushname || '',
                            number: c.id.user,
                            isUser: !c.isGroup,
                            isGroup: c.isGroup,
                        });
                    }
                    results.sort((a: any, b: any) => a.name.localeCompare(b.name));
                    return results;
                });

                const timeoutPromise = new Promise<any[]>((_, reject) =>
                    setTimeout(() => reject(new Error("Timeout fetching WhatsApp contacts")), timeoutMs)
                );

                contactsPromise = Promise.race([fetchPromise, timeoutPromise])
                    .then(c => {
                        contactsCache = c;
                        contactsCacheTime = Date.now();
                        contactsPromise = null;
                        return c;
                    })
                    .catch(err => {
                        console.error("[API] WhatsApp contact sync failed:", err.message);
                        contactsPromise = null;
                        contactsCache = null;
                        contactsCacheTime = 0;
                        return [];
                    });
            } else {
                console.log("[API] Waiting for in-progress contact fetch...");
            }
            waContacts = await contactsPromise;
            console.log(`[API] Found ${waContacts.length} active chats.`);
        }

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
            };
        });

        // Merge saved contacts that don't have active chats yet
        for (const saved of savedContacts) {
            if (!list.find(x => x.id === saved.id)) {
                list.push({
                    id: saved.id,
                    name: saved.first_name || saved.id,
                    pushname: saved.pushname || '',
                    isGroup: saved.id.includes('@g.us'),
                    isAllowed: saved.is_allowed === 1,
                    proactivityEnabled: saved.proactivity_enabled === 1,
                });
            }
        }

        res.json({ contacts: list, source: waContacts.length > 0 ? 'whatsapp' : 'database' });
    } catch (err) {
        console.error("[API] Error fetching contacts:", err);
        // Never fail — return DB contacts as ultimate fallback
        try {
            const savedContacts = await getContactsList();
            res.json({
                contacts: savedContacts.map(c => ({
                    id: c.id,
                    name: c.first_name || c.id,
                    pushname: c.pushname || '',
                    isGroup: c.id.includes('@g.us'),
                    isAllowed: c.is_allowed === 1,
                    proactivityEnabled: c.proactivity_enabled === 1,
                })),
                source: 'database',
            });
        } catch {
            res.json({ contacts: [], source: 'none' });
        }
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
