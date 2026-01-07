
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { User, CampaignStats, Client, UserRole, IntegrationSecret } from '../types';
import { decryptSecret } from '../services/cryptoService';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Area } from 'recharts';
import ClientInsights from './ClientInsights';
import { useCurrency } from '../contexts/CurrencyContext';

interface ClientDashboardProps {
  user: User;
  campaigns: CampaignStats[];
  clients: Client[];
  secrets: IntegrationSecret[];
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ user, campaigns = [], clients = [], secrets = [] }) => {
  const { clientId } = useParams<{ clientId?: string }>();
  const [refreshCountdown, setRefreshCountdown] = useState(60);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realHistoryData, setRealHistoryData] = useState<any[]>([]);
  const { format, currency } = useCurrency();

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

  const fetchRealHistory = useCallback(async () => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID' || clientCampaigns.length === 0) return;

    try {
      const token = await decryptSecret(fbSecret.value);
      const historyMap = new Map();
      const realCampaigns = clientCampaigns.filter(c => c.dataSource === 'REAL_API');
      
      if (realCampaigns.length === 0) return;

      for (const cp of realCampaigns) {
        const url = `https://graph.facebook.com/v19.0/${cp.campaignId}/insights?fields=spend,actions,date_start&date_preset=last_30d&time_increment=1&access_token=${token}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.data) {
          data.data.forEach((day: any) => {
            const dateStr = day.date_start;
            const spend = parseFloat(day.spend) || 0;
            
            let started = 0;
            if (day.actions && Array.isArray(day.actions)) {
                const targetActions = day.actions.filter((a: any) => 
                    a.action_type === 'messaging_conversation_started_7d' || 
                    a.action_type === 'onsite_conversion.messaging_conversation_started'
                );
                started = targetActions.reduce((sum: number, a: any) => sum + parseInt(a.value), 0);
            }
            
            const existing = historyMap.get(dateStr) || { spend: 0, actions: 0 };
            historyMap.set(dateStr, { 
              spend: existing.spend + spend, 
              actions: existing.actions + started
            });
          });
        }
      }

      const formatted = Array.from(historyMap.entries())
        .map(([date, vals]) => ({
            date: new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
            fullDate: date,
            spend: Math.round(vals.spend),
            actions: vals.actions,
            isReal: true
        }))
        .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

      setRealHistoryData(formatted);
    } catch (err) {
      console.error(err);
    }
  }, [clientCampaigns, secrets]);

  const triggerRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchRealHistory();
    setTimeout(() => {
      setIsRefreshing(false);
      setRefreshCountdown(60);
    }, 800);
  }, [fetchRealHistory]);

  useEffect(() => { if (activeClient) triggerRefresh(); }, [activeClient]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) { triggerRefresh(); return 60; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [triggerRefresh]);

  const totals = useMemo(() => {
    return clientCampaigns.reduce((acc, c) => ({
      spend: acc.spend + (c.spend || 0),
      conv: acc.conv + (c.conversations_started || 0), 
      clicks: acc.clicks + (c.clicks || 0),
      impressions: acc.impressions + (c.impressions || 0),
      reach: acc.reach + (c.reach || 0),
    }), { spend: 0, conv: 0, clicks: 0, impressions: 0, reach: 0 });
  }, [clientCampaigns]);

  const trendData = useMemo(() => {
    const rawData = realHistoryData.length > 0 ? realHistoryData : (clientCampaigns.length === 0 ? [] : (() => {
      const days = 14;
      const data = [];
      const now = new Date();
      for (let i = days; i >= 0; i--) {
        const d = new Date(); d.setDate(now.getDate() - i);
        data.push({
          date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
          spend: Math.round((totals.spend / days) * (0.8 + Math.random() * 0.4)),
          actions: Math.round((totals.conv / days) * (0.8 + Math.random() * 0.4)),
          isReal: false
        });
      }
      return data;
    })());

    return rawData;
  }, [clientCampaigns, realHistoryData, totals]);

  const avgCpa = totals.conv > 0 ? (totals.spend / totals.conv) : 0;
  const globalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100).toFixed(2) : '0.00';
  const globalCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter italic uppercase truncate max-w-[200px] md:max-w-none">{activeClient?.name}</h2>
            <div className={`px-2 py-0.5 rounded-lg text-[8px] font-black border uppercase tracking-widest ${realHistoryData.length > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
              {realHistoryData.length > 0 ? 'Meta Live' : 'MOCKED'}
            </div>
          </div>
          <p className="text-slate-500 text-[9px] md:text-xs font-bold uppercase tracking-widest mt-1">
            Standard Agency Node • {currency} Started Conversations
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-3 rounded-2xl shadow-sm w-full sm:w-auto">
           <div className="flex-1 sm:text-right">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Refresh Node</p>
              <p className="text-xs font-black text-blue-600 tabular-nums leading-none">{refreshCountdown}s</p>
           </div>
           <button onClick={triggerRefresh} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all">
              <svg className={`w-4 h-4 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
           </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 xl:gap-6">
        <KPIBox label="Dépense" value={format(totals.spend)} color="white" />
        <KPIBox label="Reach" value={totals.reach.toLocaleString()} color="blue" />
        <KPIBox label="Conv. Démarrées" value={totals.conv.toLocaleString()} color="purple" />
        <KPIBox label="CPA Started" value={format(avgCpa)} color="emerald" />
        <KPIBox label="CTR %" value={`${globalCtr}%`} color="indigo" />
        <KPIBox label="CPM" value={format(globalCpm)} color="slate" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white p-5 md:p-10 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-8 gap-4">
            <div>
              <h3 className="text-sm md:text-xl font-black text-slate-800 tracking-tight uppercase italic">Analyse Started Conversations</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Dépense vs Démarrages réels</p>
            </div>
          </div>
          <div className={`h-[240px] md:h-80 transition-all ${isRefreshing ? 'opacity-30 blur-sm' : 'opacity-100'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#10b981' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '10px' }}
                  formatter={(value: any, name: string) => [name.includes('Dépense') ? format(value, 'USD') : value, name]}
                />
                <Area yAxisId="left" type="monotone" dataKey="spend" stroke="#2563eb" fillOpacity={1} fill="url(#colorSpend)" strokeWidth={2} name={`Dépense (${currency})`} />
                <Line yAxisId="right" type="monotone" dataKey="actions" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#10b981', stroke: '#fff' }} name="Démarrages" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="xl:col-span-1 h-full">
           <ClientInsights user={activeClient ? { ...user, clientId: activeClient.id } : user} campaigns={campaigns} />
        </div>
      </div>

      <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 md:p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/20">
          <h3 className="text-sm md:text-2xl font-black text-slate-800 tracking-tight italic uppercase">Registre Campagnes Meta</h3>
          <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-md border border-blue-100">Audit Started</span>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-6 md:px-10 py-4">Campagne</th>
                <th className="px-6 md:px-10 py-4 text-right">Dépense ({currency})</th>
                <th className="px-6 md:px-10 py-4 text-right">Démarrages</th>
                <th className="px-6 md:px-10 py-4 text-right">CPA Started</th>
                <th className="px-6 md:px-10 py-4 text-right">CTR%</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100 ${isRefreshing ? 'opacity-20' : 'opacity-100'}`}>
              {clientCampaigns.map(cp => {
                const cpa = cp.conversations_started > 0 ? (cp.spend / cp.conversations_started) : 0;
                return (
                  <tr key={cp.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-6 md:px-10 py-5">
                      <div className="font-black text-slate-900 text-xs md:text-sm truncate max-w-[200px] md:max-w-none group-hover:text-blue-600 transition-colors">{cp.name}</div>
                      <div className="text-[8px] font-black text-blue-500 uppercase tracking-widest mt-1 bg-blue-50/50 inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-blue-100/50 italic">
                        <span className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></span>
                        {(cp.conversion_action_type || 'started').replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="px-6 md:px-10 py-5 text-right font-black tabular-nums text-slate-900 text-xs">{format(cp.spend)}</td>
                    <td className="px-6 md:px-10 py-5 text-right font-black tabular-nums text-purple-600 text-xs">{cp.conversations_started || 0}</td>
                    <td className="px-6 md:px-10 py-5 text-right font-black tabular-nums text-emerald-600 text-xs">{format(cpa)}</td>
                    <td className="px-6 md:px-10 py-5 text-right font-black tabular-nums text-sm md:text-lg text-slate-400">{(cp.ctr * 100).toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const KPIBox = ({ label, value, color }: any) => {
  const themes: any = {
    blue: 'bg-blue-600 text-white shadow-lg shadow-blue-50',
    emerald: 'bg-emerald-500 text-white shadow-lg shadow-emerald-50',
    indigo: 'bg-indigo-600 text-white shadow-lg shadow-indigo-50',
    purple: 'bg-purple-600 text-white shadow-lg shadow-purple-50',
    white: 'bg-white text-slate-900 border-slate-200 shadow-sm',
    slate: 'bg-slate-800 text-white shadow-lg shadow-slate-100'
  };
  return (
    <div className={`p-4 md:p-6 xl:p-8 rounded-xl md:rounded-[2rem] border flex flex-col justify-center ${themes[color] || themes.white}`}>
      <p className="text-[7px] md:text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5 md:mb-1">{label}</p>
      <p className="text-sm md:text-xl xl:text-3xl font-black tabular-nums tracking-tighter truncate">{value}</p>
    </div>
  );
};

export default ClientDashboard;
