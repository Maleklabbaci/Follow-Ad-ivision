import React, { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { User, CampaignStats, Client, IntegrationSecret, UserRole } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Bar } from 'recharts';
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
  const globalCpc = totals.clicks > 0 ? (totals.spend / totals.clicks).toFixed(2) : '0.00';

  // Simulation de données historiques basées sur les totaux actuels pour le graphique
  const chartData = useMemo(() => [
    { name: 'S-3', spend: totals.spend * 0.2, conv: Math.floor(totals.conv * 0.18) },
    { name: 'S-2', spend: totals.spend * 0.25, conv: Math.floor(totals.conv * 0.22) },
    { name: 'S-1', spend: totals.spend * 0.28, conv: Math.floor(totals.conv * 0.26) },
    { name: 'Now', spend: totals.spend * 0.32, conv: Math.floor(totals.conv * 0.34) },
  ], [totals]);

  if (!activeClient && user.role === UserRole.ADMIN && clientId) {
    return (
      <div className="p-20 flex flex-col items-center justify-center text-slate-400 space-y-4">
        <svg className="w-16 h-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-xl font-bold">Client introuvable</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{activeClient?.name}</h2>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black border border-blue-100 shadow-sm">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></span>
              COMPTE ACTIF
            </div>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Analyse consolidée des comptes publicitaires Meta • Mis à jour à {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button className="flex-1 md:flex-none px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
            Février 2024
          </button>
          <button className="flex-1 md:flex-none px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all shadow-lg">
            Télécharger Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPIBox label="Investissement" value={`$${totals.spend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} detail="Total Ad Spend" color="blue" />
        <KPIBox label="Résultats" value={totals.conv.toString()} detail="Conversions Web" color="emerald" />
        <KPIBox label="Rentabilité (ROAS)" value={`${avgRoas}x`} detail="Retour sur investissement" color="indigo" />
        <KPIBox label="Coût par Clic" value={`$${globalCpc}`} detail="Moyenne globale CPC" color="amber" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold text-slate-800">Tendances Performance</h3>
            <div className="flex gap-4">
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                 <span className="text-xs font-bold text-slate-400">Dépenses</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                 <span className="text-xs font-bold text-slate-400">Conversions</span>
               </div>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }} />
                <Bar dataKey="spend" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={40} />
                <Line type="monotone" dataKey="conv" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="xl:col-span-1">
           <ClientInsights user={activeClient ? { ...user, name: activeClient.name, clientId: activeClient.id } : user} campaigns={campaigns} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">Performance par Campagne</h3>
          <div className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black text-slate-400">META API v19.0</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Nom de la Campagne</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Spend</th>
                <th className="px-6 py-4 text-right">Conv.</th>
                <th className="px-6 py-4 text-right">ROAS</th>
                <th className="px-6 py-4 text-right">CTR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{cp.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{cp.campaignId}</div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase border ${cp.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {cp.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right font-semibold text-slate-900">${cp.spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-5 text-right text-slate-900 font-bold">{cp.conversions}</td>
                  <td className={`px-6 py-5 text-right font-black ${cp.roas > 5 ? 'text-emerald-600' : 'text-indigo-600'}`}>{cp.roas.toFixed(2)}x</td>
                  <td className="px-6 py-5 text-right text-slate-500 font-medium">{(cp.ctr * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const KPIBox = ({ label, value, detail, color }: { label: string, value: string, detail: string, color: string }) => {
  const styles: Record<string, string> = {
    blue: 'bg-blue-600 text-white shadow-blue-100',
    emerald: 'bg-white border-slate-200 text-slate-900',
    indigo: 'bg-indigo-600 text-white shadow-indigo-100',
    amber: 'bg-white border-slate-200 text-slate-900',
  };
  return (
    <div className={`p-6 rounded-2xl shadow-sm border transition-all hover:scale-[1.02] ${styles[color]}`}>
      <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${color === 'blue' || color === 'indigo' ? 'text-white/70' : 'text-slate-400'}`}>{label}</p>
      <p className="text-3xl font-black tabular-nums">{value}</p>
      <p className={`text-[10px] font-bold mt-2 ${color === 'blue' || color === 'indigo' ? 'text-white/60' : 'text-slate-400'}`}>{detail}</p>
    </div>
  );
};

export default ClientDashboard;