import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { ControlPanel } from './components/ControlPanel';
import { ManualOverride } from './components/ManualOverride';
import { Metrics } from './components/Metrics';
import './index.css';

// Em produção, a porta é a mesma de onde o front é servido.
const socket = io();

type MessageEvent = {
  chatId: string;
  chatName?: string;
  senderName: string;
  isGroup: boolean;
  body: string;
  timestamp: number;
};

type ThinkingEvent = {
  chatId: string;
  chatName?: string;
  isGroup?: boolean;
  response?: string | null;
  error?: boolean;
};

function App() {
  const [view, setView] = useState<'live' | 'metrics'>('live');
  const [messages, setMessages] = useState<MessageEvent[]>([]);
  const [activeThoughts, setActiveThoughts] = useState<Record<string, ThinkingEvent>>({});
  const [chatSentiments, setChatSentiments] = useState<Record<string, string>>({});

  useEffect(() => {
    socket.on('message_received', (data: MessageEvent) => {
      setMessages((prev) => [data, ...prev].slice(0, 50));
    });

    socket.on('thinking_start', (data: ThinkingEvent) => {
      setActiveThoughts((prev) => ({ ...prev, [data.chatId]: data }));
    });

    socket.on('thinking_end', (data: { chatId: string, response?: string | null, error?: boolean }) => {
      setActiveThoughts((prev) => {
        const next = { ...prev };
        if (next[data.chatId]) {
          next[data.chatId] = { ...next[data.chatId], response: data.response, error: data.error };
        }
        
        // Remove active thought after 3 seconds so the UI clears
        setTimeout(() => {
          setActiveThoughts((current) => {
            const copy = { ...current };
            delete copy[data.chatId];
            return copy;
          });
        }, 3000);
        
        return next;
      });
    });

    socket.on('sentiment_analyzed', (data: { chatId: string, sentiment: string }) => {
      setChatSentiments(prev => ({ ...prev, [data.chatId]: data.sentiment }));
    });

    return () => {
      socket.off('message_received');
      socket.off('thinking_start');
      socket.off('thinking_end');
      socket.off('sentiment_analyzed');
    };
  }, []);

  const renderMessageBody = (body: string) => {
    if (body.includes('[ÁUDIO TRANSCRITO]')) {
      return <span><span style={{ color: 'var(--neon-cyan)', fontWeight: 'bold' }}>🎙️ ÁUDIO:</span> {body.replace('[ÁUDIO TRANSCRITO]:', '')}</span>;
    }
    if (body.includes('[IMAGEM ENVIADA]')) {
      return <span><span style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>👁️ VISÃO:</span> {body.replace('[IMAGEM ENVIADA] A inteligência visual descreve:', '')}</span>;
    }
    return body;
  };

  const getSentimentEmoji = (sentiment: string) => {
    const s = sentiment.toLowerCase();
    if (s.includes('raiva') || s.includes('irrit')) return '😡';
    if (s.includes('triste')) return '😢';
    if (s.includes('feliz') || s.includes('eufori')) return '😁';
    if (s.includes('curios')) return '🤔';
    if (s.includes('ironi') || s.includes('sarc')) return '😏';
    return '😐';
  };

  return (
    <div className="dashboard-container">
      <div className="scanline-overlay"></div>
      
      <header className="header panel">
        <h1 className="glowing-text">O Cérebro <span className="pink">v4.0</span></h1>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setView('live')}
            style={{ padding: '8px 15px', background: view === 'live' ? 'var(--neon-cyan)' : 'transparent', color: view === 'live' ? '#000' : 'var(--neon-cyan)', border: '1px solid var(--neon-cyan)', cursor: 'pointer', fontWeight: 'bold' }}>
            🔴 LIVE FEED
          </button>
          <button 
            onClick={() => setView('metrics')}
            style={{ padding: '8px 15px', background: view === 'metrics' ? 'var(--neon-purple)' : 'transparent', color: view === 'metrics' ? '#000' : 'var(--neon-purple)', border: '1px solid var(--neon-purple)', cursor: 'pointer', fontWeight: 'bold' }}>
            📊 MÉTRICAS
          </button>
        </div>

        <div className="status-indicator">
          <div className="dot pulse"></div>
          <span>Sistema Operacional</span>
        </div>
      </header>

      {view === 'metrics' ? (
        <div className="panel" style={{ flex: 1 }}><Metrics /></div>
      ) : (
      <div className="main-grid">
        <aside className="sidebar-left panel">
          <h2>Fluxo de Memória</h2>
          <div className="message-list">
            {messages.length === 0 ? (
              <p className="dim-text">Aguardando impulsos nervosos...</p>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className="message-item">
                  <div className="message-meta">
                    <span className="sender">{msg.isGroup && msg.chatName ? `${msg.chatName} / ${msg.senderName}` : msg.senderName}</span>
                    <span className="time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="message-body">{renderMessageBody(msg.body)}</div>
                </div>
              ))
            )}
          </div>
        </aside>

        <main className="center-activity panel">
          <h2>Atividade Cerebral Ativa</h2>
          <div className="thoughts-container">
            {Object.keys(activeThoughts).length === 0 ? (
              <div className="idle-state">
                <div className="brain-wireframe pulse">🧠</div>
                <p>Nenhum processamento ativo.</p>
              </div>
            ) : (
              Object.values(activeThoughts).map((thought) => (
                <div key={thought.chatId} className="thought-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="glowing-text cyan">{thought.chatName || thought.chatId}</h3>
                    {chatSentiments[thought.chatName || thought.chatId] && (
                      <span style={{ fontSize: '1.5rem' }} title={chatSentiments[thought.chatName || thought.chatId]}>
                        {getSentimentEmoji(chatSentiments[thought.chatName || thought.chatId])}
                      </span>
                    )}
                  </div>
                  
                  {!thought.response && !thought.error && (
                    <div className="processing">
                      <span className="spinner"></span> Consultando Persona & Memórias...
                    </div>
                  )}

                  {thought.response && (
                    <div className="response success">
                      <strong>Decisão:</strong> {thought.response}
                    </div>
                  )}

                  {thought.response === null && !thought.error && (
                    <div className="response silence">
                      <strong>Decisão:</strong> Manter Silêncio
                    </div>
                  )}

                  {thought.error && (
                    <div className="response error">
                      <strong>Erro:</strong> Falha na sinapse (API).
                    </div>
                  )}

                  <ManualOverride chatId={thought.chatId} chatName={thought.chatName} />
                </div>
              ))
            )}
          </div>
        </main>
        
        <ControlPanel />
      </div>
      )}
    </div>
  );
}

export default App;
