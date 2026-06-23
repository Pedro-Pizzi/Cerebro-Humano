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
    if (!client.info?.wid) return false;
    if (!client.pupPage || typeof client.pupPage.evaluate !== 'function') return false;
    return true;
}

function mapDbContacts(rows: any[]) {
    return rows.map(c => ({
        id: c.id,
        name: c.first_name || c.id,
        pushname: c.pushname || '',
        isGroup: c.id.includes('@g.us'),
        isAllowed: c.is_allowed === 1,
        proactivityEnabled: c.proactivity_enabled === 1,
    }));
}

/** Non-blocking background sync from WhatsApp — updates cache for next request. */
function refreshContactsCacheAsync(client: any) {
    if (contactsPromise) return; // already in progress

    const timeoutMs = 60000; // 60s — generous for slow container bridge

    const fetchPromise = client.pupPage.evaluate(() => {
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
        setTimeout(() => reject(new Error("Background sync timed out")), timeoutMs)
    );

    contactsPromise = Promise.race([fetchPromise, timeoutPromise])
        .then(c => {
            contactsCache = c;
            contactsCacheTime = Date.now();
            contactsPromise = null;
            console.log(`[API] Background WhatsApp sync: ${c.length} chats cached.`);
            return c;
        })
        .catch(err => {
            console.error("[API] Background WhatsApp sync failed:", err.message);
            contactsPromise = null;
            // Don't clear existing cache on failure
            return [];
        });
}

app.get('/api/whatsapp/contacts', async (_req, res) => {
    try {
        const savedContacts = await getContactsList();
        const dbContacts = mapDbContacts(savedContacts);

        // If WhatsApp not ready, return DB contacts instantly
        if (!whatsappClient || !isClientReady(whatsappClient)) {
            const reason = !whatsappClient ? 'WhatsApp client not initialized' : 'WhatsApp not fully authenticated';
            console.log(`[API] ${reason} — returning DB contacts.`);
            return res.json({
                contacts: dbContacts,
                source: 'database',
                hint: reason,
            });
        }

        // Return cached contacts if fresh (< 5 min), else DB contacts
        if (contactsCache && Date.now() - contactsCacheTime < 300000) {
            const savedMap = new Map(savedContacts.map(c => [c.id, c]));
            const merged = mergeContacts(contactsCache, savedMap);
            // Trigger background refresh if cache is older than 2 min
            if (Date.now() - contactsCacheTime > 120000 && !contactsPromise) {
                refreshContactsCacheAsync(whatsappClient);
            }
            return res.json({ contacts: merged, source: 'whatsapp-cache' });
        }

        // No fresh cache — return DB contacts now, refresh in background
        if (!contactsPromise) {
            refreshContactsCacheAsync(whatsappClient);
        }

        return res.json({
            contacts: dbContacts,
            source: 'database',
            hint: 'Syncing WhatsApp contacts in background. Refresh in a few seconds.',
        });
    } catch (err) {
        console.error("[API] Error in contacts endpoint:", err);
        try {
            const savedContacts = await getContactsList();
            res.json({ contacts: mapDbContacts(savedContacts), source: 'database' });
        } catch {
            res.json({ contacts: [], source: 'none' });
        }
    }
});

/** Merge WhatsApp contacts with DB permission state. */
function mergeContacts(waContacts: any[], savedMap: Map<string, any>): any[] {
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

    // Add DB-only contacts that don't have active WhatsApp chats
    for (const [id, saved] of savedMap) {
        if (!list.find(x => x.id === id)) {
            list.push({
                id,
                name: saved.first_name || id,
                pushname: saved.pushname || '',
                isGroup: id.includes('@g.us'),
                isAllowed: saved.is_allowed === 1,
                proactivityEnabled: saved.proactivity_enabled === 1,
            });
        }
    }
    return list;
}

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
