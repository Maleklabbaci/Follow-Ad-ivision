
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, CampaignStats, IntegrationSecret } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getCampaignInsights, getBudgetForecast, getCopywritingSuggestions, getAnomalyDetection } from '../services/geminiService';
import { useCurrency } from '../contexts/CurrencyContext';

interface AdminDashboardProps {
  clients: Client[];
  campaigns: CampaignStats[];
  secrets: IntegrationSecret[];
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#6366f1', '#ec4899'];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ clients, campaigns, secrets }) => {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isForecasting, setIsForecasting] = useState(false);
  const [isCopywriting, setIsCopywriting] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  
  const [aiResult, setAiResult] = useState<{ type: string, content: string } | null>(null);
  const [selectedClientForAi, setSelectedClientForAi] = useState<string>('all');
  const { format, currency } = useCurrency();
  
  const certifiedCampaigns = useMemo(() => {
    const allLinkedIds = new Set(clients.flatMap(c => c.campaignIds));
    const filtered = campaigns.filter(cp => cp && allLinkedIds.has(cp.campaignId));
    if (selectedClientForAi === 'all') return filtered;
    const client = clients.find(c => c.id === selectedClientForAi);
    return client ? filtered.filter(cp => client.campaignIds.includes(cp.campaignId)) : filtered;
  }, [clients, campaigns, selectedClientForAi]);

  const totals = useMemo(() => {
    return certifiedCampaigns.reduce((acc, c) => ({
      spend: acc.spend + (Number(c.spend) || 0),
      conv: acc.conv + (c.conversions || 0),
      clicks: acc.clicks + (c.clicks || 0),
      impressions: acc.impressions + (c.impressions || 0),
      reach: acc.reach + (c.reach || 0),
    }), { spend: 0, conv: 0, clicks: 0, impressions: 0, reach: 0 });
  }, [certifiedCampaigns]);

  const globalCpa = totals.conv > 0 ? (totals.spend / totals.conv) : 0;
  
  const clientPerformances = useMemo(() => {
    return clients.map(client => {
      const related = campaigns.filter(cp => cp && client.campaignIds.includes(cp.campaignId));
      const spend = related.reduce((sum, cp) => sum + (Number(cp.spend) || 0), 0); 
      return { 
        // FIX: Uppercase name in data mapping to avoid using unsupported 'textTransform' in SVG tick object
        name: (client.name || '').toUpperCase(), 
        spendRaw: spend,
        conv: related.reduce((sum, cp) => sum + (cp.conversions || 0), 0), 
      };
    }).sort((a, b) => b.spendRaw - a.spendRaw);
  }, [clients, campaigns]);

