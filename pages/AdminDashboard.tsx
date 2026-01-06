import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, CampaignStats } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface AdminDashboardProps {
  clients: Client[];
  campaigns: CampaignStats[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ clients, campaigns }) => {
  const navigate = useNavigate();
  
  const totals = useMemo(() => {
    return campaigns.reduce((acc, c) => ({
      spend: acc.spend + c.spend,
      conv: acc.conv + c.conversions,
      clicks: acc.clicks + c.clicks,
      roas: acc.roas + c.roas
    }), { spend: 0, conv: 0, clicks: 0, roas: 0 });
  }, [campaigns]);

  const avgRoas = campaigns.length > 0 ? (totals.roas / campaigns.length).toFixed(2) : '0.00';

  const chartData = useMemo(() => {
    return [
      { date: 'Lun', spend: totals.spend * 0.1, conv: Math.floor(totals.conv * 0.08) },
      { date: 'Mar', spend: totals.spend * 0.12, conv: Math.floor(totals.conv * 0.1) },
      { date: 'Mer', spend: totals.spend * 0.15, conv: Math.floor(totals.conv * 0.14) },
      { date: 'Jeu', spend: totals.spend * 0.14, conv: Math.floor(totals.conv * 0.15) },
      { date: 'Ven', spend: totals.spend * 0.18, conv: Math.floor(totals.conv * 0.19) },
      { date: 'Sam', spend: totals.spend * 0.16, conv: Math.floor(totals.conv * 0.17) },
      { date: 'Dim', spend: totals.spend * 0.15, conv: Math.floor(totals.conv * 0.16) },
    ];
  }, [totals]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Vue d'ensemble de l'agence</h2>
        <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-tighter">Live Monitor</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard label="Dépenses Totales" value={`$${totals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} delta="+12.5%" />
        <StatsCard label="Conversions Globales" value={totals.conv.toString()} delta="+8.1%" />
        <StatsCard label="ROAS Moyen Agence" value={`${avgRoas}x`} delta="-2.1%" negative />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">Tendance des Dépenses</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="spend" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">Volume de Conversions</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="conv" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-800">Portefeuille Clients Actif</h3>
          <button 
            onClick={() => navigate('/admin/clients')}
            className="text-sm text-blue-600 font-medium hover:underline px-3 py-1 rounded hover:bg-blue-50 transition-colors"
          >
            Gérer Clients
          </button>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Client</th>
              <th className="px-6 py-4">Comptes Pub.</th>
              <th className="px-6 py-4">Dépenses 30j</th>
              <th className="px-6 py-4">Status Pulse</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map(client => {
              const clientSpend = campaigns
                .filter(cp => client.campaignIds.includes(cp.campaignId))
                .reduce((sum, cp) => sum + cp.spend, 0);
                
              return (
                <tr key={client.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-slate-900">{client.name}</td>
                  <td className="px-6 py-4 text-slate-600">{client.adAccounts.length} liés</td>
                  <td className="px-6 py-4 text-slate-900 font-bold">${clientSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      Actif
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatsCard = ({ label, value, delta, negative = false }: { label: string, value: string, delta: string, negative?: boolean }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-transform hover:scale-[1.02]">
    <div className="flex justify-between items-start mb-2">
      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${negative ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
        {delta}
      </span>
    </div>
    <div className="text-3xl font-bold text-slate-900 tabular-nums">{value}</div>
  </div>
);

export default AdminDashboard;