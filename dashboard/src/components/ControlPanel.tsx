import { useState, useEffect } from 'react';

type Tab = 'persona' | 'knowledge' | 'permissions' | 'profiles';

export function ControlPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('persona');
  const [persona, setPersona] = useState('');
  const [knowledge, setKnowledge] = useState<string[]>([]);
  const [newFact, setNewFact] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);

  const fetchPersona = () => fetch('/api/persona').then(res => res.json()).then(data => setPersona(data.persona || ''));
  const fetchKnowledge = () => fetch('/api/knowledge').then(res => res.json()).then(data => setKnowledge(data.knowledge || []));
  const fetchProfiles = () => fetch('/api/profiles').then(res => res.json()).then(data => setProfiles(data.profiles || []));
  
  const fetchWaContacts = async () => {
    setLoadingContacts(true);
    try {
      const res = await fetch('/api/whatsapp/contacts');
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (e) {
      console.error(e);
    }
    setLoadingContacts(false);
  };

  useEffect(() => {
    fetchPersona();
    fetchKnowledge();
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (activeTab === 'permissions') {
      fetchWaContacts();
    }
  }, [activeTab]);

  const savePersona = async () => {
    await fetch('/api/persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: persona })
    });
    alert('Persona atualizada no Cérebro!');
  };

  const addKnowledge = async () => {
    if (!newFact.trim()) return;
    await fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact: newFact })
    });
    setNewFact('');
    fetchKnowledge();
  };



  const extractProfile = async (chatId: string) => {
    await fetch('/api/profile/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId })
    });
    alert('Perfil extraído com sucesso! Verifique a aba Perfis.');
    fetchProfiles();
  };

  const togglePermission = async (contactId: string, field: 'isAllowed' | 'proactivityEnabled', value: boolean) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    const updated = {
      ...contact,
      [field]: value
    };

    // Update optimistically
    setContacts(prev => prev.map(c => c.id === contactId ? updated : c));

    await fetch('/api/contacts/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: updated.id,
        name: updated.name,
        isGroup: updated.isGroup,
        isAllowed: updated.isAllowed,
        proactivityEnabled: updated.proactivityEnabled
      })
    });
  };

  return (
    <aside className="sidebar-right panel">
      <div className="tabs" style={{ display: 'flex', flexWrap: 'wrap' }}>
        <button className={activeTab === 'permissions' ? 'active' : ''} onClick={() => setActiveTab('permissions')}>Permissões</button>
        <button className={activeTab === 'persona' ? 'active' : ''} onClick={() => setActiveTab('persona')}>Persona</button>
        <button className={activeTab === 'knowledge' ? 'active' : ''} onClick={() => setActiveTab('knowledge')}>Conhecimento</button>
        <button className={activeTab === 'profiles' ? 'active' : ''} onClick={() => setActiveTab('profiles')}>Perfis</button>
      </div>

      <div className="tab-content" style={{ marginTop: '15px' }}>
        {activeTab === 'persona' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 className="glowing-text">Editor de Mente</h3>
            <textarea 
              value={persona} 
              onChange={e => setPersona(e.target.value)}
              placeholder="Digite o System Prompt aqui..."
              style={{ flex: 1, minHeight: '300px', background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid var(--neon-purple)', padding: '10px', marginTop: '10px', fontFamily: 'var(--font-mono)' }}
            />
            <button onClick={savePersona} style={{ marginTop: '10px', padding: '10px', background: 'var(--neon-purple)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>SALVAR PERSONA</button>
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div>
            <h3 className="glowing-text cyan">Injetor de Memória</h3>
            <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
              <input 
                value={newFact}
                onChange={e => setNewFact(e.target.value)}
                placeholder="Ex: O usuário adora pizza"
                style={{ flex: 1, padding: '8px', background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid var(--neon-cyan)' }}
              />
              <button onClick={addKnowledge} style={{ padding: '8px 15px', background: 'var(--neon-cyan)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>INJETAR</button>
            </div>
            <ul style={{ marginTop: '15px', listStyle: 'none', padding: 0 }}>
              {knowledge.map((k, i) => (
                <li key={i} style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-dim)' }}>- {k}</li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'permissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 className="glowing-text cyan">Controle de Acesso (ACL)</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '15px' }}>Gerencie quem o bot pode responder e com quem ele pode puxar assunto ativamente.</p>
            
            <input 
              type="text"
              className="search-input"
              placeholder="Buscar contato ou grupo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />

            <div style={{ overflowY: 'auto', flex: 1, marginTop: '15px' }}>
              {loadingContacts ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-dim)' }}>
                  <span className="spinner"></span> Sincronizando agenda do WhatsApp...
                </div>
              ) : (
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Responder</th>
                      <th>Proativo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(c => (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: '500', color: '#fff' }}>{c.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{c.isGroup ? 'Grupo' : 'Contato'}</div>
                        </td>
                        <td>
                          <label className="toggle-switch">
                            <input type="checkbox" checked={c.isAllowed} onChange={e => togglePermission(c.id, 'isAllowed', e.target.checked)} />
                            <span className="toggle-slider"></span>
                          </label>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <label className="toggle-switch">
                              <input type="checkbox" checked={c.proactivityEnabled} onChange={e => togglePermission(c.id, 'proactivityEnabled', e.target.checked)} disabled={c.isGroup} style={{ opacity: c.isGroup ? 0.5 : 1 }} />
                              <span className="toggle-slider"></span>
                            </label>
                            <button onClick={() => extractProfile(c.id)} title="Forçar Extração de Perfil" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--neon-purple)' }}>
                              🎭
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'profiles' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 className="glowing-text">Avatares Digitais</h3>
            <ul style={{ marginTop: '15px', listStyle: 'none', padding: 0, overflowY: 'auto', flex: 1 }}>
              {profiles.map((p, i) => (
                <li key={i} style={{ padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--neon-cyan)', marginBottom: '10px' }}>
                  <strong style={{ color: 'var(--neon-cyan)', display: 'block', marginBottom: '5px' }}>{p.pushname || p.first_name || p.chat_id}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>{p.style_description}</div>
                  <div style={{ fontSize: '0.7rem', color: 'gray', marginTop: '5px' }}>Atualizado: {new Date(p.last_updated).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          </div>
        )}


      </div>
      
      <style>{`
        .tabs { display: flex; border-bottom: 1px solid var(--panel-border); }
        .tabs button { flex: 1; padding: 10px; background: transparent; border: none; color: var(--text-dim); cursor: pointer; transition: 0.3s; font-family: var(--font-header); text-transform: uppercase; font-size: 0.8rem;}
        .tabs button:hover { color: #fff; }
        .tabs button.active { color: var(--neon-cyan); border-bottom: 2px solid var(--neon-cyan); }
      `}</style>
    </aside>
  );
}
