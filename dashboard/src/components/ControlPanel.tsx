import { useState, useEffect } from 'react';

type Tab = 'persona' | 'knowledge' | 'contacts' | 'profiles';

export function ControlPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('persona');
  const [persona, setPersona] = useState('');
  const [knowledge, setKnowledge] = useState<string[]>([]);
  const [newFact, setNewFact] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  const fetchPersona = () => fetch('http://localhost:4000/api/persona').then(res => res.json()).then(data => setPersona(data.persona || ''));
  const fetchKnowledge = () => fetch('http://localhost:4000/api/knowledge').then(res => res.json()).then(data => setKnowledge(data.knowledge || []));
  const fetchContacts = () => fetch('http://localhost:4000/api/contacts').then(res => res.json()).then(data => setContacts(data.contacts || []));
  const fetchProfiles = () => fetch('http://localhost:4000/api/profiles').then(res => res.json()).then(data => setProfiles(data.profiles || []));

  useEffect(() => {
    fetchPersona();
    fetchKnowledge();
    fetchContacts();
    fetchProfiles();
  }, []);

  const savePersona = async () => {
    await fetch('http://localhost:4000/api/persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: persona })
    });
    alert('Persona atualizada no Cérebro!');
  };

  const addKnowledge = async () => {
    if (!newFact.trim()) return;
    await fetch('http://localhost:4000/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact: newFact })
    });
    setNewFact('');
    fetchKnowledge();
  };

  const extractProfile = async (chatId: string) => {
    await fetch('http://localhost:4000/api/profile/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId })
    });
    alert('Perfil extraído com sucesso!');
    fetchProfiles();
  };

  return (
    <aside className="sidebar-right panel">
      <div className="tabs" style={{ display: 'flex', flexWrap: 'wrap' }}>
        <button className={activeTab === 'persona' ? 'active' : ''} onClick={() => setActiveTab('persona')}>Persona</button>
        <button className={activeTab === 'knowledge' ? 'active' : ''} onClick={() => setActiveTab('knowledge')}>Conhecimento</button>
        <button className={activeTab === 'contacts' ? 'active' : ''} onClick={() => setActiveTab('contacts')}>Contatos</button>
        <button className={activeTab === 'profiles' ? 'active' : ''} onClick={() => setActiveTab('profiles')}>Perfis (Mimetismo)</button>
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

        {activeTab === 'contacts' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 className="glowing-text pink">Mapeamento Social</h3>
            <ul style={{ marginTop: '15px', listStyle: 'none', padding: 0, overflowY: 'auto', flex: 1 }}>
              {contacts.map((c, i) => (
                <li key={i} style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ color: 'var(--neon-pink)' }}>{c.pushname || c.first_name || c.chat_id}</strong>
                    <button onClick={() => extractProfile(c.chat_id)} style={{ fontSize: '0.7rem', background: 'var(--neon-purple)', color: '#fff', border: 'none', cursor: 'pointer', padding: '2px 5px' }}>Extrair Perfil</button>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Última vez: {new Date(c.last_activity).toLocaleString()}</div>
                </li>
              ))}
            </ul>
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
