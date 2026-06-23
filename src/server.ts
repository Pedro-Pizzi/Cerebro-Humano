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
    getAllChatProfiles 
} from './brain/memory';
import { sendManualMessage } from './messageHandler';
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

// Servir o Frontend (Dashboard) estaticamente se a pasta dist existir
const dashboardPath = path.join(__dirname, '../../dashboard/dist');
app.use(express.static(dashboardPath));
app.get('*', (req, res) => {
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
