
import React, { useMemo, useState } from 'react';
import { Client, CampaignStats, IntegrationSecret } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, AreaChart, Area, ComposedChart, Line, Legend
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
    const totalConversions = campaigns.reduce((sum, c) => sum + (c.results || 0), 0);
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

  // 2. Données pour le graphique de performance agrégée
  const performanceTrend = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => {
      const s = (platformStats.totalSpend / 14) * (0.8 + Math.random() * 0.4);
      const r = (platformStats.totalConversions / 14) * (0.6 + Math.random() * 0.8);
      return {
        day: `J-${13-i}`,
        cpa: r > 0 ? s / r : 0,
        conversions: Math.round(r)
      };
    });
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
            AdiVision Matrix • {platformStats.clientCount} Flux de données actifs
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
        <MacroKPI label="Global Results" value={platformStats.totalConversions.toLocaleString()} sub="Toutes Campagnes" color="purple" />
        <MacroKPI label="Global CPA" value={format(platformStats.avgCPA, 'USD', 2)} sub="Moyenne Plateforme" color="emerald" />
        <MacroKPI label="Active Nodes" value={platformStats.activeCampaigns.toString()} sub="Flux de Données Temps Réel" color="blue" />
      </div>

      {/* 3. Global Analytics Matrix & AI Console */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Performance Chart */}
        <div className="xl:col-span-2 bg-white rounded-[3rem] p-10 border border-slate-200 shadow-xl space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Performance Matrix</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Corrélation Plateforme : Coût / Résultat (Émeraude) vs Volume (Violet)</p>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={performanceTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorConvs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#10b981'}} tickFormatter={(v) => `${v}${currency==='EUR'?'€':'$'}`} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#a855f7'}} />
                
                <Tooltip 
                  contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '15px'}}
                  labelStyle={{fontWeight: 'black', textTransform: 'uppercase', fontSize: '10px', color: '#64748b', marginBottom: '5px'}}
                  formatter={(value: any, name: string) => {
                    if (name === "CPA Moyen") return [format(value, 'USD', 2), name];
                    return [value, name];
                  }}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase' }} />
                
                <Area 
                  yAxisId="right"
                  name="Volume Global"
                  type="monotone" 
                  dataKey="conversions" 
                  stroke="#a855f7" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorConvs)" 
                />
                
                <Line 
                  yAxisId="left"
                  name="CPA Moyen"
                  type="monotone" 
                  dataKey="cpa" 
                  stroke="#10b981" 
                  strokeWidth={4} 
                  dot={{r: 4, fill: '#10b981'}} 
                />
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
