import { useState, useEffect, useCallback } from 'react';

type Contact = {
  id: string;
  name: string;
  pushname?: string;
  isGroup: boolean;
  isAllowed: boolean;
  proactivityEnabled: boolean;
};

export function ContactsView() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);

  const fetchDBContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch {
      // DB fetch fails silently — WhatsApp sync is primary source
    }
  }, []);

  const syncWhatsApp = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/whatsapp/contacts');
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setContacts(data.contacts || []);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to sync contacts');
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDBContacts();
    syncWhatsApp();
  }, [fetchDBContacts, syncWhatsApp]);

  const togglePermission = async (contact: Contact, field: 'isAllowed' | 'proactivityEnabled', value: boolean) => {
    const updated = { ...contact, [field]: value };
    setContacts((prev) => prev.map((c) => (c.id === contact.id ? updated : c)));

    await fetch('/api/contacts/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: updated.id,
        name: updated.name,
        isGroup: updated.isGroup,
        isAllowed: updated.isAllowed,
        proactivityEnabled: updated.proactivityEnabled,
      }),
    });
  };

  const extractProfile = async (chatId: string) => {
    await fetch('/api/profile/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId }),
    });
    alert('Profile extracted. Check the Profiles tab.');
  };

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">
            Manage who the bot can reply to and start conversations with
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            className="btn btn-secondary"
            onClick={syncWhatsApp}
            disabled={syncing}
          >
            {syncing ? (
              <>
                <span className="spinner spinner-sm" />
                Syncing…
              </>
            ) : (
              'Sync from WhatsApp'
            )}
          </button>
        </div>
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
          WhatsApp sync issue: {error}. Showing database contacts. The bot must be authenticated on WhatsApp to sync live contacts.
        </div>
      )}

      <div style={{ marginBottom: 'var(--space-4)', maxWidth: 360 }}>
        <input
          className="input"
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-3) 0', borderBottom: i < 5 ? '1px solid var(--border)' : 'none' }}>
              <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: 120, height: 14, marginBottom: 4 }} />
                <div className="skeleton" style={{ width: 60, height: 10 }} />
              </div>
              <div className="skeleton" style={{ width: 36, height: 20, borderRadius: 10 }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 && !loading ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <div className="empty-state-title">No contacts found</div>
          <div className="empty-state-text">
            {search
              ? 'No contacts match your search. Try a different term.'
              : 'Sync from WhatsApp to load your contacts, or wait for someone to message the bot first.'}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Can reply</th>
                  <th>Proactive</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      {c.pushname && c.pushname !== c.name && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                          {c.pushname}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${c.isGroup ? 'badge-neutral' : 'badge-success'}`}>
                        {c.isGroup ? 'Group' : 'Contact'}
                      </span>
                    </td>
                    <td>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={c.isAllowed}
                          onChange={(e) => togglePermission(c, 'isAllowed', e.target.checked)}
                        />
                        <span className="toggle-track" />
                        <span className="sr-only">
                          {c.isAllowed ? 'Disable replies' : 'Enable replies'}
                        </span>
                      </label>
                    </td>
                    <td>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={c.proactivityEnabled}
                          onChange={(e) => togglePermission(c, 'proactivityEnabled', e.target.checked)}
                          disabled={c.isGroup}
                        />
                        <span className="toggle-track" />
                        <span className="sr-only">
                          {c.proactivityEnabled ? 'Disable proactive messages' : 'Enable proactive messages'}
                        </span>
                      </label>
                      {c.isGroup && (
                        <div className="help-text">Groups not supported</div>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => extractProfile(c.id)}
                        title="Extract communication style profile"
                      >
                        Extract profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          How permissions work
        </h3>
        <ul style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <li><strong>Can reply</strong> — bot will respond when this contact messages</li>
          <li><strong>Proactive</strong> — bot may start conversations unprompted (requires "Can reply")</li>
          <li>If no contacts have "Can reply" enabled, the bot responds to everyone</li>
          <li>Groups need a direct mention (@Pedro) or game-related topic to trigger a response</li>
        </ul>
      </div>
    </div>
  );
}
