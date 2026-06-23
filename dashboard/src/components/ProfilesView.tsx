import { useState, useEffect } from 'react';

type Profile = {
  chat_id: string;
  first_name?: string;
  pushname?: string;
  style_description: string;
  last_updated: number;
};

export function ProfilesView() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/profiles')
      .then((res) => res.json())
      .then((data) => setProfiles(data.profiles || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profiles</h1>
          <p className="page-subtitle">
            Learned communication styles for each contact. The bot mimics these when talking to them.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
          {[1, 2].map((i) => (
            <div key={i} className="card">
              <div className="skeleton" style={{ width: 140, height: 18, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: '100%', height: 14, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: '80%', height: 14, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: '60%', height: 14 }} />
            </div>
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎭</div>
          <div className="empty-state-title">No profiles extracted yet</div>
          <div className="empty-state-text">
            Profiles are automatically extracted when you message someone, or you can manually
            trigger extraction from the Contacts tab. Each profile captures how a contact
            communicates — slang, tone, formality — so the bot can mimic them.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
          {profiles.map((p) => (
            <div key={p.chat_id} className="card">
              <div className="card-header">
                <span className="card-title" style={{ color: 'var(--accent-text)' }}>
                  {p.pushname || p.first_name || p.chat_id}
                </span>
              </div>
              <div style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                lineHeight: 1.6,
                marginBottom: 'var(--space-3)',
              }}>
                {p.style_description}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                Updated {new Date(p.last_updated).toLocaleString()}
              </div>
            </div>
          ))}
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
          How profiles work
        </h3>
        <ul style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <li>Each profile describes how a specific contact communicates — tone, slang, formality</li>
          <li>The bot uses this to adapt its writing style per contact, not just per persona</li>
          <li>Profiles auto-extract after 10% of messages (sampled to save API costs)</li>
          <li>Manual extraction from the Contacts tab forces an immediate profile update</li>
        </ul>
      </div>
    </div>
  );
}
