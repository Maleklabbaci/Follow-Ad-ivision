import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, CampaignStats, IntegrationSecret } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getCampaignInsights } from '../services/geminiService';
import { useCurrency } from '../contexts/CurrencyContext';
import { decryptSecret } from '../services/cryptoService';

interface AdminDashboardProps {
  clients: Client[];
  campaigns: CampaignStats[];
  secrets: IntegrationSecret[];
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#6366f1', '#ec4899'];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ clients, campaigns, secrets }) => {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [selectedClientForAi, setSelectedClientForAi] = useState<string>('all');
  const { format, convert } = useCurrency();
  
  const certifiedCampaigns = useMemo(() => {
    const allLinkedIds = new Set(clients.flatMap(c => c.campaignIds));
    const filtered = campaigns.filter(cp => cp && allLinkedIds.has(cp.campaignId));
    
    if (selectedClientForAi === 'all') return filtered;
    
    const client = clients.find(c => c.id === selectedClientForAi);
    if (!client) return filtered;
    
    return filtered.filter(cp => client.campaignIds.includes(cp.campaignId));
  }, [clients, campaigns, selectedClientForAi]);

  const totals = useMemo(() => {
    return certifiedCampaigns.reduce((acc, c) => ({
      spend: acc.spend + (Number(c.spend) || 0),
      conv: acc.conv + (c.conversations_started || 0),
      clicks: acc.clicks + (c.clicks || 0),
      impressions: acc.impressions + (c.impressions || 0),
      reach: acc.reach + (c.reach || 0),
    }), { spend: 0, conv: 0, clicks: 0, impressions: 0, reach: 0 });
  }, [certifiedCampaigns]);

  const integrityScore = useMemo(() => {
    if (certifiedCampaigns.length === 0) return 0;
    const validated = certifiedCampaigns.filter(c => c.isValidated).length;
    return Math.round((validated / certifiedCampaigns.length) * 100);
  }, [certifiedCampaigns]);

  const globalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100).toFixed(2) : '0.00';
  const globalCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  const globalCpa = totals.conv > 0 ? (totals.spend / totals.conv) : 0;
  
  const clientPerformances = useMemo(() => {
    return clients.map(client => {
      const related = campaigns.filter(cp => cp && client.campaignIds.includes(cp.campaignId));
      const spend = related.reduce((sum, cp) => sum + (Number(cp.spend) || 0), 0); 
      const clicks = related.reduce((sum, cp) => sum + (cp.clicks || 0), 0);
      const imps = related.reduce((sum, cp) => sum + (cp.impressions || 0), 0);
      const ctr = imps > 0 ? (clicks / imps) * 100 : 0;
      return { 
        name: client.name, 
        spendRaw: spend,
        spendConverted: convert(spend), 
        conv: related.reduce((sum, cp) => sum + (cp.conversations_started || 0), 0), 
        ctr, 
        id: client.id, 
        count: related.length 
      };
    }).sort((a, b) => b.spendRaw - a.spendRaw);
  }, [clients, campaigns, convert]);

  const generateReport = async () => {
    if (certifiedCampaigns.length === 0) {
      alert("Aucune donnée disponible pour l'audit.");
      return;
    }
    setIsGenerating(true);
    setAiReport(null);
    try {
      const aiSecret = secrets.find(s => s.type === 'AI');
      let apiKey = undefined;
      if (aiSecret && aiSecret.value !== 'managed_by_env') {
        apiKey = await decryptSecret(aiSecret.value);
      }

      const report = await getCampaignInsights(certifiedCampaigns, apiKey);
      setAiReport(report);
    } catch (err: any) {
      alert(`Erreur IA : ${err.message || "Problème lors de la génération du rapport."}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Vue Agency Certifiée</h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">Analyse consolidée de {certifiedCampaigns.length} campagnes.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Score d'intégrité</p>
                <p className="text-sm font-black text-blue-600">{integrityScore}%</p>
              </div>
              <div className="w-10 h-10 rounded-full border-4 border-slate-100 flex items-center justify-center relative">
                 <svg className="w-10 h-10 absolute -rotate-90">
                    <circle cx="20" cy="20" r="16" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-blue-500" strokeDasharray={100} strokeDashoffset={100 - integrityScore} />
                 </svg>
                 <span className="text-[10px] font-bold text-slate-500">✓</span>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPIItem label="Ad Spend" value={format(totals.spend)} trend="+14.2%" subtitle="Budget Piloté" />
        <KPIItem label="Reach Total" value={totals.reach.toLocaleString()} trend="+12k" subtitle="Unique Viewers" />
        <KPIItem label="Conv. Started" value={totals.conv.toLocaleString()} trend="+6.8%" subtitle="Messaging Goal" />
        <KPIItem label="CPA Started" value={format(globalCpa)} trend="Avg" subtitle="Cost Per Message" />
        <KPIItem label="CTR Moyen" value={`${globalCtr}%`} trend="+0.15%" subtitle="Global Account" />
        <KPIItem label="CPM Global" value={format(globalCpm)} trend="Avg" subtitle="Cost Per 1k Imps" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-xl font-bold text-slate-800">Dépense par Client</h3>
              <p className="text-xs text-slate-400 mt-1 uppercase font-black tracking-widest">Volume budgétaire certifié</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientPerformances} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
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

        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500"></div>
          <h3 className="text-lg font-black uppercase italic tracking-tight mb-6 text-center w-full flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            AI Strategist
          </h3>
          
          <div className="w-full space-y-4 mb-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Périmètre Audit (Started)</label>
              <select 
                value={selectedClientForAi}
                onChange={(e) => setSelectedClientForAi(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-300"
              >
                <option value="all" className="bg-slate-900">Portfolio Global</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900">Focus: {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-60">
             <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
             </div>
             <p className="text-[9px] font-bold uppercase tracking-widest max-w-[150px]">
               Analyse focus conversations et santé créative.
             </p>
          </div>

          <button 
            onClick={generateReport}
            disabled={isGenerating}
            className="w-full py-4 mt-8 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3"
          >
            {isGenerating ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              'Générer Audit Started'
            )}
          </button>
        </div>
      </div>

      {aiReport && (
        <div className="bg-white p-8 md:p-12 rounded-[2rem] border border-slate-200 shadow-2xl animate-in slide-in-from-bottom-4 duration-500 relative overflow-hidden">
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <h3 className="text-xl font-black italic uppercase tracking-tight text-slate-900">Verdict Stratégique</h3>
              </div>
              <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">
                Métrique Cible : <span className="text-blue-600">Started Conversations</span>
              </p>
            </div>
            <button onClick={() => setAiReport(null)} className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed font-medium">
            {aiReport.split('\n').map((line, i) => {
               if (line.trim() === '') return <br key={i} />;
               const isHeading = line.match(/^\d\./) || line.startsWith('#');
               return <p key={i} className={isHeading ? 'text-slate-900 font-black uppercase mt-4 first:mt-0' : 'pl-4 border-l-2 border-blue-50'}>{line}</p>;
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const KPIItem = ({ label, value, trend, subtitle }: any) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:-translate-y-1 transition-all duration-300 group">
    <div className="flex justify-between items-start mb-4">
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <span className="text-[8px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{trend}</span>
    </div>
    <div className="text-2xl font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">{value}</div>
    <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1 italic">{subtitle}</div>
  </div>
);

export default AdminDashboard;