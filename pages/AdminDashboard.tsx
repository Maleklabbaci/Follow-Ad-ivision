
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, CampaignStats } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface AdminDashboardProps {
  clients: Client[];
  campaigns: CampaignStats[];
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#6366f1', '#ec4899'];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ clients, campaigns }) => {
  const navigate = useNavigate();
  
  const certifiedCampaigns = useMemo(() => {
    const allLinkedIds = new Set(clients.flatMap(c => c.campaignIds));
    return campaigns.filter(cp => allLinkedIds.has(cp.campaignId));
  }, [clients, campaigns]);

  const totals = useMemo(() => {
    return certifiedCampaigns.reduce((acc, c) => ({
      spend: acc.spend + c.spend,
      conv: acc.conv + c.conversions,
      roas: acc.roas + c.roas,
      clicks: acc.clicks + c.clicks
    }), { spend: 0, conv: 0, roas: 0, clicks: 0 });
  }, [certifiedCampaigns]);

  const sourceData = useMemo(() => {
    const realCount = certifiedCampaigns.filter(c => c.dataSource === 'REAL_API').length;
    const mockCount = certifiedCampaigns.filter(c => c.dataSource === 'MOCK').length;
    return [
      { name: 'API Meta', value: realCount, color: '#2563eb' },
      { name: 'Simulé', value: mockCount, color: '#94a3b8' }
    ];
  }, [certifiedCampaigns]);

  const integrityScore = useMemo(() => {
    if (certifiedCampaigns.length === 0) return 0;
    const validated = certifiedCampaigns.filter(c => c.isValidated).length;
    return Math.round((validated / certifiedCampaigns.length) * 100);
  }, [certifiedCampaigns]);

  const avgRoas = certifiedCampaigns.length > 0 ? (totals.roas / certifiedCampaigns.length).toFixed(2) : '0.00';

  const clientPerformances = useMemo(() => {
    return clients.map(client => {
      const related = campaigns.filter(cp => client.campaignIds.includes(cp.campaignId));
      const spend = related.reduce((sum, cp) => sum + cp.spend, 0);
      const conv = related.reduce((sum, cp) => sum + cp.conversions, 0);
      const roas = related.length > 0 ? related.reduce((sum, cp) => sum + cp.roas, 0) / related.length : 0;
      return { name: client.name, spend, conv, roas, id: client.id, count: related.length };
    }).sort((a, b) => b.spend - a.spend);
  }, [clients, campaigns]);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Vue Agency Certifiée</h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">Audit en temps réel de {certifiedCampaigns.length} campagnes.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPIItem label="Ad Spend Global" value={`$${totals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} trend="+14.2%" subtitle="Portfolio audité" />
        <KPIItem label="Conversion Agency" value={totals.conv.toLocaleString()} trend="+6.8%" subtitle="Événements validés" />
        <KPIItem label="ROAS Consolidé" value={`${avgRoas}x`} trend="+0.4x" isPositive subtitle="Objectif: 4.0x" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-xl font-bold text-slate-800">Répartition du Budget</h3>
              <p className="text-xs text-slate-400 mt-1 uppercase font-black tracking-widest">Dépenses par compte client</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientPerformances} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={110} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }} />
                <Bar dataKey="spend" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={24}>
                  {clientPerformances.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
          <h3 className="text-lg font-bold text-slate-800 mb-6 text-center w-full">Provenance des Données</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2 w-full">
            {sourceData.map(s => (
              <div key={s.name} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></div>
                  <span className="text-xs font-bold text-slate-600">{s.name}</span>
                </div>
                <span className="text-xs font-black text-slate-900">{s.value} cp.</span>
              </div>
            ))}
          </div>
          <button 
            onClick={() => navigate('/admin/campaigns')}
            className="w-full py-3 mt-8 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
          >
            Lancer Audit Complet
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <h3 className="text-xl font-bold text-slate-800">Portefeuilles Actifs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-6">Client</th>
                <th className="px-8 py-6">Campagnes</th>
                <th className="px-8 py-6 text-right">Dépense Totale</th>
                <th className="px-8 py-6 text-right">ROAS Moyen</th>
                <th className="px-8 py-6 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientPerformances.map((stat) => (
                <tr key={stat.id} className="hover:bg-slate-50/80 transition-all group">
                  <td className="px-8 py-7">
                    <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{stat.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Compte Actif</div>
                  </td>
                  <td className="px-8 py-7">
                    <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black border border-slate-200">
                      {stat.count} actives
                    </span>
                  </td>
                  <td className="px-8 py-7 text-right font-black text-slate-900 tabular-nums text-lg">${stat.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="px-8 py-7 text-right">
                    <span className={`px-4 py-1.5 rounded-xl font-black tabular-nums text-sm ${stat.roas > 4 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                      {stat.roas.toFixed(2)}x
                    </span>
                  </td>
                  <td className="px-8 py-7 text-right">
                    <button 
                      onClick={() => navigate(`/client/dashboard/${stat.id}`)} 
                      className="text-[10px] font-black text-blue-600 hover:text-white hover:bg-blue-600 bg-blue-50 px-5 py-2.5 rounded-xl transition-all border border-blue-100 hover:border-blue-600 uppercase tracking-widest"
                    >
                      Audit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const KPIItem = ({ label, value, trend, isPositive = true, subtitle }: { label: string, value: string, trend: string, isPositive?: boolean, subtitle: string }) => (
  <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-blue-500 transition-colors">{label}</p>
    <div className="flex items-baseline gap-3 mb-4">
      <span className="text-4xl font-black text-slate-900 tabular-nums">{value}</span>
      <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${isPositive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>{trend}</span>
    </div>
    <div className="flex items-center gap-2 pt-4 border-t border-slate-50">
       <div className={`w-2 h-2 rounded-full ${isPositive ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{subtitle}</span>
    </div>
  </div>
);

export default AdminDashboard;
