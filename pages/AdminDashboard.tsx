
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, CampaignStats, IntegrationSecret } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getCampaignInsights, getCopywritingSuggestions, getAnomalyDetection } from '../services/geminiService';
import { useCurrency } from '../contexts/CurrencyContext';
import { decryptSecret } from '../services/cryptoService';

interface AdminDashboardProps {
  clients: Client[];
  campaigns: CampaignStats[];
  secrets: IntegrationSecret[];
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#6366f1', '#ec4899'];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ clients, campaigns, secrets }) => {
  const [activeTask, setActiveTask] = useState<'AUDIT' | 'COPY' | 'SENTINEL' | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const { format, currency } = useCurrency();
  
  const targetCampaigns = useMemo(() => {
    const allLinked = new Set(clients.flatMap(c => c.campaignIds));
    const filtered = campaigns.filter(cp => cp && allLinked.has(cp.campaignId));
    if (selectedClient === 'all') return filtered;
    const client = clients.find(c => c.id === selectedClient);
    return client ? filtered.filter(cp => client.campaignIds.includes(cp.campaignId)) : filtered;
  }, [clients, campaigns, selectedClient]);

  const runAgent = async (task: 'AUDIT' | 'COPY' | 'SENTINEL') => {
    if (targetCampaigns.length === 0) return;
    setLoading(true);
    setActiveTask(task);
    setAiResult(null);
    try {
      const aiSecret = secrets.find(s => s.type === 'AI');
      const apiKey = aiSecret && aiSecret.value !== 'managed_by_env' ? await decryptSecret(aiSecret.value) : undefined;
      
      let res = "";
      if (task === 'AUDIT') res = await getCampaignInsights(targetCampaigns, apiKey);
      if (task === 'COPY') res = await getCopywritingSuggestions(targetCampaigns, apiKey);
      if (task === 'SENTINEL') res = await getAnomalyDetection(targetCampaigns, apiKey);
      
      setAiResult(res);
    } catch (err: any) {
      setAiResult(`ERREUR AGENT : ${err.message}`);
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Control Room IA</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 italic">Intelligence Décisionnelle Multi-Agents</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lab Control */}
        <div className="lg:col-span-1 bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
          <h3 className="text-xl font-black italic uppercase tracking-tighter mb-8 flex items-center gap-3">
            <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            AI Lab Hub
          </h3>
          
          <div className="space-y-4">
            <select 
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Global Portfolio</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <div className="grid grid-cols-1 gap-2 pt-4">
              <AgentBtn label="Audit Stratégique" onClick={() => runAgent('AUDIT')} active={activeTask === 'AUDIT'} icon="📊" />
              <AgentBtn label="Hooks Créatifs" onClick={() => runAgent('COPY')} active={activeTask === 'COPY'} icon="✍️" color="purple" />
              <AgentBtn label="Sentinelle Alertes" onClick={() => runAgent('SENTINEL')} active={activeTask === 'SENTINEL'} icon="⚠️" color="amber" />
            </div>
          </div>
        </div>

        {/* Console Output */}
        <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest italic">Output IA : {activeTask || 'En attente'}</h3>
            {loading && <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>}
          </div>
          
          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
            {!aiResult && !loading ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                <svg className="w-16 h-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Initialisez un agent pour voir les résultats</p>
              </div>
            ) : (
              <div className="prose prose-slate max-w-none text-slate-700 font-bold leading-relaxed animate-in fade-in slide-in-from-bottom-4">
                {aiResult?.split('\n').map((line, i) => {
                  const isHeader = line.match(/^[1-4📊🚀⚠️⚡]/);
                  return (
                    <p key={i} className={`${isHeader ? 'text-lg font-black text-slate-900 mt-8 mb-4 border-b pb-2' : 'mb-4 opacity-80'}`}>
                      {line}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AgentBtn = ({ label, onClick, active, icon, color }: any) => {
  const colors: any = {
    purple: active ? 'bg-purple-600 text-white' : 'hover:bg-purple-500/10 text-slate-400',
    amber: active ? 'bg-amber-500 text-white' : 'hover:bg-amber-500/10 text-slate-400',
    default: active ? 'bg-blue-600 text-white' : 'hover:bg-blue-600/10 text-slate-400'
  };
  return (
    <button onClick={onClick} className={`w-full py-4 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between border border-white/5 ${colors[color] || colors.default}`}>
      <span className="flex items-center gap-3"><span>{icon}</span> {label}</span>
      <span>→</span>
    </button>
  );
};

export default AdminDashboard;
