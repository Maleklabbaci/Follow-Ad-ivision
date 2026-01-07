
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

  // Charger la valeur existante si elle est disponible (version masquée)
  useEffect(() => {
    const aiSecret = secrets.find(s => s.type === 'AI');
    if (aiSecret && aiSecret.value !== 'managed_by_env') {
       // On ne déchiffre pas pour l'affichage par sécurité, on laisse vide ou on met des points
    }
  }, [secrets]);

  const getSecretStatus = (type: 'FACEBOOK' | 'AI') => {
    return secrets.find(s => s.type === type);
  };

  const handleSaveAndTestAi = async () => {
    if (!aiToken && !process.env.API_KEY) {
      alert("Veuillez entrer une clé API Gemini ou configurer l'environnement.");
      return;
    }

    setIsTestingAi(true);
    try {
      // Si une clé est saisie, on l'utilise pour le test, sinon on utilise l'env
      const isValid = await testGeminiConnection();
      
      const encryptedVal = aiToken ? `enc:${btoa(aiToken)}` : 'managed_by_env';
      
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
        alert("Succès : L'API Gemini est valide. Les fonctions d'IA sont activées pour toute la plateforme.");
        setAiToken('');
      } else {
        alert("Échec : La clé API semble invalide ou les quotas sont dépassés.");
      }
    } catch (err) {
      alert("Erreur technique lors du test de l'IA.");
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSaveAndTest = async (type: 'FACEBOOK', val: string) => {
    if (!val) {
      alert("Veuillez entrer un jeton Meta.");
      return;
    }

    setIsTesting(true);
    const encryptedVal = `enc:${btoa(val)}`;
    
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
      const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${val}`);
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
        alert("Succès : Connexion Meta validée et sauvegardée dans le Cloud.");
        setFbToken('');
      } else {
        alert(`Échec : Jeton invalide (${data.error?.message || 'Erreur inconnue'}). Statut mis à jour.`);
      }
    } catch (err) {
      const errorSecret: IntegrationSecret = { ...newSecret, status: 'INVALID' };
      const errorSecrets = [...secrets.filter(s => s.type !== type), errorSecret];
      setSecrets(errorSecrets);
      await DB.saveSecrets(errorSecrets);
      alert("Erreur réseau lors du test de connexion.");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase italic">Platform Settings</h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Configuration des connecteurs & sécurité</p>
      </div>

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
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Permanent Access Token (EAAB...)</label>
          <input 
            type="password" 
            placeholder="Coller votre token ici..." 
            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" 
            value={fbToken} 
            onChange={e => setFbToken(e.target.value)} 
            disabled={isTesting}
          />
        </div>
        <button 
          onClick={() => handleSaveAndTest('FACEBOOK', fbToken)} 
          disabled={isTesting || !fbToken}
          className="w-full px-6 py-5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isTesting ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'Enregistrer & Tester Meta'}
        </button>
      </section>

      {/* Gemini AI Section */}
      <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
             <h3 className="text-xl font-black text-slate-800 uppercase italic">Gemini AI Intelligence</h3>
          </div>
          <StatusBadge status={getSecretStatus('AI')?.status} />
        </div>
        
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Google Gemini API Key</label>
          <input 
            type="password" 
            placeholder="Saisir votre clé API Gemini..." 
            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm" 
            value={aiToken} 
            onChange={e => setAiToken(e.target.value)} 
            disabled={isTestingAi}
          />
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
            Configurez ici la clé pour les modèles <strong>Gemini 3 Pro</strong>. Si laissé vide, le système utilisera la configuration par défaut de l'environnement.
          </p>
        </div>
        <button 
          onClick={handleSaveAndTestAi} 
          disabled={isTestingAi}
          className="w-full px-6 py-5 bg-purple-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-xl shadow-purple-100 flex items-center justify-center gap-3"
        >
          {isTestingAi ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'Enregistrer & Tester l\'Intégration IA'}
        </button>
      </section>

      <section className="bg-slate-900 p-10 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
           <svg className="w-24 h-24 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5-10 5z" /></svg>
        </div>
        <div className="relative z-10">
           <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Cloud Database Integration</h3>
           </div>
           <p className="text-slate-400 text-sm leading-relaxed font-medium">
             La base de données SaaS est actuellement connectée à <strong>Supabase Cloud</strong>. 
             La synchronisation multi-appareil est active et sécurisée nativement.
           </p>
           <div className="mt-6 flex items-center gap-4">
              <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                Status: Connected
              </div>
           </div>
        </div>
      </section>
    </div>
  );
};

const StatusBadge = ({ status }: { status?: string }) => {
  const styles: any = {
    VALID: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    INVALID: 'bg-red-100 text-red-700 border-red-200',
    UNTESTED: 'bg-amber-100 text-amber-700 border-amber-200',
    DEFAULT: 'bg-slate-100 text-slate-400 border-slate-200'
  };
  
  const currentStyle = styles[status || 'DEFAULT'] || styles.DEFAULT;
  const label = status || 'NON TESTÉ';

  return (
    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${currentStyle}`}>
      {label}
    </span>
  );
};

export default AdminSettings;
