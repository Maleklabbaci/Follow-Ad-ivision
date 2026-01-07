
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
  
  // Filtrage strict : seules les campagnes portées par des clients
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

  const avgRoas = certifiedCampaigns.length > 0 ? (totals.roas / certifiedCampaigns.length).toFixed(2) : '0.00';

  const clientPerformances = useMemo(() => {
    return clients.map(client => {
      const related = campaigns.filter(cp => client.campaignIds.includes(cp.campaignId));
      const spend = related.reduce((sum, cp) => sum + cp.spend, 0);
      const conv = related.reduce((sum, cp) => sum + cp.conversions, 0);
      const roas = related.length > 0 ? related.reduce((sum, cp) => sum + cp.roas, 0) / related.length : 0;
      return { name: client.name, spend, conv, roas, id: client.id };
    }).sort((a, b) => b.spend - a.spend);
  }, [clients, campaigns]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Intelligence Agence</h2>
          <p className="text-slate-500 text-sm mt-1">Données consolidées de {certifiedCampaigns.length} campagnes certifiées.</p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <span className="text-xs font-black uppercase tracking-widest">Moteur de calcul actif</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPIItem label="Investissement Réel" value={`$${totals.spend.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} trend="+12%" />
        <KPIItem label="Résultats Clients" value={totals.conv.toString()} trend="+5%" />
        <KPIItem label="ROAS Moyen Agence" value={`${avgRoas}x`} trend="+0.4" isPositive />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold text-slate-800">Dépenses par Portefeuille</h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Comparaison Directe</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientPerformances} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }} />
                <Bar dataKey="spend" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={20}>
                  {clientPerformances.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl shadow-blue-100 flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">Statut Technique</h3>
            <p className="text-slate-400 text-sm">Toutes les campagnes assignées sont surveillées par le Pulse.</p>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-xs font-bold text-slate-500">Intégrité des données</span>
              <span className="text-lg font-black text-emerald-400">100%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full w-full"></div>
            </div>
          </div>
          <button 
            onClick={() => navigate('/admin/campaigns')}
            className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-bold transition-all"
          >
            Voir le détail technique
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <h3 className="text-xl font-bold text-slate-800">Vrai Calcul par Client</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-5">Identité Client</th>
                <th className="px-8 py-5">Campagnes</th>
                <th className="px-8 py-5 text-right">Spend</th>
                <th className="px-8 py-5 text-right">ROAS Moyen</th>
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientPerformances.map((stat) => (
                <tr key={stat.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="font-bold text-slate-900">{stat.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Portfolio Certifié</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">CP</div>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right font-black text-slate-900">${stat.spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className={`px-8 py-6 text-right font-black ${stat.roas > 4 ? 'text-emerald-600' : 'text-slate-600'}`}>{stat.roas.toFixed(2)}x</td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => navigate(`/client/dashboard/${stat.id}`)} 
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-xl transition-all"
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
    </div>
  );
};

const KPIItem = ({ label, value, trend, isPositive = true }: { label: string, value: string, trend: string, isPositive?: boolean }) => (
  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <div className="flex items-baseline gap-3">
      <span className="text-3xl font-black text-slate-900 tabular-nums">{value}</span>
      <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{trend}</span>
    </div>
  </div>
);

export default AdminDashboard;
