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
// WhatsApp Store.Contact extraction via pupPage.evaluate() is too slow in the Railway
// container (Puppeteer bridge serialization bottleneck) — DB is the reliable source.
app.get('/api/whatsapp/contacts', async (_req, res) => {
    try {
        const savedContacts = await getContactsList();
        res.json({ contacts: mapDbContacts(savedContacts), source: 'database' });
    } catch (err) {
        console.error("[API] Error fetching contacts:", err);
        res.json({ contacts: [], source: 'error' });
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
const dashboardIndex = path.join(dashboardPath, 'index.html');

// Pre-check that dashboard exists
const dashboardBuilt = fs.existsSync(dashboardIndex);
if (dashboardBuilt) {
    console.log(`[Dashboard] Serving static files from ${dashboardPath}`);
    app.use(express.static(dashboardPath, {
        maxAge: '1h',
        immutable: true,
    }));
} else {
    console.warn(`[Dashboard] dist/ not found at ${dashboardPath} — run 'npm run build' in dashboard/ first`);
}

// SPA fallback — only for non-API routes
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
        return next();
    }
    if (!dashboardBuilt) {
        return res.status(503).send('Dashboard not built. Run: cd dashboard && npm run build');
    }
    res.sendFile(dashboardIndex);
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
