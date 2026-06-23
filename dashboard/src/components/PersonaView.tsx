import { useState, useEffect } from 'react';
import { API_URL } from '../config';

export function PersonaView() {
  const [persona, setPersona] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/persona`)
      .then((res) => res.json())
      .then((data) => setPersona(data.persona || ''))
      .catch(() => setError('Failed to load persona'))
      .finally(() => setLoading(false));
  }, []);

  const savePersona = async () => {
    setSaving(true);
    setError(null);
    try {
      await fetch(`${API_URL}/api/persona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: persona }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save persona');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Persona</h1>
          <p className="page-subtitle">
            The system prompt that defines how the bot behaves and writes
          </p>
        </div>
        <button
          className={`btn ${saved ? 'btn-primary' : 'btn-secondary'}`}
          onClick={savePersona}
          disabled={saving || loading}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          marginBottom: 'var(--space-4)',
          background: 'var(--error-subtle)',
          border: '1px solid var(--error)',
          borderRadius: 'var(--radius)',
          color: 'var(--error)',
          fontSize: 'var(--text-sm)',
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <div className="skeleton" style={{ width: '100%', height: 400 }} />
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">System Prompt</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              {persona.length} characters
            </span>
          </div>
          <p className="help-text" style={{ marginBottom: 'var(--space-3)' }}>
            This is the instruction set the AI follows. Write in Portuguese, matching how you want the bot to think.
            Use the built-in fallback prompt as a reference for structure.
          </p>
          <textarea
            className="textarea"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="Write the system prompt here…"
            rows={25}
          />
        </div>
      )}

      <div style={{
        marginTop: 'var(--space-6)',
        padding: 'var(--space-4)',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
          Tips
        </h3>
        <ul style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <li>Be specific about tone, abbreviations, emoji usage, and when to stay silent</li>
          <li>Give concrete examples of good and bad responses</li>
          <li>Include rules for group vs. private chat behavior</li>
          <li>Changes take effect on the next message — no restart needed</li>
          <li>Leave blank to use the hardcoded fallback persona in the codebase</li>
        </ul>
      </div>
    </div>
  );
}
