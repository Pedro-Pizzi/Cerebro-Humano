import { useState } from 'react';

type Props = {
  chatId: string;
  chatName?: string;
};

export function ManualOverride({ chatId, chatName }: Props) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const sendOverride = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await fetch('/api/manual-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message }),
      });
      setMessage('');
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch (e) {
      console.error(e);
      alert('Failed to send message. Check server connection.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      marginTop: 'var(--space-3)',
      padding: 'var(--space-3)',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
    }}>
      <div style={{
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        marginBottom: 'var(--space-2)',
      }}>
        Send manual message as bot
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <input
          className="input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendOverride()}
          placeholder={`Message to ${chatName || chatId}...`}
          disabled={sending}
          style={{ flex: 1 }}
        />
        <button
          className={`btn ${sent ? 'btn-primary' : 'btn-secondary'}`}
          onClick={sendOverride}
          disabled={sending || !message.trim()}
        >
          {sending ? 'Sending…' : sent ? 'Sent ✓' : 'Send'}
        </button>
      </div>
    </div>
  );
}
