import googleIt from 'google-it';
import { getCalendarEvents, addCalendarEvent } from '../brain/memory';

export async function searchInternet(query: string): Promise<string> {
    try {
        console.log(`[Busca Web] Pesquisando: ${query}`);
        const results = await googleIt({ query, limit: 3, disableConsole: true });
        
        if (!results || results.length === 0) {
            return "Nenhum resultado encontrado.";
        }

        const formatted = results.map((r: any) => `${r.title}\n${r.snippet}`).join('\n\n');
        return formatted;
    } catch (err) {
        console.error('[Busca Web] Erro:', err);
        return "Erro ao buscar na internet.";
    }
}

export async function checkCalendar(): Promise<string> {
    try {
        const events = await getCalendarEvents();
        if (events.length === 0) return "Sua agenda está vazia.";
        return events.map(e => `- ${e.date_str}: ${e.title}`).join('\n');
    } catch {
        return "Erro ao ler a agenda.";
    }
}

export async function addEventToCalendar(title: string, dateStr: string): Promise<string> {
    try {
        await addCalendarEvent(title, dateStr);
        return `Evento "${title}" marcado para ${dateStr} com sucesso.`;
    } catch {
        return "Erro ao salvar na agenda.";
    }
}
