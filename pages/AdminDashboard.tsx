
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, CampaignStats } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface AdminDashboardProps {
  clients: Client[];
  campaigns: CampaignStats[];
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#6366f1', '#ec4899'];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ clients, campaigns }) => {
  const navigate = useNavigate();
  
  // 1. Filtrer UNIQUEMENT les campagnes qui appartiennent à au moins un client
  const linkedCampaigns = useMemo(() => {
    const allLinkedIds = new Set(clients.flatMap(c => c.campaignIds));
    return campaigns.filter(cp => allLinkedIds.has(cp.campaignId));
  }, [clients, campaigns]);

  // 2. Calculs basés exclusivement sur les campagnes liées
  const totals = useMemo(() => {
    return linkedCampaigns.reduce((acc, c) => ({
      spend: acc.spend + c.spend,
      conv: acc.conv + c.conversions,
      roas: acc.roas + c.roas,
      clicks: acc.clicks + c.clicks
    }), { spend: 0, conv: 0, roas: 0, clicks: 0 });
  }, [linkedCampaigns]);

  const avgRoas = linkedCampaigns.length > 0 ? (totals.roas / linkedCampaigns.length).toFixed(2) : '0.00';

  const clientStats = useMemo(() => {
    return clients.map(client => {
      const related = campaigns.filter(cp => client.campaignIds.includes(cp.campaignId));
      const spend = related.reduce((sum, cp) => sum + cp.spend, 0);
      const conv = related.reduce((sum, cp) => sum + cp.conversions, 0);
      const roas = related.length > 0 ? related.reduce((sum, cp) => sum + cp.roas, 0) / related.length : 0;
      return { name: client.name, spend, conv, roas, id: client.id };
    }).sort((a, b) => b.spend - a.spend);
  }, [clients, campaigns]);

  const topCampaigns = useMemo(() => {
    return [...linkedCampaigns].sort((a, b) => b.roas - a.roas).slice(0, 5);
  }, [linkedCampaigns]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Vue Consolidée Agence</h2>
          <p className="text-slate-500 text-sm mt-1">Analyse basée sur {linkedCampaigns.length} campagnes actives liées.</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
          </div>
          <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Calculs Temps Réel</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard label="Ad Spend Total" value={`$${totals.spend.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} delta="+15.2%" subtitle="Campagnes Liées" />
        <StatsCard label="Conversions Web" value={totals.conv.toString()} delta="+8.4%" subtitle="Volume Total" />
        <StatsCard label="ROAS Moyen Portfolio" value={`${avgRoas}x`} delta="+2.1%" subtitle="Performance Globale" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold mb-6 text-slate-800">Répartition du Budget par Client</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={120} axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                <Bar dataKey="spend" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={24}>
                  {clientStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">Top ROAS</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Actives</span>
          </div>
          <div className="space-y-4">
            {topCampaigns.map((cp, idx) => (
              <div key={cp.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-300 w-4">#0{idx + 1}</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800 line-clamp-1">{cp.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Spend: ${cp.spend.toFixed(0)}</p>
                  </div>
                </div>
                <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg text-xs font-black">
                  {cp.roas.toFixed(2)}x
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800">Santé du Portefeuille</h3>
        </div>
        <table className="w-full text-left">
          <thead className="bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Client</th>
              <th className="px-6 py-4">Investissement</th>
              <th className="px-6 py-4">ROAS Moyen</th>
              <th className="px-6 py-4">Conversions</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clientStats.map((stat) => (
              <tr key={stat.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-6 py-5">
                  <div className="font-bold text-slate-900">{stat.name}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Compte Partenaire</div>
                </td>
                <td className="px-6 py-5 font-bold text-slate-900">${stat.spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-2">
                    <span className={`font-black ${stat.roas > 4 ? 'text-emerald-600' : 'text-slate-600'}`}>{stat.roas.toFixed(2)}x</span>
                    <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden hidden sm:block">
                      <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(stat.roas * 10, 100)}%` }}></div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 text-slate-700 font-medium">{stat.conv} units</td>
                <td className="px-6 py-5 text-right">
                  <button 
                    onClick={() => navigate(`/client/dashboard/${stat.id}`)} 
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm"
                  >
                    Détails
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatsCard = ({ label, value, delta, subtitle }: { label: string, value: string, delta: string, subtitle: string }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <div className="flex items-baseline gap-2 mb-4">
      <span className="text-3xl font-black text-slate-900 tabular-nums">{value}</span>
      <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-lg border border-emerald-100">{delta}</span>
    </div>
    <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{subtitle}</span>
      <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
    </div>
  </div>
);

export default AdminDashboard;
