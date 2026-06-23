import 'dotenv/config';
import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { handleIncomingMessage, setWhatsappClient } from './messageHandler';
import { prewarmModel } from './ai';
import { initMemory } from './brain/memory';
import { startServer } from './server';
import { startProactivityCron } from './ai/proactivity';
import { setupAuthWatchdog, startReadyWatchdog, startBrowserDiagnostics, startReadyRecovery } from './watchdogs';
import fs from 'fs';

const DB_DIR = fs.existsSync('/data') ? '/data' : process.cwd();

type ClientWithInternals = Client & {
    pupPage?: {
        url: () => string;
        title: () => Promise<string>;
        evaluate: <T>(fn: () => T | Promise<T>) => Promise<T>;
        on: (event: string, listener: (...args: any[]) => void) => void;
    };
    inject?: () => Promise<void>;
};

type RuntimeState = {
    ready: boolean;
};

const CHROME_PATH = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const READY_WATCHDOG_MS = readNumberEnv('READY_WATCHDOG_MS', 60000);
const READY_RETRY_AFTER_AUTH_MS = readNumberEnv('READY_RETRY_AFTER_AUTH_MS', 25000);
const MAX_READY_RECOVERY_ATTEMPTS = readNumberEnv('MAX_READY_RECOVERY_ATTEMPTS', 2);
const HEADLESS = readBooleanEnv('WA_HEADLESS', false);
const USER_AGENT = process.env.WA_USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
const WA_WEB_VERSION = process.env.WA_WEB_VERSION || '2.3000.1041916355-alpha';
const WA_WEB_VERSION_CACHE_URL = process.env.WA_WEB_VERSION_CACHE_URL ||
    'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html';

function readNumberEnv(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
    const value = process.env[name]?.trim().toLowerCase();
    if (!value) return fallback;
    return ['1', 'true', 'yes', 'sim', 's'].includes(value);
}

async function main() {
    console.log('[Init] Inicializando Banco de Dados e Servidor Visual...');
    await initMemory();
    startServer(4000);
    await prewarmModel();
    startProactivityCron();
    const runtimeState: RuntimeState = { ready: false };

    console.log('[Init] Criando cliente WhatsApp...');
    console.log(`[Init] Chrome: ${CHROME_PATH}`);
    console.log(`[Init] Modo browser: ${HEADLESS ? 'headless' : 'visivel'}`);
    console.log(`[Init] WhatsApp Web: ${WA_WEB_VERSION}`);

    const client: ClientWithInternals = new Client({
        authStrategy: new LocalAuth({
            dataPath: DB_DIR
        }),
        authTimeoutMs: 90000,
        takeoverOnConflict: true,
        takeoverTimeoutMs: 5000,
        userAgent: USER_AGENT,
        webVersionCache: {
            type: 'none',
        },
        puppeteer: {
            headless: HEADLESS,
            executablePath: CHROME_PATH,
            defaultViewport: null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--disable-gpu',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--start-maximized',
            ],
        },
    });

    setWhatsappClient(client);
    startReadyWatchdog(client, runtimeState);
    startBrowserDiagnostics(client, runtimeState);
    startReadyRecovery(client, runtimeState);
    setupAuthWatchdog(client);

    client.on('qr', (qr) => {
        console.log('Escaneie este QR Code no seu WhatsApp:');
        qrcode.generate(qr, { small: true });
        
        console.log('\n--- SE O QR CODE ACIMA ESTIVER DISTORCIDO NO LOG, CLIQUE NO LINK ABAIXO ---');
        console.log(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`);
        console.log('---------------------------------------------------------------------------\n');
    });

    client.on('ready', () => {
        runtimeState.ready = true;
        console.log('Robot online e pronto para responder!');
    });

    client.on('message', async (msg) => {
        try {
            await handleIncomingMessage(msg);
        } catch (error) {
            console.error('Erro ao processar mensagem:', error);
        }
    });

    client.on('auth_failure', (msg) => {
        console.error('[Auth] Falha na autenticacao:', msg);
    });

    client.on('loading_screen', (percent, message) => {
        if (runtimeState.ready) return;
        console.log(`[Loading] ${percent}% - ${message}`);
    });

    client.on('change_state', (state) => {
        console.log(`[State] ${state}`);
    });

    client.on('disconnected', (reason) => {
        console.warn('[Disconnected]', reason);
    });

    console.log('[Init] Inicializando browser...');
    await client.initialize();
    console.log('[Init] Cliente inicializado.');
}

main().catch((error) => {
    console.error('[Fatal] Erro ao iniciar:', error);
    process.exit(1);
});
