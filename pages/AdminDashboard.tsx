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
  
  const totals = useMemo(() => {
    return campaigns.reduce((acc, c) => ({
      spend: acc.spend + c.spend,
      conv: acc.conv + c.conversions,
      roas: acc.roas + c.roas,
      impressions: acc.impressions + c.impressions
    }), { spend: 0, conv: 0, roas: 0, impressions: 0 });
  }, [campaigns]);

  const avgRoas = campaigns.length > 0 ? (totals.roas / campaigns.length).toFixed(2) : '0.00';

  const clientStats = useMemo(() => {
    return clients.map(client => {
      const related = campaigns.filter(cp => client.campaignIds.includes(cp.campaignId));
      const spend = related.reduce((sum, cp) => sum + cp.spend, 0);
      const conv = related.reduce((sum, cp) => sum + cp.conversions, 0);
      const roas = related.length > 0 ? related.reduce((sum, cp) => sum + cp.roas, 0) / related.length : 0;
      return { name: client.name, spend, conv, roas };
    });
  }, [clients, campaigns]);

  const topCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => b.roas - a.roas).slice(0, 5);
  }, [campaigns]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Performance Globale Agence</h2>
          <p className="text-slate-500 text-sm mt-1">Données consolidées de {clients.length} clients en temps réel.</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Live Pulse Tracking</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard label="Ad Spend Global" value={`$${totals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} delta="+15.2%" subtitle="VS Mois Dernier" />
        <StatsCard label="Conversions" value={totals.conv.toString()} delta="+8.4%" subtitle="Tous Comptes" />
        <StatsCard label="ROAS Moyen" value={`${avgRoas}x`} delta="+2.1%" subtitle="Performance Agence" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graphique de répartition des dépenses par client */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold mb-6 text-slate-800">Dépenses par Client</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={120} axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500 }} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                <Bar dataKey="spend" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={32}>
                  {clientStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 5 Campagnes ROAS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold mb-6 text-slate-800">Top 5 ROAS</h3>
          <div className="space-y-5">
            {topCampaigns.map((cp, idx) => (
              <div key={cp.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 line-clamp-1">{cp.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">ID: {cp.campaignId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600">{cp.roas.toFixed(2)}x</p>
                  <p className="text-[10px] text-slate-400">ROAS</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800">État de Santé des Comptes Clients</h3>
          <button onClick={() => navigate('/admin/clients')} className="text-sm font-bold text-blue-600 hover:text-blue-700">Gérer tout le portfolio →</button>
        </div>
        <table className="w-full text-left">
          <thead className="bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Client</th>
              <th className="px-6 py-4">Dépenses</th>
              <th className="px-6 py-4">ROAS Moy.</th>
              <th className="px-6 py-4">Conversions</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clientStats.map((stat, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-5">
                  <div className="font-bold text-slate-900">{stat.name}</div>
                  <div className="text-xs text-slate-400">Agence Premium</div>
                </td>
                <td className="px-6 py-5 font-semibold text-slate-900">${stat.spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className={`px-6 py-5 font-bold ${stat.roas > 4 ? 'text-emerald-600' : 'text-slate-600'}`}>{stat.roas.toFixed(2)}x</td>
                <td className="px-6 py-5 text-slate-900">{stat.conv}</td>
                <td className="px-6 py-5">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-100 uppercase">
                    Optimal
                  </span>
                </td>
                <td className="px-6 py-5">
                  <button onClick={() => navigate(`/client/dashboard/${clients.find(c => c.name === stat.name)?.id}`)} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-blue-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
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
      <span className="text-3xl font-black text-slate-900">{value}</span>
      <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">{delta}</span>
    </div>
    <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{subtitle}</span>
      <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
    </div>
  </div>
);

export default AdminDashboard;