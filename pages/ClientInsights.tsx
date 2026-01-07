import React, { useState, useMemo } from 'react';
import { User, CampaignStats, Client, IntegrationSecret } from '../types';
import { getCampaignInsights } from '../services/geminiService';
import { decryptSecret } from '../services/cryptoService';

interface ClientInsightsProps {
  user: User;
  campaigns: CampaignStats[];
  secrets: IntegrationSecret[];
}

const ClientInsights: React.FC<ClientInsightsProps> = ({ user, campaigns = [], secrets = [] }) => {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clientCampaigns = useMemo(() => {
    if (!user?.clientId || !Array.isArray(campaigns)) return [];
    
    const savedClientsRaw = localStorage.getItem('adpulse_local_db');
    let clientCampaignIds: string[] = [];
    try {
      const db = JSON.parse(savedClientsRaw || '{}');
      const allClients = db.clients || [];
      const currentClient = allClients.find((c: Client) => c.id === user.clientId);
      clientCampaignIds = Array.isArray(currentClient?.campaignIds) ? currentClient.campaignIds : [];
    } catch { clientCampaignIds = []; }
    
    return campaigns.filter(c => c && clientCampaignIds.includes(c.campaignId));
  }, [user.clientId, campaigns]);

  const handleGenerate = async () => {
    if (clientCampaigns.length === 0) {
      alert("Aucune donnée disponible pour l'audit.");
      return;
    }

    setLoading(true);
    setInsights(null);
    try {
      // Extraction de la clé AI si configurée
      const aiSecret = secrets.find(s => s.type === 'AI');
      let apiKey = undefined;
      if (aiSecret && aiSecret.value !== 'managed_by_env') {
        apiKey = await decryptSecret(aiSecret.value);
      }

      const result = await getCampaignInsights(clientCampaigns, apiKey);
      setInsights(result);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'audit.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col relative overflow-hidden h-full">
      <div className="relative z-10 flex flex-col gap-6 h-full">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase italic flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
              Santé IA
            </h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Analyse de vitalité créative</p>
          </div>
          {insights && (
            <button onClick={() => setInsights(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          )}
        </div>
        
        {!insights && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
             <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-blue-100">
               <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
               </svg>
             </div>
             <p className="text-xs font-black text-slate-800 uppercase tracking-tight px-6 italic">Comment vont tes publicités ?</p>
             <p className="text-[10px] text-slate-400 mt-2 font-bold px-10">Laisse l'IA analyser ton contenu et ton audience sans te perdre dans les chiffres.</p>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-4">
             <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
             <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] animate-pulse">Scan créatif en cours...</p>
          </div>
        )}

        {insights && (
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 rounded-2xl p-6 border border-slate-100">
            <div className="prose prose-sm max-w-none text-slate-600 leading-relaxed font-medium">
              {insights.split('\n').map((line, i) => {
                if (line.trim() === '') return <br key={i} />;
                const isHeading = line.match(/^\d\./) || line.startsWith('#');
                return (
                  <p key={i} className={`${isHeading ? 'text-slate-900 font-black text-xs uppercase tracking-tight mt-4 first:mt-0 mb-2 border-b border-slate-200 pb-1' : 'text-[11px] mb-2 pl-2 border-l-2 border-blue-100'}`}>
                    {line.replace(/^#+\s*/, '').replace(/^\d\.\s*/, '')}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        <button 
          onClick={handleGenerate} 
          disabled={loading || clientCampaigns.length === 0}
          className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-100 active:scale-95 disabled:opacity-30"
        >
          {loading ? 'Analyse...' : insights ? 'Refaire l\'audit' : 'Lancer mon audit'}
        </button>
      </div>
    </div>
  );
};

export default ClientInsights;