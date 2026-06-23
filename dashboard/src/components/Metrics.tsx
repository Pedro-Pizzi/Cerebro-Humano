import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

export function Metrics() {
  const [data, setData] = useState<any[]>([
    { name: 'Seg', mensagens: 400, tokens: 2400 },
    { name: 'Ter', mensagens: 300, tokens: 1398 },
    { name: 'Qua', mensagens: 200, tokens: 9800 },
    { name: 'Qui', mensagens: 278, tokens: 3908 },
    { name: 'Sex', mensagens: 189, tokens: 4800 },
    { name: 'Sáb', mensagens: 239, tokens: 3800 },
    { name: 'Dom', mensagens: 349, tokens: 4300 },
  ]);

  return (
    <div className="metrics-container" style={{ padding: '20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2 className="glowing-text">Estatísticas do Cérebro</h2>
      
      <div style={{ display: 'flex', gap: '20px', height: '300px' }}>
        <div className="panel" style={{ flex: 1 }}>
          <h3 style={{ marginBottom: '15px' }}>Tráfego Neural (Mensagens)</h3>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="#8892b0" />
              <YAxis stroke="#8892b0" />
              <Tooltip contentStyle={{ backgroundColor: '#050505', borderColor: 'var(--neon-cyan)' }} />
              <Bar dataKey="mensagens" fill="var(--neon-cyan)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel" style={{ flex: 1 }}>
          <h3 style={{ marginBottom: '15px' }}>Gasto Energético (Tokens)</h3>
          <ResponsiveContainer width="100%" height="80%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="#8892b0" />
              <YAxis stroke="#8892b0" />
              <Tooltip contentStyle={{ backgroundColor: '#050505', borderColor: 'var(--neon-pink)' }} />
              <Line type="monotone" dataKey="tokens" stroke="var(--neon-pink)" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="panel" style={{ flex: 1 }}>
        <h3>Sensores Multimodais</h3>
        <p style={{ marginTop: '10px', color: 'var(--text-dim)' }}>Córtex Auditivo: <span style={{color: 'var(--neon-cyan)'}}>Online</span></p>
        <p style={{ marginTop: '5px', color: 'var(--text-dim)' }}>Córtex Visual: <span style={{color: 'var(--neon-cyan)'}}>Online</span></p>
        <p style={{ marginTop: '5px', color: 'var(--text-dim)' }}>Sistema Límbico: <span style={{color: 'var(--neon-cyan)'}}>Online</span></p>
        <p style={{ marginTop: '5px', color: 'var(--text-dim)' }}>Busca Web: <span style={{color: 'var(--neon-cyan)'}}>Online</span></p>
      </div>
    </div>
  );
}
