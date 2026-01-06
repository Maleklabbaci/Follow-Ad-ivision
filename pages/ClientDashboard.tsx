import React, { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { User, CampaignStats, Client, IntegrationSecret, UserRole } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ClientInsights from './ClientInsights';

interface ClientDashboardProps {
  user: User;
  campaigns: CampaignStats[];
  clients: Client[];
  secrets: IntegrationSecret[];
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ user, campaigns, clients, secrets }) => {
  const { clientId } = useParams<{ clientId?: string }>();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const activeClientId = user.role === UserRole.ADMIN ? clientId : user.clientId;
  
  const activeClient = useMemo(() => {
    return clients.find(c => c.id === activeClientId);
  }, [clients, activeClientId]);

  const clientCampaigns = useMemo(() => {
    if (!activeClient) return [];
    return campaigns.filter(c => activeClient.campaignIds.includes(c.campaignId));
  }, [campaigns, activeClient]);

  // Déclencher un effet visuel à chaque mise à jour des campagnes
  useEffect(() => {
    setLastUpdate(new Date());
  }, [campaigns]);

  const totals = useMemo(() => {
    return clientCampaigns.reduce((acc, c) => ({
      spend: acc.spend + c.spend,
      conv: acc.conv + c.conversions,
      roas: acc.roas + c.roas,
      clicks: acc.clicks + c.clicks,
      impressions: acc.impressions + c.impressions
    }), { spend: 0, conv: 0, roas: 0, clicks: 0, impressions: 0 });
  }, [clientCampaigns]);

  const avgRoas = clientCampaigns.length ? (totals.roas / clientCampaigns.length).toFixed(2) : '0.00';
  const globalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100).toFixed(2) : '0.00';

  const chartData = [
    { name: 'Week 1', spend: 240, conv: 12 },
    { name: 'Week 2', spend: 480, conv: 25 },
    { name: 'Week 3', spend: 320, conv: 18 },
    { name: 'Week 4', spend: totals.spend / 4, conv: totals.conv / 4 },
  ];

  if (!activeClient && user.role === UserRole.ADMIN && clientId) {
    return <div className="p-12 text-center text-slate-500 font-medium">Client introuvable dans le portefeuille.</div>;
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900">Tableau de bord de performance</h2>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold border border-emerald-100 animate-pulse">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              LIVE DATA
            </div>
          </div>
          <p className="text-slate-500 text-sm flex items-center gap-1">
            Dernière actualisation : {lastUpdate.toLocaleTimeString()} 
            <span className="text-slate-300">•</span> 
            {activeClient?.name}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            30 derniers jours
          </button>
          <button className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            Exporter Rapport
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIBox label="Dépenses Totales" value={`$${totals.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={<DollarIcon />} color="blue" />
        <KPIBox label="Conversions" value={totals.conv.toString()} icon={<CartIcon />} color="emerald" />
        <KPIBox label="ROAS Moyen" value={`${avgRoas}x`} icon={<TrendIcon />} color="indigo" />
        <KPIBox label="CTR Global" value={`${globalCtr}%`} icon={<PointerIcon />} color="amber" />
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 text-slate-800">Évolution des Conversions</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="conv" stroke="#10b981" fillOpacity={1} fill="url(#colorConv)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ClientInsights user={activeClient ? { ...user, name: activeClient.name, clientId: activeClient.id } : user} campaigns={campaigns} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-800">Détails des Campagnes</h3>
          <span className="text-xs text-slate-400 font-mono">Calculs basés sur Meta API v19.0</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Nom de la Campagne</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Dépenses</th>
                <th className="px-6 py-4 text-right">Clicks</th>
                <th className="px-6 py-4 text-right">Conv.</th>
                <th className="px-6 py-4 text-right">ROAS</th>
                <th className="px-6 py-4 text-right">CTR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientCampaigns.length > 0 ? (
                clientCampaigns.map(cp => (
                  <tr key={cp.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-900">{cp.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cp.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                        {cp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">${cp.spend.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{cp.clicks}</td>
                    <td className="px-6 py-4 text-right text-slate-900 font-semibold">{cp.conversions}</td>
                    <td className="px-6 py-4 text-right text-indigo-600 font-bold">{cp.roas.toFixed(2)}x</td>
                    <td className="px-6 py-4 text-right text-slate-500">{(cp.ctr * 100).toFixed(2)}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    Aucune campagne liée trouvée pour ce client.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const KPIBox = ({ label, value, icon, color }: { label: string, value: string, icon: any, color: string }) => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };
  return (
    <div className={`bg-white p-5 rounded-xl border ${colorClasses[color]} shadow-sm flex items-center gap-4 transition-all hover:shadow-md`}>
      <div className={`p-3 rounded-lg ${colorClasses[color].split(' ')[0]} ${colorClasses[color].split(' ')[1]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900 tabular-nums">{value}</p>
      </div>
    </div>
  );
};

const DollarIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const CartIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
);
const TrendIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);
const PointerIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
  </svg>
);

export default ClientDashboard;