import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { LiveFeed } from './components/LiveFeed';
import { ContactsView } from './components/ContactsView';
import { PersonaView } from './components/PersonaView';
import { KnowledgeView } from './components/KnowledgeView';
import { ProfilesView } from './components/ProfilesView';
import './index.css';

const socket = io();

export type MessageEvent = {
  chatId: string;
  chatName?: string;
  senderName: string;
  isGroup: boolean;
  body: string;
  timestamp: number;
};

export type ThinkingEvent = {
  chatId: string;
  chatName?: string;
  isGroup?: boolean;
  response?: string | null;
  error?: boolean;
};

type View = 'live' | 'contacts' | 'persona' | 'knowledge' | 'profiles';

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: 'live', label: 'Live Feed', icon: '◉' },
  { id: 'contacts', label: 'Contacts', icon: '👥' },
  { id: 'persona', label: 'Persona', icon: '🧠' },
  { id: 'knowledge', label: 'Knowledge', icon: '📖' },
  { id: 'profiles', label: 'Profiles', icon: '🎭' },
];

function App() {
  const [view, setView] = useState<View>('live');
  const [messages, setMessages] = useState<MessageEvent[]>([]);
  const [activeThoughts, setActiveThoughts] = useState<Record<string, ThinkingEvent>>({});
  const [chatSentiments, setChatSentiments] = useState<Record<string, string>>({});
  const [pendingCount, setPendingCount] = useState(0);

  // Clean up thoughts after response
  const scheduleThoughtCleanup = useCallback((chatId: string) => {
    setTimeout(() => {
      setActiveThoughts((current) => {
        const copy = { ...current };
        delete copy[chatId];
        return copy;
      });
      setPendingCount((c) => Math.max(0, c - 1));
    }, 5000);
  }, []);

  useEffect(() => {
    const onMessage = (data: MessageEvent) => {
      setMessages((prev) => [data, ...prev].slice(0, 100));
    };

    const onThinkingStart = (data: ThinkingEvent) => {
      setActiveThoughts((prev) => ({ ...prev, [data.chatId]: data }));
      setPendingCount((c) => c + 1);
    };

    const onThinkingEnd = (data: { chatId: string; response?: string | null; error?: boolean }) => {
      setActiveThoughts((prev) => {
        const next = { ...prev };
        if (next[data.chatId]) {
          next[data.chatId] = { ...next[data.chatId], response: data.response, error: data.error };
        }
        return next;
      });
      scheduleThoughtCleanup(data.chatId);
    };

    const onSentiment = (data: { chatId: string; sentiment: string }) => {
      setChatSentiments((prev) => ({ ...prev, [data.chatId]: data.sentiment }));
    };

    socket.on('message_received', onMessage);
    socket.on('thinking_start', onThinkingStart);
    socket.on('thinking_end', onThinkingEnd);
    socket.on('sentiment_analyzed', onSentiment);

    return () => {
      socket.off('message_received', onMessage);
      socket.off('thinking_start', onThinkingStart);
      socket.off('thinking_end', onThinkingEnd);
      socket.off('sentiment_analyzed', onSentiment);
    };
  }, [scheduleThoughtCleanup]);

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">Cérebro</div>
        </div>

        <div className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item${view === item.id ? ' active' : ''}`}
              onClick={() => setView(item.id)}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
              {item.id === 'live' && pendingCount > 0 && (
                <span className="nav-badge">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-3)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
          }}>
            <span className="status-dot online" />
            Sistema ativo
          </div>
        </div>
      </nav>

      <main className="main-content">
        {view === 'live' && (
          <LiveFeed
            messages={messages}
            activeThoughts={activeThoughts}
            chatSentiments={chatSentiments}
          />
        )}
        {view === 'contacts' && <ContactsView />}
        {view === 'persona' && <PersonaView />}
        {view === 'knowledge' && <KnowledgeView />}
        {view === 'profiles' && <ProfilesView />}
      </main>
    </div>
  );
}

export default App;
