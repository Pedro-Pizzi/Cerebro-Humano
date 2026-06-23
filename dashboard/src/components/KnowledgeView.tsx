import { useState, useEffect } from 'react';

export function KnowledgeView() {
  const [facts, setFacts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFact, setNewFact] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchFacts = () => {
    fetch('/api/knowledge')
      .then((res) => res.json())
      .then((data) => setFacts(data.knowledge || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchFacts(); }, []);

  const addFact = async () => {
    if (!newFact.trim()) return;
    setAdding(true);
    await fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact: newFact.trim() }),
    });
    setNewFact('');
    setAdding(false);
    fetchFacts();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Knowledge Base</h1>
          <p className="page-subtitle">
            Facts the bot knows about you and your world. Injected into every AI call.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card-header">
          <span className="card-title">Add fact</span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input
            className="input"
            value={newFact}
            onChange={(e) => setNewFact(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFact()}
            placeholder="e.g. Pedro works at Nubank, Pedro loves pizza, Pedro's dog is called Rex…"
          />
          <button
            className="btn btn-primary"
            onClick={addFact}
            disabled={adding || !newFact.trim()}
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        <p className="help-text">
          Write facts in Portuguese, in third person. These are injected as context into every conversation.
        </p>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ width: `${60 + i * 10}%`, height: 20, marginBottom: 12 }} />
          ))}
        </div>
      ) : facts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📖</div>
          <div className="empty-state-title">No facts yet</div>
          <div className="empty-state-text">
            Add facts about yourself so the bot can reference them in conversations.
            Start with basics like your job, hobbies, and preferences.
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Stored facts</span>
            <span className="badge badge-neutral">{facts.length}</span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {facts.map((fact, i) => (
              <li
                key={i}
                style={{
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  borderBottom: i < facts.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                {fact}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
