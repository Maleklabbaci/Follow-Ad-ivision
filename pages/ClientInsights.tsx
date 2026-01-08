
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
  const [showModal, setShowModal] = useState(false);
  const [lang, setLang] = useState<'fr' | 'en' | 'ar'>('fr');

  const clientCampaigns = useMemo(() => {
    if (!user?.clientId) return [];
    const savedClientsRaw = localStorage.getItem('adpulse_local_db');
    let clientCampaignIds: string[] = [];
    try {
      const db = JSON.parse(savedClientsRaw || '{}');
      const allClients = db.clients || [];
      const currentClient = allClients.find((c: Client) => c.id === user.clientId);
      clientCampaignIds = currentClient?.campaignIds || [];
    } catch { }
    return campaigns.filter(c => clientCampaignIds.includes(c.campaignId));
  }, [user.clientId, campaigns]);

  const handleGenerate = async (selectedLang: 'fr' | 'en' | 'ar') => {
    setLang(selectedLang);
    setLoading(true);
    setShowModal(true);
    setInsights(null);
    try {
      const aiSecret = secrets.find(s => s.type === 'AI');
      let apiKey = (aiSecret && aiSecret.value !== 'managed_by_env') 
        ? await decryptSecret(aiSecret.value) 
        : undefined;

      const result = await getCampaignInsights(clientCampaigns, apiKey, selectedLang);
      setInsights(result);
    } catch (err: any) {
      setInsights("Une erreur est survenue lors de l'analyse stratégique. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full">
      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-6 h-full min-h-[300px]">
        <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-200 animate-bounce-slow">
           <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
           </svg>
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Audit Stratégique IA</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Décisions basées sur la donnée réelle.</p>
        </div>

        <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
          <LangBtn label="FR" active={lang === 'fr'} onClick={() => handleGenerate('fr')} />
          <LangBtn label="EN" active={lang === 'en'} onClick={() => handleGenerate('en')} />
          <LangBtn label="AR" active={lang === 'ar'} onClick={() => handleGenerate('ar')} />
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-6 lg:p-10">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowModal(false)}></div>
          
          <div className="relative bg-white w-full max-w-4xl h-full max-h-[92vh] md:h-auto md:max-h-[85vh] rounded-3xl md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-6 md:p-10 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
               <div className="flex items-center gap-3">
                  <div className="w-2 h-2 md:w-3 md:h-3 bg-blue-600 rounded-full animate-pulse"></div>
                  <h3 className="text-lg md:text-xl font-black uppercase italic tracking-tight text-slate-900">Verdict Stratégique</h3>
               </div>
               <button onClick={() => setShowModal(false)} className="p-2 text-slate-300 hover:text-slate-900 transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-6 py-20 md:py-32">
                  <div className="relative">
                    <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></div>
                    </div>
                  </div>
                  <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse text-center px-4">Calcul des trajectoires de croissance...</p>
                </div>
              ) : (
                <div className={`prose prose-slate max-w-none ${lang === 'ar' ? 'text-right dir-rtl font-arabic' : 'text-left font-sans'}`}>
                  {insights?.split('\n').map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={i} className="h-4" />;

                    // Header detection
                    const isHeading = trimmed.match(/^[1234]\.|\d\./) || trimmed.match(/^[📊🚀⚠️⚡]/);
                    const isListItem = trimmed.startsWith('-') || trimmed.startsWith('•');

                    return (
                      <div key={i} className={`
                        ${isHeading ? 'text-lg md:text-xl font-black text-slate-900 mt-6 md:mt-10 mb-4 md:mb-6 flex items-center gap-2 border-b border-slate-100 pb-2' : ''}
                        ${isListItem ? 'ml-2 md:ml-4 pl-4 border-l-2 border-blue-100 py-1 text-slate-700 font-semibold text-sm md:text-base' : ''}
                        ${!isHeading && !isListItem ? 'text-slate-600 font-medium leading-relaxed mb-4 text-sm md:text-base opacity-90' : ''}
                      `}>
                        {trimmed}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex justify-center shrink-0">
               <button 
                 onClick={() => setShowModal(false)}
                 className="w-full md:w-auto px-8 md:px-16 py-4 md:py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-95"
               >
                 EXÉCUTER LA STRATÉGIE
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LangBtn = ({ label, active, onClick }: any) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`py-3 rounded-xl text-[10px] font-black transition-all border ${active ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
  >
    {label}
  </button>
);

export default ClientInsights;
