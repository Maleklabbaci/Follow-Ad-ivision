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
  
  // FILTRE DE CONFIANCE : Uniquement les campagnes portées par des clients réels
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
      return { name: client.name, spend, conv, roas, id: client.id, count: related.length };
    }).sort((a, b) => b.spend - a.spend);
  }, [clients, campaigns]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Vue Consolidée Certifiée</h2>
          <p className="text-slate-500 text-sm mt-1">Calculs basés sur {certifiedCampaigns.length} campagnes assignées.</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black border border-blue-100 uppercase tracking-tighter">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
            Sync Automatique
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPIItem label="Ad Spend Portfolio" value={`$${totals.spend.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} trend="+12%" />
        <KPIItem label="Conversions Totales" value={totals.conv.toString()} trend="+8%" />
        <KPIItem label="ROAS Global" value={`${avgRoas}x`} trend="+0.2" isPositive />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold text-slate-800">Dépenses par Client</h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Temps Réel</span>
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

        <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl flex flex-col justify-between group">
          <div>
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Moteur de Calcul</h3>
            <p className="text-slate-400 text-sm leading-relaxed">Chaque ID de campagne ajouté à un client est immédiatement pris en charge par notre moteur de traitement analytique.</p>
          </div>
          <div className="pt-8 border-t border-white/10 mt-8 space-y-4">
             <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-slate-500 uppercase">Intégrité Sync</span>
                <span className="text-sm font-black text-emerald-400">OPTIMALE</span>
             </div>
             <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[100%]"></div>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <h3 className="text-xl font-bold text-slate-800">Portefeuille Actif</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-5">Client</th>
                <th className="px-8 py-5">Campagnes</th>
                <th className="px-8 py-5 text-right">Spend Total</th>
                <th className="px-8 py-5 text-right">ROAS Moyen</th>
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientPerformances.map((stat) => (
                <tr key={stat.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="font-bold text-slate-900">{stat.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Compte Rattaché</div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                      {stat.count} actives
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right font-black text-slate-900 tabular-nums">${stat.spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className={`px-8 py-6 text-right font-black tabular-nums ${stat.roas > 4 ? 'text-emerald-600' : 'text-slate-600'}`}>{stat.roas.toFixed(2)}x</td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => navigate(`/client/dashboard/${stat.id}`)} 
                      className="text-xs font-black text-blue-600 hover:text-white hover:bg-blue-600 bg-blue-50 px-4 py-2 rounded-xl transition-all border border-blue-100 hover:border-blue-600"
                    >
                      DÉTAILS
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