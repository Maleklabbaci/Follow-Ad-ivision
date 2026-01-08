
import React, { useMemo, useState } from 'react';
import { Client, CampaignStats, IntegrationSecret } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, AreaChart, Area, ComposedChart, Line 
} from 'recharts';
import { getCampaignInsights, getCopywritingSuggestions, getAnomalyDetection } from '../services/geminiService';
import { useCurrency } from '../contexts/CurrencyContext';
import { decryptSecret } from '../services/cryptoService';

interface AdminDashboardProps {
  clients: Client[];
  campaigns: CampaignStats[];
  secrets: IntegrationSecret[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ clients, campaigns, secrets }) => {
  const [activeTask, setActiveTask] = useState<'AUDIT' | 'COPY' | 'SENTINEL' | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const { format, currency } = useCurrency();

  // 1. Statistiques Consolider de la Plateforme
  const platformStats = useMemo(() => {
    const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
    const avgCPA = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;
    
    return {
      totalSpend,
      totalConversions,
      avgCPA,
      activeCampaigns,
      clientCount: clients.length
    };
  }, [campaigns, clients]);

  // 2. Données pour le graphique de performance agrégée (Simulation de tendance)
  const performanceTrend = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => ({
      day: `J-${6-i}`,
      spend: (platformStats.totalSpend / 7) * (0.8 + Math.random() * 0.4),
      conversions: (platformStats.totalConversions / 7) * (0.7 + Math.random() * 0.6)
    }));
  }, [platformStats]);

  // 3. Filtrage des campagnes pour l'IA
  const targetCampaigns = useMemo(() => {
    if (selectedClient === 'all') return campaigns;
    const client = clients.find(c => c.id === selectedClient);
    return client ? campaigns.filter(cp => client.campaignIds.includes(cp.campaignId)) : campaigns;
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

  const getApiStatus = (type: 'FACEBOOK' | 'AI') => {
    const s = secrets.find(x => x.type === type);
    return s?.status === 'VALID';
  };

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">
      {/* 1. Header & Platform Health */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Control Room</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Vision Globale • {platformStats.clientCount} Comptes Clients Actifs
          </p>
        </div>
        
        <div className="flex gap-4 w-full lg:w-auto">
          <StatusCard label="META API" active={getApiStatus('FACEBOOK')} />
          <StatusCard label="GEMINI IA" active={getApiStatus('AI')} />
          <StatusCard label="SYNC CLOUD" active={true} />
        </div>
      </div>

      {/* 2. Macro KPIs Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <MacroKPI label="Managed Portfolio" value={format(platformStats.totalSpend)} sub="Dépense Totale Gérée" color="slate" />
        <MacroKPI label="Global Conversions" value={platformStats.totalConversions.toLocaleString()} sub="Toutes Campagnes Confondues" color="blue" />
        <MacroKPI label="Cost (Moyen)" value={format(platformStats.avgCPA, 'USD', 2)} sub="Moyenne Plateforme" color="emerald" />
        <MacroKPI label="Active Nodes" value={platformStats.activeCampaigns.toString()} sub="Flux de Données Temps Réel" color="purple" />
      </div>

      {/* 3. Global Analytics Matrix & AI Console */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Performance Chart */}
        <div className="xl:col-span-2 bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Performance Matrix</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Évolution Spend vs Conversions (Global)</p>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={performanceTrend}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '15px'}}
                  labelStyle={{fontWeight: 'black', textTransform: 'uppercase', fontSize: '10px', color: '#64748b', marginBottom: '5px'}}
                />
                <Area type="monotone" dataKey="spend" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorSpend)" />
                <Line type="monotone" dataKey="conversions" stroke="#10b981" strokeWidth={4} dot={{r: 4, fill: '#10b981'}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Lab Side Control */}
        <div className="xl:col-span-1 bg-slate-900 rounded-[3rem] p-8 text-white shadow-2xl flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[60px] rounded-full"></div>
          <h3 className="text-xl font-black italic uppercase tracking-tighter mb-8 flex items-center gap-3">
            <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            AI Lab Control
          </h3>
          
          <div className="space-y-6 flex-1">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Périmètre d'Analyse</label>
              <select 
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-300 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <option value="all">Portefeuille Global</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <AgentBtn label="Audit Stratégique" onClick={() => runAgent('AUDIT')} active={activeTask === 'AUDIT'} icon="📊" />
              <AgentBtn label="Hooks Créatifs" onClick={() => runAgent('COPY')} active={activeTask === 'COPY'} icon="✍️" color="purple" />
              <AgentBtn label="Sentinelle Alertes" onClick={() => runAgent('SENTINEL')} active={activeTask === 'SENTINEL'} icon="⚠️" color="amber" />
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-white/5">
             <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-500">
               <span>Moteur Actif</span>
               <span className="text-blue-400">Gemini 3 Flash</span>
             </div>
          </div>
        </div>
      </div>

      {/* 4. AI Output Console - Full Width Below */}
      {(aiResult || loading) && (
        <div className="bg-white rounded-[3rem] border-2 border-slate-100 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-500">
          <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-3">
               <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></div>
               <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest italic">Analyse IA : {activeTask}</h3>
            </div>
            <button onClick={() => setAiResult(null)} className="text-slate-300 hover:text-slate-900 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-10 md:p-16">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-6">
                <div className="w-16 h-16 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Extraction de l'intelligence...</p>
              </div>
            ) : (
              <div className="prose prose-slate max-w-none text-slate-700 font-bold leading-relaxed">
                {aiResult?.split('\n').map((line, i) => {
                  const isHeader = line.match(/^[1-4📊🚀⚠️⚡]/);
                  return (
                    <p key={i} className={`${isHeader ? 'text-2xl font-black text-slate-900 mt-10 mb-6 border-b pb-4' : 'mb-4 opacity-80 text-lg'}`}>
                      {line}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Top Performance & Client Ranking Table */}
      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-black text-slate-900 uppercase italic">Portfolio Activity</h3>
          <span className="text-[10px] font-black bg-slate-50 text-slate-400 px-4 py-2 rounded-full uppercase tracking-widest">Classement par Dépense</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50">
                <th className="px-10 py-6">Client</th>
                <th className="px-10 py-6">Campagnes</th>
                <th className="px-10 py-6 text-right">Dépense Totale</th>
                <th className="px-10 py-6 text-right">Conversions</th>
                <th className="px-10 py-6 text-right">Cost Moyen</th>
                <th className="px-10 py-6 text-right">Statut IA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {clients.map(client => {
                const clientCampaigns = campaigns.filter(c => client.campaignIds.includes(c.campaignId));
                const spend = clientCampaigns.reduce((s, c) => s + (c.spend || 0), 0);
                const convs = clientCampaigns.reduce((s, c) => s + (c.conversions || 0), 0);
                const cpa = convs > 0 ? spend / convs : 0;
                
                return (
                  <tr key={client.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-10 py-6">
                      <div className="font-black text-slate-900 uppercase italic group-hover:text-blue-600 transition-colors">{client.name}</div>
                      <div className="text-[9px] font-bold text-slate-400 mt-0.5">{client.email}</div>
                    </td>
                    <td className="px-10 py-6">
                      <span className="text-xs font-black text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">{clientCampaigns.length}</span>
                    </td>
                    <td className="px-10 py-6 text-right font-black text-slate-900 tabular-nums">{format(spend)}</td>
                    <td className="px-10 py-6 text-right font-black text-blue-600 tabular-nums">{convs}</td>
                    <td className="px-10 py-6 text-right font-black text-emerald-600 tabular-nums">{format(cpa, 'USD', 2)}</td>
                    <td className="px-10 py-6 text-right">
                       <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MacroKPI = ({ label, value, sub, color }: any) => {
  const themes: any = {
    blue: 'border-blue-100 bg-blue-50/30 text-blue-600',
    emerald: 'border-emerald-100 bg-emerald-50/30 text-emerald-600',
    purple: 'border-purple-100 bg-purple-50/30 text-purple-600',
    slate: 'border-slate-200 bg-white text-slate-900'
  };
  return (
    <div className={`p-8 rounded-[2.5rem] border-2 flex flex-col justify-center shadow-sm ${themes[color]}`}>
      <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-2">{label}</p>
      <p className="text-3xl font-black tracking-tighter tabular-nums truncate">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mt-1">{sub}</p>
    </div>
  );
};

const StatusCard = ({ label, active }: { label: string, active: boolean }) => (
  <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm">
    <div className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500 animate-pulse'}`}></div>
    <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">{label}</span>
  </div>
);

const AgentBtn = ({ label, onClick, active, icon, color }: any) => {
  const colors: any = {
    purple: active ? 'bg-purple-600 text-white border-purple-600' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10',
    amber: active ? 'bg-amber-500 text-white border-amber-500' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10',
    default: active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
  };
  return (
    <button onClick={onClick} className={`w-full py-5 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between border ${colors[color] || colors.default}`}>
      <span className="flex items-center gap-4"><span>{icon}</span> {label}</span>
      <span className="opacity-40">→</span>
    </button>
  );
};

export default AdminDashboard;