  const runAiTask = async (task: 'AUDIT' | 'FORECAST' | 'COPY' | 'ANOMALY') => {
    if (certifiedCampaigns.length === 0) return;
    
    const setters: any = { AUDIT: setIsGenerating, FORECAST: setIsForecasting, COPY: setIsCopywriting, ANOMALY: setIsDetecting };
    setters[task](true);
    setAiResult(null);

    try {
      let res = "";
      // FIX: Removed manual apiKey passing as the service now handles API Key via environment variables exclusively.
      if (task === 'AUDIT') res = await getCampaignInsights(certifiedCampaigns);
      if (task === 'FORECAST') res = await getBudgetForecast(certifiedCampaigns);
      if (task === 'COPY') res = await getCopywritingSuggestions(certifiedCampaigns);
      if (task === 'ANOMALY') res = await getAnomalyDetection(certifiedCampaigns);
      
      setAiResult({ type: task, content: res });
    } catch (err: any) {
      alert(`Erreur IA : ${err.message}`);
    } finally { 
      setters[task](false); 
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Vue Agency Certifiée</h2>
          <p className="text-slate-500 text-sm mt-1 font-medium italic uppercase tracking-widest">Multi-Cloud Intelligence Dashboard</p>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPIItem label="Ad Spend" value={format(totals.spend)} trend="+14%" subtitle="Budget Piloté" />
        <KPIItem label="Reach Total" value={totals.reach.toLocaleString()} trend="+12k" subtitle="Unique Viewers" />
        <KPIItem label="Conversions" value={totals.conv.toLocaleString()} trend="+6%" subtitle="Total Leads" />
        <KPIItem label="CPA" value={format(globalCpa, 'USD', 4)} trend="Avg" subtitle="Cost Per Conv" />
        <KPIItem label="CTR Moyen" value={`${(totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0).toFixed(2)}%`} trend="+0.1%" subtitle="Global CTR" />
        <KPIItem label="CPM Global" value={format(totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0)} trend="Avg" subtitle="Cost Per 1k" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts Section */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-800 italic uppercase tracking-tighter">Volume par Client</h3>
              <p className="text-xs text-slate-400 mt-1 uppercase font-black tracking-widest">Répartition budgétaire active</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientPerformances} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                {/* FIX: Removed 'textTransform' property from tick object to resolve 'No overload matches this call' error */}
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={110} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} 
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }} 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: any) => [format(value, 'USD'), 'Dépense']}
                />
                <Bar dataKey="spendRaw" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={24}>
                  {clientPerformances.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Enhanced AI Lab Section */}
        <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl flex flex-col relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500"></div>
          
          <h3 className="text-xl font-black uppercase italic tracking-tighter mb-8 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            AI Lab Hub
          </h3>
          
          <div className="space-y-6 flex-1">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Scope d'analyse</label>
              <select 
                value={selectedClientForAi}
                onChange={(e) => setSelectedClientForAi(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-300 uppercase tracking-widest"
              >
                <option value="all" className="bg-slate-900 font-black">Portefeuille Global</option>
                {clients.map(c => <option key={c.id} value={c.id} className="bg-slate-900 font-black">Focus: {c.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <AiTaskBtn label="Audit Stratégique" onClick={() => runAiTask('AUDIT')} loading={isGenerating} icon="📊" />
              <AiTaskBtn label="Prédictions Budget" onClick={() => runAiTask('FORECAST')} loading={isForecasting} icon="📈" color="blue" />
              <AiTaskBtn label="Générateur de Hooks" onClick={() => runAiTask('COPY')} loading={isCopywriting} icon="✍️" color="purple" />
              <AiTaskBtn label="Analyse Anomalies" onClick={() => runAiTask('ANOMALY')} loading={isDetecting} icon="⚠️" color="amber" />
            </div>
          </div>
          
          <p className="mt-8 text-[9px] font-bold text-slate-600 uppercase tracking-widest text-center italic">
            Moteur : Google Gemini 3 Flash • Certifié
          </p>
        </div>
      </div>

      {/* AI Results Display */}
      {aiResult && (
        <div className={`p-10 md:p-14 rounded-[3rem] border shadow-2xl animate-in slide-in-from-bottom-6 duration-700 relative overflow-hidden ${
          aiResult.type === 'ANOMALY' ? 'bg-amber-50 border-amber-200' : 
          aiResult.type === 'COPY' ? 'bg-indigo-950 text-white border-white/10' : 
          'bg-white border-slate-200'
        }`}>
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className={`text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3 ${
                aiResult.type === 'COPY' ? 'text-indigo-400' : 'text-slate-900'
              }`}>
                <span className={`w-2 h-2 rounded-full animate-ping ${aiResult.type === 'ANOMALY' ? 'bg-amber-500' : 'bg-blue-600'}`}></span>
                {aiResult.type === 'AUDIT' && 'Audit Stratégique Certifié'}
                {aiResult.type === 'FORECAST' && 'Projections de Croissance'}
                {aiResult.type === 'COPY' && 'Assistant Copywriting IA'}
                {aiResult.type === 'ANOMALY' && 'Alertes de Performance'}
              </h3>
              <p className="text-[10px] font-black uppercase tracking-widest mt-2 opacity-50">Analyse terminée • Client : {selectedClientForAi === 'all' ? 'Portfolio' : clients.find(c => c.id === selectedClientForAi)?.name}</p>
            </div>
            <button onClick={() => setAiResult(null)} className="p-2 opacity-40 hover:opacity-100 transition-opacity">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className={`prose prose-slate max-w-none font-bold leading-relaxed whitespace-pre-wrap border-l-4 pl-8 ${
            aiResult.type === 'ANOMALY' ? 'border-amber-400 text-amber-900' : 
            aiResult.type === 'COPY' ? 'border-indigo-500 text-indigo-100' : 
            'border-blue-600 text-slate-700'
          }`}>
            {aiResult.content}
          </div>
        </div>
      )}
    </div>
  );
};

const KPIItem = ({ label, value, trend, subtitle }: any) => (
  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:-translate-y-1.5 transition-all duration-300 group">
    <div className="flex justify-between items-start mb-6">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
      <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 italic">{trend}</span>
    </div>
    <div className="text-3xl font-black text-slate-900 tracking-tighter group-hover:text-blue-600 transition-colors italic">{value}</div>
    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1.5">{subtitle}</div>
  </div>
);

const AiTaskBtn = ({ label, onClick, loading, icon, color }: any) => {
  const styles: any = {
    blue: 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-900/40',
    purple: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-900/40',
    amber: 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-900/40',
    default: 'bg-white text-slate-900 hover:bg-slate-100'
  };
  return (
    <button 
      onClick={onClick}
      disabled={loading}
      className={`w-full py-4 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between active:scale-95 shadow-lg ${styles[color] || styles.default}`}
    >
      <span className="flex items-center gap-3">
        <span className="text-sm">{icon}</span>
        {label}
      </span>
      {loading ? <div className={`w-4 h-4 border-2 rounded-full animate-spin ${color ? 'border-white/20 border-t-white' : 'border-slate-300 border-t-slate-900'}`}></div> : <span className="opacity-40">→</span>}
    </button>
  );
};

export default AdminDashboard;
