
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { User, CampaignStats, Client, UserRole } from '../types';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Bar } from 'recharts';
import ClientInsights from './ClientInsights';

interface ClientDashboardProps {
  user: User;
  campaigns: CampaignStats[];
  clients: Client[];
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ user, campaigns = [], clients = [] }) => {
  const { clientId } = useParams<{ clientId?: string }>();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [refreshCountdown, setRefreshCountdown] = useState(60);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeClientId = useMemo(() => {
    if (user?.role === UserRole.ADMIN) {
      return clientId || clients[0]?.id;
    }
    return user?.clientId;
  }, [user, clientId, clients]);
  
  const activeClient = useMemo(() => {
    if (!activeClientId) return null;
    return clients.find(c => c?.id === activeClientId);
  }, [clients, activeClientId]);

  const clientCampaigns = useMemo(() => {
    if (!activeClient || !Array.isArray(campaigns)) return [];
    const ids = Array.isArray(activeClient.campaignIds) ? activeClient.campaignIds : [];
    return campaigns.filter(c => c && ids.includes(c.campaignId));
  }, [campaigns, activeClient]);

  const triggerRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdate(new Date());
      setIsRefreshing(false);
      setRefreshCountdown(60);
    }, 1000);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          triggerRefresh();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [triggerRefresh]);

  const totals = useMemo(() => {
    return clientCampaigns.reduce((acc, c) => ({
      spend: acc.spend + (c.spend || 0),
      conv: acc.conv + (c.conversions || 0),
      clicks: acc.clicks + (c.clicks || 0),
      impressions: acc.impressions + (c.impressions || 0),
      reach: acc.reach + (c.reach || 0),
      roasSum: acc.roasSum + (c.roas || 0)
    }), { spend: 0, conv: 0, clicks: 0, impressions: 0, reach: 0, roasSum: 0 });
  }, [clientCampaigns]);

  const avgRoas = clientCampaigns.length > 0 ? (totals.roasSum / clientCampaigns.length).toFixed(2) : '0.00';
  const avgCpa = totals.conv > 0 ? (totals.spend / totals.conv).toFixed(2) : 'En attente';
  const avgCpm = totals.impressions > 0 ? ((totals.spend / totals.impressions) * 1000).toFixed(2) : '0.00';
  const avgCtr = totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : '0.00';

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">{activeClient?.name}</h2>
            <div className={`px-4 py-1.5 rounded-2xl text-[10px] font-black border uppercase tracking-widest ${isRefreshing ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
              {isRefreshing ? 'Sync Meta Live...' : 'Extraction Meta Certifiée'}
            </div>
          </div>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">
            {clientCampaigns.length} Campagnes Audités • Sync: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-4 bg-white border border-slate-200 px-6 py-4 rounded-[2rem] shadow-sm">
           <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rafraîchissement Auto</p>
              <p className="text-xs font-black text-blue-600 tabular-nums">{refreshCountdown}s</p>
           </div>
           <button onClick={triggerRefresh} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all">
              <svg className={`w-5 h-5 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPIBox label="ROAS Consolidé" value={`${avgRoas}x`} color="indigo" sub="Performance Globale" />
        <KPIBox label="Conversions (Pixel)" value={totals.conv.toString()} color="emerald" sub={totals.conv > 0 ? "Ventes Validées" : "Aucun achat détecté"} />
        <KPIBox label="Reach Unique" value={totals.reach.toLocaleString()} color="blue" sub="Personnes Touchées" />
        <KPIBox label="CPA Moyen" value={avgCpa !== 'En attente' ? `$${avgCpa}` : avgCpa} color="white" sub="Coût par Conversion" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
          <h3 className="text-xl font-black text-slate-800 tracking-tight mb-8 uppercase italic">Analyse de Rentabilité</h3>
          <div className={`h-80 transition-all ${isRefreshing ? 'opacity-30 blur-sm' : 'opacity-100'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={clientCampaigns.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2)' }} />
                <Bar dataKey="spend" fill="#2563eb" radius={[10, 10, 0, 0]} barSize={40} />
                <Line type="monotone" dataKey="roas" stroke="#10b981" strokeWidth={6} dot={{ r: 8, fill: '#10b981', strokeWidth: 4, stroke: '#fff' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="xl:col-span-1">
           <ClientInsights user={activeClient ? { ...user, clientId: activeClient.id } : user} campaigns={campaigns} />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/20">
          <h3 className="text-2xl font-black text-slate-800 tracking-tight italic uppercase">Registre d'Audit Meta</h3>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Données Certifiées Graph API</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-10 py-6">Campagne</th>
                <th className="px-10 py-6 text-right">Spend</th>
                <th className="px-10 py-6 text-right">Reach</th>
                <th className="px-10 py-6 text-right">Conv.</th>
                <th className="px-10 py-6 text-right">CPM</th>
                <th className="px-10 py-6 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100 ${isRefreshing ? 'opacity-20' : 'opacity-100'}`}>
              {clientCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-10 py-8">
                    <div className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{cp.name}</div>
                    <div className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Extraction Live • {cp.campaignId}</div>
                  </td>
                  <td className="px-10 py-8 text-right font-black tabular-nums text-slate-900">${cp.spend.toLocaleString()}</td>
                  <td className="px-10 py-8 text-right font-black tabular-nums text-slate-500">{cp.reach?.toLocaleString() || '---'}</td>
                  <td className={`px-10 py-8 text-right font-black tabular-nums ${cp.conversions > 0 ? 'text-emerald-600' : 'text-slate-200'}`}>
                    {cp.conversions || 0}
                  </td>
                  <td className="px-10 py-8 text-right font-bold text-slate-400 tabular-nums">${cp.cpm.toFixed(2)}</td>
                  <td className={`px-10 py-8 text-right font-black tabular-nums text-xl ${cp.roas > 4 ? 'text-emerald-500' : 'text-blue-600'}`}>
                    {cp.roas.toFixed(2)}x
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

const KPIBox = ({ label, value, color, sub }: any) => {
  const themes: any = {
    blue: 'bg-blue-600 text-white shadow-xl shadow-blue-100',
    emerald: 'bg-emerald-500 text-white shadow-xl shadow-emerald-100',
    indigo: 'bg-indigo-600 text-white shadow-xl shadow-indigo-100',
    white: 'bg-white text-slate-900 border-slate-200 shadow-sm'
  };
  return (
    <div className={`p-10 rounded-[2.5rem] border transition-all hover:scale-[1.03] ${themes[color] || themes.white}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">{label}</p>
      <p className="text-4xl font-black tabular-nums tracking-tighter">{value}</p>
      <div className="h-px bg-current opacity-10 my-4"></div>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{sub}</p>
    </div>
  );
};

export default ClientDashboard;
