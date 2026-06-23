import { useState } from 'react';

export function ManualOverride({ chatId, chatName }: { chatId: string, chatName?: string }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const sendOverride = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await fetch('http://localhost:4000/api/manual-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message })
      });
      setMessage('');
    } catch (e) {
      console.error(e);
      alert('Falha ao enviar modo deus.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(255, 0, 255, 0.1)', border: '1px solid var(--neon-pink)', borderRadius: '5px' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--neon-pink)', marginBottom: '5px', textTransform: 'uppercase', fontWeight: 'bold' }}>⚡ God Mode Override</div>
      <div style={{ display: 'flex', gap: '5px' }}>
        <input 
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendOverride()}
          placeholder={`Forçar resposta para ${chatName || chatId}...`}
          style={{ flex: 1, padding: '8px', background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid var(--neon-pink)' }}
          disabled={sending}
        />
        <button 
          onClick={sendOverride} 
          disabled={sending}
          style={{ padding: '8px 15px', background: 'var(--neon-pink)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
          {sending ? '...' : 'ENVIAR'}
        </button>
      </div>
    </div>
  );
}
