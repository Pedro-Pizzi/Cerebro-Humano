import express from 'express';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
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
app.use(cors({
    origin: [
        'https://dashboard-murex-five-70.vercel.app',
        'https://cerebro-humano-production.up.railway.app',
        /^http:\/\/localhost(:\d+)?$/,
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
}));
app.use(express.json());

const httpServer = createServer(app);
export const io = new Server(httpServer, {
    cors: {
        origin: [
            'https://dashboard-murex-five-70.vercel.app',
            'https://cerebro-humano-production.up.railway.app',
            /^http:\/\/localhost(:\d+)?$/,
        ],
        methods: ['GET', 'POST'],
        credentials: true,
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

function mapDbContacts(rows: any[]) {
    return rows.map(c => ({
        id: c.id,
        name: c.first_name || c.id,
        pushname: c.pushname || '',
        isGroup: c.is_group === 1,
        isAllowed: c.is_allowed === 1,
        proactivityEnabled: c.proactivity_enabled === 1,
    }));
}

// Contacts are populated during message processing via saveContact() in getSenderInfo().
// Use Client.getChats() to sync all WhatsApp conversations (lighter than Store.Contact extraction).
app.get('/api/whatsapp/contacts', async (_req, res) => {
    try {
        const savedContacts = await getContactsList();
        res.json({ contacts: mapDbContacts(savedContacts), source: 'database' });
    } catch (err) {
        console.error("[API] Error fetching contacts:", err);
        res.json({ contacts: [], source: 'error' });
    }
});

// Sync ALL WhatsApp chats into the DB — groups and individual conversations.
// Uses Client.getChats() which is lighter than Store.Contact serialization.
app.post('/api/whatsapp/sync', async (_req, res) => {
    try {
        if (!whatsappClient) {
            return res.status(400).json({ error: 'WhatsApp client not initialized' });
        }

        console.log('[API] Syncing all chats from WhatsApp...');
        const chats = await (whatsappClient as any).getChats();
        console.log(`[API] Fetched ${chats.length} chats from WhatsApp`);

        let saved = 0;
        for (const chat of chats) {
            try {
                const id = chat.id?._serialized || chat.id;
                if (!id || id === 'status@broadcast') continue;
                const name = chat.name || '';
                const isGroup = chat.isGroup || false;
                await saveContact(id, name || id.split('@')[0], undefined, isGroup);
                saved++;
            } catch {
                // skip individual failures
            }
        }

        const contacts = mapDbContacts(await getContactsList());
        res.json({ synced: saved, total: chats.length, contacts, source: 'whatsapp' });
    } catch (err: any) {
        console.error('[API] WhatsApp sync failed:', err.message);
        res.status(500).json({ error: err.message });
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

// ── Dashboard static serving (in-memory cache) ────────────
// Container CPU is limited — cache all dashboard assets in memory at startup
// to eliminate filesystem I/O per request.
const dashboardPath = path.join(__dirname, '../dashboard/dist');
const dashboardIndex = path.join(dashboardPath, 'index.html');
const assetCache = new Map<string, { data: Buffer; contentType: string }>();

function preloadAssets(dir: string, base: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            preloadAssets(full, base);
        } else {
            const urlPath = full.replace(base, '').replace(/\\/g, '/');
            const ext = path.extname(entry.name).toLowerCase();
            const mimeTypes: Record<string, string> = {
                '.html': 'text/html; charset=utf-8',
                '.js': 'application/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8',
                '.svg': 'image/svg+xml',
                '.png': 'image/png',
                '.ico': 'image/x-icon',
                '.json': 'application/json; charset=utf-8',
                '.woff2': 'font/woff2',
            };
            assetCache.set(urlPath, {
                data: fs.readFileSync(full),
                contentType: mimeTypes[ext] || 'application/octet-stream',
            });
        }
    }
}

const dashboardBuilt = fs.existsSync(dashboardIndex);
if (dashboardBuilt) {
    preloadAssets(dashboardPath, dashboardPath);
    console.log(`[Dashboard] ${assetCache.size} assets cached in memory from ${dashboardPath}`);
} else {
    console.warn(`[Dashboard] dist/ not found at ${dashboardPath}`);
}

// Serve cached assets
app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
        return next();
    }

    // Try exact match first
    let asset = assetCache.get(req.path);
    // Fallback: strip leading slash
    if (!asset && req.path.startsWith('/')) {
        asset = assetCache.get(req.path.slice(1));
    }

    if (asset) {
        res.setHeader('Content-Type', asset.contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
        return res.send(asset.data);
    }

    // SPA fallback — serve index.html for client-side routes
    const index = assetCache.get('/index.html') || assetCache.get('index.html');
    if (index) {
        res.setHeader('Content-Type', index.contentType);
        return res.send(index.data);
    }

    next();
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
