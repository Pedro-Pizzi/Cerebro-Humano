import { ManualOverride } from './ManualOverride';
import type { MessageEvent, ThinkingEvent } from '../App';

type Props = {
  messages: MessageEvent[];
  activeThoughts: Record<string, ThinkingEvent>;
  chatSentiments: Record<string, string>;
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderBody(body: string) {
  if (body.includes('[ÁUDIO TRANSCRITO]')) {
    return (
      <>
        <span className="badge badge-neutral" style={{ marginRight: 'var(--space-2)' }}>Áudio</span>
        {body.replace('[ÁUDIO TRANSCRITO]:', '').trim()}
      </>
    );
  }
  if (body.includes('[IMAGEM ENVIADA]')) {
    return (
      <>
        <span className="badge badge-neutral" style={{ marginRight: 'var(--space-2)' }}>Imagem</span>
        {body.replace('[IMAGEM ENVIADA] A inteligência visual descreve:', '').trim()}
      </>
    );
  }
  return body;
}

function getSentimentEmoji(sentiment: string) {
  const s = sentiment.toLowerCase();
  if (s.includes('raiva') || s.includes('irrit')) return '😡';
  if (s.includes('triste')) return '😢';
  if (s.includes('feliz') || s.includes('eufori')) return '😁';
  if (s.includes('curios')) return '🤔';
  if (s.includes('ironi') || s.includes('sarc')) return '😏';
  return '😐';
}

export function LiveFeed({ messages, activeThoughts, chatSentiments }: Props) {
  const hasActivity = messages.length > 0 || Object.keys(activeThoughts).length > 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Live Feed</h1>
          <p className="page-subtitle">Monitor conversations and AI decisions in real time</p>
        </div>
      </div>

      {!hasActivity ? (
        <div className="empty-state">
          <div className="empty-state-icon">◉</div>
          <div className="empty-state-title">Waiting for activity</div>
          <div className="empty-state-text">
            Messages and AI responses will appear here once the bot starts receiving conversations.
            Make sure the WhatsApp client is connected.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
          {/* Active thoughts */}
          <div>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
              Active thinking
              {Object.keys(activeThoughts).length > 0 && (
                <span className="badge badge-success" style={{ marginLeft: 'var(--space-2)' }}>
                  {Object.keys(activeThoughts).length} processing
                </span>
              )}
            </h2>

            {Object.keys(activeThoughts).length === 0 ? (
              <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                No active processing
              </div>
            ) : (
              Object.values(activeThoughts).map((thought) => {
                const chatName = thought.chatName || thought.chatId;
                const sentiment = chatSentiments[chatName];

                return (
                  <div
                    key={thought.chatId}
                    className={`thought-card${!thought.response && !thought.error ? ' processing' : ''}`}
                  >
                    <div className="thought-header">
                      <span className="thought-target">{chatName}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        {sentiment && (
                          <span title={sentiment} style={{ fontSize: '1rem' }}>
                            {getSentimentEmoji(sentiment)}
                          </span>
                        )}
                        {!thought.response && !thought.error ? (
                          <span className="thought-status">
                            <span className="spinner spinner-sm" />
                            Thinking
                          </span>
                        ) : thought.error ? (
                          <span className="badge badge-error">Error</span>
                        ) : thought.response === null ? (
                          <span className="badge badge-neutral">Silent</span>
                        ) : (
                          <span className="badge badge-success">Replied</span>
                        )}
                      </div>
                    </div>

                    {!thought.response && !thought.error && (
                      <div className="loading-row">
                        <span className="spinner spinner-sm" />
                        Consulting persona &amp; memories...
                      </div>
                    )}

                    {thought.response && (
                      <div className="thought-response sent">
                        {thought.response}
                      </div>
                    )}

                    {thought.response === null && !thought.error && (
                      <div className="thought-response silent">
                        Decided not to respond
                      </div>
                    )}

                    {thought.error && (
                      <div className="thought-response errored">
                        API failure — check server logs
                      </div>
                    )}

                    <ManualOverride chatId={thought.chatId} chatName={thought.chatName} />
                  </div>
                );
              })
            )}
          </div>

          {/* Recent messages */}
          <div>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
              Recent messages
              {messages.length > 0 && (
                <span className="badge badge-neutral" style={{ marginLeft: 'var(--space-2)' }}>
                  {messages.length}
                </span>
              )}
            </h2>

            {messages.length === 0 ? (
              <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                No messages yet
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                <div className="activity-list">
                  {messages.map((msg, i) => (
                    <div key={i} className="activity-item">
                      <div className="avatar">
                        {(msg.senderName || '?')[0].toUpperCase()}
                      </div>
                      <div className="activity-body">
                        <div className="activity-sender">
                          {msg.isGroup && msg.chatName
                            ? `${msg.senderName} · ${msg.chatName}`
                            : msg.senderName}
                        </div>
                        <div className="activity-preview">
                          {renderBody(msg.body)}
                        </div>
                      </div>
                      <span className="activity-time">{formatTime(msg.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
