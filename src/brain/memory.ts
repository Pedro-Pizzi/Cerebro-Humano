import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

// Se tivermos um volume montado no Railway (ex: /data), usamos ele para não perder o DB
const DB_DIR = fs.existsSync('/data') ? '/data' : process.cwd();
const DB_PATH = path.join(DB_DIR, 'brain.sqlite');

let db: sqlite3.Database;

export async function initMemory(): Promise<void> {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('[Memory] Erro ao conectar no SQLite:', err);
                return reject(err);
            }
            console.log('[Memory] Banco de dados SQLite conectado.');

            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS contacts (
                        id TEXT PRIMARY KEY,
                        first_name TEXT,
                        pushname TEXT,
                        is_group INTEGER DEFAULT 0,
                        is_allowed INTEGER DEFAULT 0,
                        proactivity_enabled INTEGER DEFAULT 0,
                        last_activity INTEGER
                    )
                `);

                // Migrations seguras caso a tabela já exista com a estrutura antiga
                db.run(`ALTER TABLE contacts ADD COLUMN pushname TEXT`, () => {});
                db.run(`ALTER TABLE contacts ADD COLUMN is_group INTEGER DEFAULT 0`, () => {});
                db.run(`ALTER TABLE contacts ADD COLUMN is_allowed INTEGER DEFAULT 0`, () => {});
                db.run(`ALTER TABLE contacts ADD COLUMN proactivity_enabled INTEGER DEFAULT 0`, () => {});

                db.run(`
                    CREATE TABLE IF NOT EXISTS messages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        chat_id TEXT NOT NULL,
                        sender_id TEXT NOT NULL,
                        sender_name TEXT,
                        is_group INTEGER NOT NULL,
                        body TEXT NOT NULL,
                        type TEXT NOT NULL,
                        created_at INTEGER NOT NULL
                    )
                `);
                
                db.run(`CREATE INDEX IF NOT EXISTS idx_chat_id ON messages (chat_id)`);
                
                db.run(`
                    CREATE TABLE IF NOT EXISTS persona (
                        id INTEGER PRIMARY KEY CHECK (id = 1),
                        content TEXT NOT NULL
                    )
                `);

                db.run(`
                    CREATE TABLE IF NOT EXISTS knowledge_base (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        fact TEXT NOT NULL,
                        created_at INTEGER NOT NULL
                    )
                `);

                db.run(`
                    CREATE TABLE IF NOT EXISTS chat_profiles (
                        chat_id TEXT PRIMARY KEY,
                        style_description TEXT NOT NULL,
                        last_updated INTEGER NOT NULL
                    )
                `);

                db.run(`
                    CREATE TABLE IF NOT EXISTS calendar_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        title TEXT NOT NULL,
                        date_str TEXT NOT NULL,
                        created_at INTEGER NOT NULL
                    )
                `);

                db.run(`
                    CREATE TABLE IF NOT EXISTS settings (
                        id INTEGER PRIMARY KEY CHECK (id = 1),
                        allowed_numbers TEXT NOT NULL DEFAULT '',
                        allowed_groups TEXT NOT NULL DEFAULT '',
                        proactivity_enabled INTEGER NOT NULL DEFAULT 1
                    )
                `);
                
                // Ensure default row exists
                db.run(`INSERT OR IGNORE INTO settings (id, allowed_numbers, allowed_groups, proactivity_enabled) VALUES (1, '', '', 1)`);

                // Migration: fix contacts incorrectly saved as groups (sender bug pre-fix)
                // Only @g.us IDs are real groups; @lid/@c.us/@newsletter are individuals
                db.run(`UPDATE contacts SET is_group = 0 WHERE id NOT LIKE '%@g.us' AND is_group = 1`, (err) => {
                    if (err) {
                        console.error('[Memory] Migration error:', err.message);
                    }
                });

                resolve();
            });
        });
    });
}

export function saveContact(
    id: string, 
    firstName: string, 
    pushname?: string, 
    isGroup: boolean = false
): Promise<void> {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO contacts (id, first_name, pushname, is_group, last_activity) 
            VALUES (?, ?, ?, ?, ?) 
            ON CONFLICT(id) DO UPDATE SET 
                first_name = excluded.first_name,
                pushname = excluded.pushname,
                is_group = excluded.is_group,
                last_activity = excluded.last_activity
        `);
        stmt.run([id, firstName, pushname || null, isGroup ? 1 : 0, Date.now()], (err) => {
            if (err) reject(err);
            else resolve();
        });
        stmt.finalize();
    });
}

export function updateContactPermissions(id: string, isAllowed: boolean, proactivityEnabled: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`UPDATE contacts SET is_allowed = ?, proactivity_enabled = ? WHERE id = ?`);
        stmt.run([isAllowed ? 1 : 0, proactivityEnabled ? 1 : 0, id], (err) => {
            if (err) reject(err);
            else resolve();
        });
        stmt.finalize();
    });
}

export function saveMessage(
    chatId: string, 
    senderId: string, 
    senderName: string | undefined, 
    isGroup: boolean, 
    body: string, 
    type: 'incoming' | 'outgoing'
): Promise<void> {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO messages (chat_id, sender_id, sender_name, is_group, body, type, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([chatId, senderId, senderName || null, isGroup ? 1 : 0, body, type, Date.now()], (err) => {
            if (err) reject(err);
            else resolve();
        });
        stmt.finalize();
    });
}

