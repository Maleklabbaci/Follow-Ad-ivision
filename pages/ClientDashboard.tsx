
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
  const avgCpm = totals.impressions > 0 ? ((totals.spend / totals.impressions) * 1000).toFixed(2) : '0.00';
  const avgReach = totals.reach.toLocaleString();

  return (
    <div className="space-y-6 md:space-y-8 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter italic uppercase truncate">{activeClient?.name}</h2>
            <div className={`px-3 md:px-4 py-1 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black border uppercase tracking-widest ${isRefreshing ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
              {isRefreshing ? 'Sync Live...' : 'Meta Certifiée'}
            </div>
          </div>
          <p className="text-slate-500 text-[10px] md:text-sm font-bold uppercase tracking-widest mt-1">
            {clientCampaigns.length} Campagnes • {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-3 md:gap-4 bg-white border border-slate-200 px-4 md:px-6 py-3 md:py-4 rounded-2xl md:rounded-[2rem] shadow-sm w-full md:w-auto justify-between md:justify-start">
           <div className="text-left md:text-right">
              <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Update</p>
              <p className="text-xs md:text-sm font-black text-blue-600 tabular-nums">{refreshCountdown}s</p>
           </div>
           <button onClick={triggerRefresh} className="p-2 md:p-3 bg-slate-50 hover:bg-slate-100 rounded-xl md:rounded-2xl transition-all">
              <svg className={`w-4 h-4 md:w-5 md:h-5 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KPIBox label="ROAS Global" value={`${avgRoas}x`} color="indigo" sub="Performance" />
        <KPIBox label="Ventes" value={totals.conv.toString()} color="emerald" sub="Validé Pixel" />
        <KPIBox label="Reach Unique" value={avgReach} color="blue" sub="Touchés" />
        <KPIBox label="CPM Moyen" value={`$${avgCpm}`} color="white" sub="Coût/1k Imps" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white p-6 md:p-10 rounded-2xl md:rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
          <h3 className="text-lg md:text-xl font-black text-slate-800 tracking-tight mb-6 md:mb-8 uppercase italic">Analyse de Rentabilité</h3>
          <div className={`h-64 md:h-80 transition-all ${isRefreshing ? 'opacity-30 blur-sm' : 'opacity-100'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={clientCampaigns.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} hide={window.innerWidth < 768} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', fontSize: '10px' }} />
                <Bar dataKey="spend" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={window.innerWidth < 768 ? 20 : 40} />
                <Line type="monotone" dataKey="roas" stroke="#10b981" strokeWidth={window.innerWidth < 768 ? 3 : 6} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="xl:col-span-1 h-full">
           <ClientInsights user={activeClient ? { ...user, clientId: activeClient.id } : user} campaigns={campaigns} />
        </div>
      </div>

      <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 md:p-10 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/20">
          <h3 className="text-lg md:text-2xl font-black text-slate-800 tracking-tight italic uppercase">Audit Meta</h3>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 md:w-3 md:h-3 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">LIVE GRAPH API</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-6 md:px-10 py-4 md:py-6">Campagne</th>
                <th className="px-6 md:px-10 py-4 md:py-6 text-right">Spend</th>
                <th className="px-6 md:px-10 py-4 md:py-6 text-right">Reach</th>
                <th className="px-6 md:px-10 py-4 md:py-6 text-right">Conv.</th>
                <th className="px-6 md:px-10 py-4 md:py-6 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100 ${isRefreshing ? 'opacity-20' : 'opacity-100'}`}>
              {clientCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-6 md:px-10 py-6 md:py-8">
                    <div className="font-black text-slate-900 group-hover:text-blue-600 transition-colors text-xs md:text-sm">{cp.name}</div>
                    <div className="text-[8px] font-bold text-blue-500 uppercase tracking-widest">LIVE • {cp.campaignId.slice(-8)}</div>
                  </td>
                  <td className="px-6 md:px-10 py-6 md:py-8 text-right font-black tabular-nums text-slate-900 text-xs md:text-sm">${cp.spend.toLocaleString()}</td>
                  <td className="px-6 md:px-10 py-6 md:py-8 text-right font-black tabular-nums text-slate-500 text-xs md:text-sm">{cp.reach?.toLocaleString() || '---'}</td>
                  <td className={`px-6 md:px-10 py-6 md:py-8 text-right font-black tabular-nums text-xs md:text-sm ${cp.conversions > 0 ? 'text-emerald-600' : 'text-slate-200'}`}>
                    {cp.conversions || 0}
                  </td>
                  <td className={`px-6 md:px-10 py-6 md:py-8 text-right font-black tabular-nums text-sm md:text-xl ${cp.roas > 4 ? 'text-emerald-500' : 'text-blue-600'}`}>
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
    <div className={`p-6 md:p-10 rounded-2xl md:rounded-[2.5rem] border transition-all hover:scale-[1.02] ${themes[color] || themes.white}`}>
      <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">{label}</p>
      <p className="text-2xl md:text-4xl font-black tabular-nums tracking-tighter truncate">{value}</p>
      <div className="h-px bg-current opacity-10 my-3 md:my-4"></div>
      <p className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest opacity-40">{sub}</p>
    </div>
  );
};

export default ClientDashboard;
