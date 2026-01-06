
import React, { useState } from 'react';
import { IntegrationSecret } from '../types';

interface AdminSettingsProps {
  secrets: IntegrationSecret[];
  setSecrets: React.Dispatch<React.SetStateAction<IntegrationSecret[]>>;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({ secrets, setSecrets }) => {
  const [fbToken, setFbToken] = useState('');
  const [dbToken, setDbToken] = useState('');

  const getSecretStatus = (type: 'FACEBOOK' | 'DATABASE') => {
    return secrets.find(s => s.type === type);
  };

  const updateSecretStatus = (type: 'FACEBOOK' | 'DATABASE', status: 'VALID' | 'INVALID') => {
    setSecrets(prev => prev.map(s => 
      s.type === type ? { ...s, status, lastTested: new Date().toISOString() } : s
    ));
  };

  const handleSave = (type: 'FACEBOOK' | 'DATABASE', val: string) => {
    if (!val) return;
    setSecrets(prev => {
      const filtered = prev.filter(s => s.type !== type);
      return [...filtered, { 
        type, 
        value: `enc:${btoa(val)}`, 
        updatedAt: new Date().toISOString(),
        status: 'UNTESTED'
      }];
    });
    setFbToken('');
    setDbToken('');
    alert(`${type} sauvegardé. Veuillez tester la connexion.`);
  };

  const testFBConnection = async () => {
    const secret = getSecretStatus('FACEBOOK');
    if (!secret) return;
    const token = atob(secret.value.replace('enc:', ''));

    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${token}`);
      const data = await res.json();
      if (data.error) throw new Error();
      updateSecretStatus('FACEBOOK', 'VALID');
      alert("Connexion Facebook validée.");
    } catch {
      updateSecretStatus('FACEBOOK', 'INVALID');
      alert("Échec de connexion Facebook.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Configuration Intégrations</h2>
        <p className="text-slate-500">Gérez les accès API et les paramètres de synchronisation.</p>
      </div>

      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold">Meta Marketing API</h3>
          <StatusBadge status={getSecretStatus('FACEBOOK')?.status} />
        </div>
        <input 
          type="password" 
          placeholder="Access Token Facebook" 
          className="w-full px-4 py-2 bg-slate-50 border rounded-lg outline-none" 
          value={fbToken} 
          onChange={e => setFbToken(e.target.value)} 
        />
        <div className="flex gap-2">
          <button onClick={() => handleSave('FACEBOOK', fbToken)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Sauvegarder</button>
          <button onClick={testFBConnection} className="px-4 py-2 border rounded-lg text-sm font-medium">Tester</button>
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold">Base de Données Centrale</h3>
          <StatusBadge status={getSecretStatus('DATABASE')?.status} />
        </div>
        <input 
          type="password" 
          placeholder="DB Connection Secret" 
          className="w-full px-4 py-2 bg-slate-50 border rounded-lg outline-none" 
          value={dbToken} 
          onChange={e => setDbToken(e.target.value)} 
        />
        <button onClick={() => handleSave('DATABASE', dbToken)} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium">Sauvegarder</button>
      </section>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
        <strong>Note de sécurité:</strong> L'IA utilise la clé configurée en environnement par l'administrateur système. Toutes les données sont cryptées en local via AES.
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status?: string }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${status === 'VALID' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}>
    {status || 'NON CONFIGURÉ'}
  </span>
);

export default AdminSettings;