export function getRecentMessages(chatId: string, limit: number = 40): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?`,
            [chatId, limit],
            (err, rows: any[]) => {
                if (err) return reject(err);
                
                const formatted = rows.reverse().map(row => {
                    if (row.type === 'outgoing') {
                        return `Pedro: ${row.body}`;
                    } else {
                        const label = row.is_group ? `${row.sender_name}: ${row.body}` : row.body;
                        return `Amigo: ${label}`;
                    }
                });
                
                resolve(formatted);
            }
        );
    });
}

export function clearMemory(chatId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM messages WHERE chat_id = ?`, [chatId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

export function getLastResponseTime(chatId: string): Promise<number> {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT created_at FROM messages WHERE chat_id = ? AND type = 'outgoing' ORDER BY created_at DESC LIMIT 1`,
            [chatId],
            (err, row: any) => {
                if (err) reject(err);
                else resolve(row ? row.created_at : 0);
            }
        );
    });
}

export function getPersona(): Promise<string | null> {
    return new Promise((resolve, reject) => {
        db.get(`SELECT content FROM persona WHERE id = 1`, [], (err, row: any) => {
            if (err) reject(err);
            else resolve(row ? row.content : null);
        });
    });
}

export function updatePersona(content: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO persona (id, content) VALUES (1, ?)
            ON CONFLICT(id) DO UPDATE SET content = excluded.content
        `);
        stmt.run([content], (err) => {
            if (err) reject(err);
            else resolve();
        });
        stmt.finalize();
    });
}

export function getKnowledgeBase(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(`SELECT fact FROM knowledge_base ORDER BY created_at DESC`, [], (err, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows.map(r => r.fact));
        });
    });
}

export function addKnowledge(fact: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`INSERT INTO knowledge_base (fact, created_at) VALUES (?, ?)`);
        stmt.run([fact, Date.now()], (err) => {
            if (err) reject(err);
            else resolve();
        });
        stmt.finalize();
    });
}

export function getContactsList(): Promise<any[]> {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM contacts ORDER BY last_activity DESC`, [], (err, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

export function getAllAllowedContactsIds(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id FROM contacts WHERE is_allowed = 1`, [], (err, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows.map(r => r.id));
        });
    });
}

export function getAllProactiveContactsIds(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id FROM contacts WHERE proactivity_enabled = 1 AND is_allowed = 1 AND is_group = 0`, [], (err, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows.map(r => r.id));
        });
    });
}

export function getChatProfile(chatId: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
        db.get(`SELECT style_description FROM chat_profiles WHERE chat_id = ?`, [chatId], (err, row: any) => {
            if (err) reject(err);
            else resolve(row ? row.style_description : null);
        });
    });
}

export function updateChatProfile(chatId: string, styleDescription: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO chat_profiles (chat_id, style_description, last_updated) VALUES (?, ?, ?)
            ON CONFLICT(chat_id) DO UPDATE SET style_description = excluded.style_description, last_updated = excluded.last_updated
        `);
        stmt.run([chatId, styleDescription, Date.now()], (err) => {
            if (err) reject(err);
            else resolve();
        });
        stmt.finalize();
    });
}

export function getAllChatProfiles(): Promise<any[]> {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT c.chat_id, c.style_description, c.last_updated, p.first_name, p.pushname
            FROM chat_profiles c
            LEFT JOIN contacts p ON c.chat_id = p.chat_id
            ORDER BY c.last_updated DESC
        `, [], (err, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

export function addCalendarEvent(title: string, dateStr: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`INSERT INTO calendar_events (title, date_str, created_at) VALUES (?, ?, ?)`);
        stmt.run([title, dateStr, Date.now()], (err) => {
            if (err) reject(err);
            else resolve();
        });
        stmt.finalize();
    });
}

export function getCalendarEvents(): Promise<any[]> {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM calendar_events ORDER BY date_str ASC`, [], (err, rows: any[]) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

export type Settings = {
    allowed_numbers: string;
    allowed_groups: string;
    proactivity_enabled: boolean;
};

export function getSettings(): Promise<Settings> {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM settings WHERE id = 1`, [], (err, row: any) => {
            if (err) {
                reject(err);
            } else if (row) {
                resolve({
                    allowed_numbers: row.allowed_numbers,
                    allowed_groups: row.allowed_groups,
                    proactivity_enabled: row.proactivity_enabled === 1
                });
            } else {
                resolve({ allowed_numbers: '', allowed_groups: '', proactivity_enabled: true });
            }
        });
    });
}

export function updateSettings(settings: Partial<Settings>): Promise<void> {
    return new Promise(async (resolve, reject) => {
        try {
            const current = await getSettings();
            const allowed_numbers = settings.allowed_numbers !== undefined ? settings.allowed_numbers : current.allowed_numbers;
            const allowed_groups = settings.allowed_groups !== undefined ? settings.allowed_groups : current.allowed_groups;
            const proactivity_enabled = settings.proactivity_enabled !== undefined ? (settings.proactivity_enabled ? 1 : 0) : (current.proactivity_enabled ? 1 : 0);

            const stmt = db.prepare(`
                INSERT INTO settings (id, allowed_numbers, allowed_groups, proactivity_enabled) 
                VALUES (1, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET 
                    allowed_numbers = excluded.allowed_numbers,
                    allowed_groups = excluded.allowed_groups,
                    proactivity_enabled = excluded.proactivity_enabled
            `);
            stmt.run([allowed_numbers, allowed_groups, proactivity_enabled], (err) => {
                if (err) reject(err);
                else resolve();
            });
            stmt.finalize();
        } catch(e) {
            reject(e);
        }
    });
}
