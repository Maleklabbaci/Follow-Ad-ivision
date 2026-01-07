
import React, { useState, useMemo } from 'react';
import { User, CampaignStats, Client } from '../types';
import { getCampaignInsights } from '../services/geminiService';

interface ClientInsightsProps {
  user: User;
  campaigns: CampaignStats[];
}

const ClientInsights: React.FC<ClientInsightsProps> = ({ user, campaigns = [] }) => {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Retrieve campaigns linked to this client context safely from props
  const clientCampaigns = useMemo(() => {
    if (!user?.clientId || !Array.isArray(campaigns)) return [];
    
    // Fallback if client management data isn't easily accessible, 
    // we use a safe look-up in the app's global state passed via context or parent
    const savedClientsRaw = localStorage.getItem('app_clients');
    let clientCampaignIds: string[] = [];
    try {
      const allClients = JSON.parse(savedClientsRaw || '[]');
      const currentClient = allClients.find((c: Client) => c.id === user.clientId);
      clientCampaignIds = Array.isArray(currentClient?.campaignIds) ? currentClient.campaignIds : [];
    } catch { clientCampaignIds = []; }
    
    return campaigns.filter(c => c && clientCampaignIds.includes(c.campaignId));
  }, [user.clientId, campaigns]);

  const handleGenerate = async () => {
    if (clientCampaigns.length === 0) {
      alert("No active campaigns found to analyze.");
      return;
    }

    setLoading(true);
    setInsights(null);
    try {
      const result = await getCampaignInsights(clientCampaigns);
      setInsights(result || "Analyse terminée sans recommandations spécifiques.");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la génération d'insights. Vérifiez votre clé API.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm h-full flex flex-col">
      <div className="flex flex-col gap-6 flex-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Audit IA Stratégique</h2>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Powered by Gemini 3.0 Pro</p>
        </div>
        
        {!insights && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-center bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
             <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
               <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
               </svg>
             </div>
             <p className="text-sm font-black text-slate-600 px-8 uppercase tracking-tight">Analyse prête pour {clientCampaigns.length} campagnes.</p>
             <p className="text-[10px] text-slate-400 mt-2 font-bold px-8">Validation ROI & Optimisation Budget</p>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center py-10 space-y-4">
             <div className="relative w-12 h-12">
               <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
             </div>
             <p className="text-xs font-black text-blue-600 uppercase tracking-widest animate-pulse">Intelligence en cours...</p>
          </div>
        )}

        {insights && (
          <div className="flex-1 p-6 bg-slate-900 text-white rounded-[2rem] text-sm leading-relaxed overflow-y-auto max-h-[400px] custom-scrollbar border border-white/10">
            <div className="flex items-center gap-2 mb-4">
               <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Rapport Gemini</span>
               <div className="h-px flex-1 bg-white/10"></div>
            </div>
            <div className="space-y-4 font-medium opacity-90">
              {insights.split('\n').map((line, i) => (
                <p key={i} className={line.startsWith('#') ? 'font-black text-blue-400 text-base mt-6' : ''}>
                  {line.replace(/^#+\s*/, '')}
                </p>
              ))}
            </div>
          </div>
        )}

        <button 
          onClick={handleGenerate} 
          disabled={loading || clientCampaigns.length === 0}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all disabled:opacity-30 flex items-center justify-center gap-3 shadow-2xl shadow-slate-200"
        >
          {loading ? 'Traitement IA...' : 'Générer Audit Stratégique'}
        </button>
      </div>
    </div>
  );
};

export default ClientInsights;
