import React, { useState, useEffect } from 'react';
import { IntegrationSecret } from '../types';
import { DB } from '../services/db';
import { testGeminiConnection } from '../services/geminiService';
import { decryptSecret } from '../services/cryptoService';

interface AdminSettingsProps {
  secrets: IntegrationSecret[];
  setSecrets: React.Dispatch<React.SetStateAction<IntegrationSecret[]>>;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({ secrets, setSecrets }) => {
  const [fbToken, setFbToken] = useState('');
  const [aiToken, setAiToken] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);

  const getSecretStatus = (type: 'FACEBOOK' | 'AI') => {
    return secrets.find(s => s.type === type);
  };

  const handleSaveAndTestAi = async () => {
    const trimmedKey = aiToken.trim();
    if (!trimmedKey && !process.env.API_KEY) {
      alert("Veuillez saisir une clé API valide.");
      return;
    }

    setIsTestingAi(true);
    try {
      const isValid = await testGeminiConnection(trimmedKey || undefined);
      
      const encryptedVal = trimmedKey ? `enc:${btoa(trimmedKey)}` : 'managed_by_env';
      
      const newSecret: IntegrationSecret = {
        type: 'AI',
        value: encryptedVal,
        updatedAt: new Date().toISOString(),
        status: isValid ? 'VALID' : 'INVALID'
      };

      const updatedSecrets = [
        ...secrets.filter(s => s.type !== 'AI'),
        newSecret
      ];
      
      setSecrets(updatedSecrets);
      await DB.saveSecrets(updatedSecrets);
      
      if (isValid) {
        alert("FÉLICITATIONS : L'intelligence artificielle est maintenant active sur toute votre plateforme.");
        setAiToken('');
      } else {
        alert("ERREUR : La clé n'a pas pu être validée. Assurez-vous d'utiliser une clé API Google Gemini valide (commençant souvent par AIza...).");
      }
    } catch (err) {
      alert("Erreur technique lors de la validation.");
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSaveAndTest = async (type: 'FACEBOOK', val: string) => {
    const trimmedVal = val.trim();
    if (!trimmedVal) {
      alert("Veuillez entrer un jeton Meta.");
      return;
    }

    setIsTesting(true);
    const encryptedVal = `enc:${btoa(trimmedVal)}`;
    
    const newSecret: IntegrationSecret = { 
      type, 
      value: encryptedVal, 
      updatedAt: new Date().toISOString(),
      status: 'UNTESTED'
    };

    const updatedSecrets = [
      ...secrets.filter(s => s.type !== type),
      newSecret
    ];
    setSecrets(updatedSecrets);

    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${trimmedVal}`);
      const data = await res.json();
      
      const finalStatus = data.error ? 'INVALID' : 'VALID';
      const finalSecret: IntegrationSecret = { ...newSecret, status: finalStatus };
      
      const finalSecrets = [
        ...secrets.filter(s => s.type !== type),
        finalSecret
      ];

      setSecrets(finalSecrets);
      await DB.saveSecrets(finalSecrets);

      if (finalStatus === 'VALID') {
        alert("Succès : Connexion Meta validée.");
        setFbToken('');
      } else {
        alert("Échec : Jeton Meta invalide.");
      }
    } catch (err) {
      alert("Erreur réseau.");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase italic">Settings</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Configuration Cloud & Intelligence</p>
        </div>
        <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg border border-emerald-100 text-[10px] font-black uppercase tracking-widest animate-pulse">
          Cloud Active
        </div>
      </div>

      {/* IA Section - Focus on Compatibility */}
      <section className="bg-slate-900 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
           <svg className="w-32 h-32 text-purple-400" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        
        <div className="relative z-10 space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 bg-purple-600/20 rounded-2xl flex items-center justify-center text-purple-400 border border-purple-500/30">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
               </div>
               <h3 className="text-xl font-black text-white uppercase italic tracking-tight">IA Intelligence Core</h3>
            </div>
            <StatusBadge status={getSecretStatus('AI')?.status} isDark />
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-end px-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">IA API Key (Google Engine)</label>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[9px] font-black text-purple-400 uppercase tracking-widest hover:text-purple-300 transition-colors underline"
              >
                Obtenir une clé gratuite ↗
              </a>
            </div>
            <input 
              type="password" 
              placeholder="Ex: AIzaSyB..." 
              className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm text-purple-200 placeholder:text-slate-700" 
              value={aiToken} 
              onChange={e => setAiToken(e.target.value)} 
              disabled={isTestingAi}
            />
          </div>

          <div className="p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10">
            <p className="text-[10px] font-bold text-slate-400 leading-relaxed italic">
              Note : La plateforme utilise actuellement le moteur **Gemini** pour sa rapidité. Assurez-vous d'utiliser une clé issue de Google AI Studio. Les clés OpenAI/Claude ne sont pas compatibles avec ce module.
            </p>
          </div>

          <button 
            onClick={handleSaveAndTestAi} 
            disabled={isTestingAi}
            className="w-full px-6 py-5 bg-purple-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-xl shadow-purple-900/40 flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            {isTestingAi ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'ACTIVER L\'INTELLIGENCE ARTIFICIELLE'}
          </button>
        </div>
      </section>

      {/* Meta API Section */}
      <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
             </div>
             <h3 className="text-xl font-black text-slate-800 uppercase italic">Meta Marketing API</h3>
          </div>
          <StatusBadge status={getSecretStatus('FACEBOOK')?.status} />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Meta Access Token</label>
          <input 
            type="password" 
            placeholder="EAAB..." 
            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" 
            value={fbToken} 
            onChange={e => setFbToken(e.target.value)} 
            disabled={isTesting}
          />
        </div>
        <button 
          onClick={() => handleSaveAndTest('FACEBOOK', fbToken)} 
          disabled={isTesting || !fbToken}
          className="w-full px-6 py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isTesting ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'VALIDER ACCÈS META'}
        </button>
      </section>
    </div>
  );
};

const StatusBadge = ({ status, isDark }: { status?: string, isDark?: boolean }) => {
  const styles: any = {
    VALID: isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-200',
    INVALID: isDark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200',
    UNTESTED: isDark ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-100 text-amber-700 border-amber-200',
    DEFAULT: isDark ? 'bg-white/5 text-slate-500 border-white/10' : 'bg-slate-100 text-slate-400 border-slate-200'
  };
  
  const currentStyle = styles[status || 'DEFAULT'] || styles.DEFAULT;
  const label = status === 'VALID' ? 'ACTIVE' : (status === 'INVALID' ? 'ERROR' : 'OFF');

  return (
    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${currentStyle}`}>
      {label}
    </span>
  );
};

export default AdminSettings;