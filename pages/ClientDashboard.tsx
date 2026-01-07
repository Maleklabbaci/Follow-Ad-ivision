
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { User, CampaignStats, Client, UserRole, IntegrationSecret } from '../types';
import { DB } from '../services/db';
import { decryptSecret } from '../services/cryptoService';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Bar, Area } from 'recharts';
import ClientInsights from './ClientInsights';

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

  const clientCurrency = useMemo(() => {
    return clientCampaigns[0]?.currency || 'USD';
  }, [clientCampaigns]);

  const fetchRealHistory = useCallback(async () => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID' || clientCampaigns.length === 0) return;

    try {
      const token = await decryptSecret(fbSecret.value);
      const AOV = 145.0; 
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
            let conv = 0;
            if (day.actions) {
              conv = day.actions
                .filter((a: any) => a.action_type.includes('purchase') || a.action_type.includes('conversion'))
                .reduce((sum: number, a: any) => sum + parseInt(a.value), 0);
            }
            const existing = historyMap.get(dateStr) || { spend: 0, conversions: 0 };
            historyMap.set(dateStr, {
              spend: existing.spend + spend,
              conversions: existing.conversions + conv
            });
          });
        }
      }

      const formatted = Array.from(historyMap.entries())
        .map(([date, vals]) => {
          const roas = vals.spend > 0 ? (vals.conversions * AOV) / vals.spend : 0;
          const d = new Date(date);
          return {
            date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
            fullDate: date,
            spend: Math.round(vals.spend),
            roas: parseFloat(roas.toFixed(2)),
            conversions: vals.conversions,
            isReal: true
          };
        })
        .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
      setRealHistoryData(formatted);
    } catch (err) { console.error(err); }
  }, [clientCampaigns, secrets]);

  const triggerRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchRealHistory();
    setTimeout(() => {
      setIsRefreshing(false);
      setRefreshCountdown(60);
    }, 800);
  }, [fetchRealHistory]);

  useEffect(() => {
    if (activeClient) triggerRefresh();
  }, [activeClient]);

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

  const trendData = useMemo(() => {
    if (realHistoryData.length > 0) return realHistoryData;
    if (clientCampaigns.length === 0) return [];
    const days = 14;
    const data = [];
    const now = new Date();
    const totalSpend = clientCampaigns.reduce((s, c) => s + (c.spend || 0), 0);
    const avgRoas = clientCampaigns.reduce((s, c) => s + (c.roas || 0), 0) / clientCampaigns.length;
    for (let i = days; i >= 0; i--) {
      const d = new Date(); d.setDate(now.getDate() - i);
      const factor = (days - i + 1) / days;
      const dailySpend = (totalSpend / days) * (0.8 + Math.random() * 0.4) * factor;
      const dailyRoas = avgRoas * (0.9 + Math.random() * 0.2);
      data.push({
        date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        spend: Math.round(dailySpend),
        roas: parseFloat(dailyRoas.toFixed(2)),
        isReal: false
      });
    }
    return data;
  }, [clientCampaigns, realHistoryData]);

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
  const avgCpc = totals.clicks > 0 ? (totals.spend / totals.clicks) : 0;
  const formattedCpc = new Intl.NumberFormat(clientCurrency === 'EUR' ? 'fr-FR' : 'en-US', {
    style: 'currency', currency: clientCurrency, minimumFractionDigits: 4, maximumFractionDigits: 4
  }).format(avgCpc);

  return (
    <div className="space-y-4 md:space-y-8 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-1 md:px-0">
        <div className="w-full">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl md:text-4xl font-black text-slate-900 tracking-tighter italic uppercase truncate">{activeClient?.name}</h2>
            <div className={`px-2 md:px-4 py-1 rounded-lg md:rounded-2xl text-[8px] md:text-[10px] font-black border uppercase tracking-widest whitespace-nowrap ${isRefreshing ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
              {isRefreshing ? 'Sync...' : (realHistoryData.length > 0 ? 'Meta Real' : 'AI Sim')}
            </div>
          </div>
          <p className="text-slate-400 text-[9px] md:text-sm font-bold uppercase tracking-widest mt-0.5">
            {clientCampaigns.length} Compagnes • {clientCurrency}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-3 rounded-2xl shadow-sm w-full md:w-auto">
           <div className="flex-1 md:text-right">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Refresh in</p>
              <p className="text-xs font-black text-blue-600 tabular-nums">{refreshCountdown}s</p>
           </div>
           <button onClick={triggerRefresh} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl active:scale-95 transition-all">
              <svg className={`w-4 h-4 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
           </button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <KPIBox label="ROAS" value={`${avgRoas}x`} color="indigo" compact />
        <KPIBox label="Reach" value={totals.reach.toLocaleString()} color="blue" compact />
        <KPIBox label="Spend" value={DB.formatCurrency(totals.spend, clientCurrency)} color="white" compact />
        <KPIBox label="CPC" value={formattedCpc} color="emerald" compact />
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 bg-white p-5 md:p-10 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-8 gap-4">
            <div>
              <h3 className="text-sm md:text-xl font-black text-slate-800 tracking-tight uppercase italic">Profitability Trend</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Meta Ads Insights Graph</p>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5">
                 <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                 <span className="text-[8px] font-black uppercase text-slate-500">Spend</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                 <span className="text-[8px] font-black uppercase text-slate-500">ROAS</span>
               </div>
            </div>
          </div>
          
          <div className={`h-48 md:h-80 transition-all ${isRefreshing ? 'opacity-30 blur-sm' : 'opacity-100'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} hide={trendData.length > 20} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#94a3b8' }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#10b981' }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', fontSize: '10px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                <Area yAxisId="left" type="monotone" dataKey="spend" stroke="#2563eb" fillOpacity={1} fill="url(#colorSpend)" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="roas" stroke="#10b981" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="lg:col-span-1 h-full">
           <ClientInsights user={activeClient ? { ...user, clientId: activeClient.id } : user} campaigns={campaigns} />
        </div>
      </div>

      {/* Detailed Table - Mobile Responsive */}
      <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 md:p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/20">
          <h3 className="text-sm md:text-2xl font-black text-slate-800 tracking-tight italic uppercase">Campaign Audit</h3>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">LIVE DATA</span>
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 bg-slate-50/50">
                <th className="px-5 md:px-10 py-4">Campaign</th>
                <th className="px-5 md:px-10 py-4 text-right">Spend</th>
                <th className="px-5 md:px-10 py-4 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100 ${isRefreshing ? 'opacity-20' : 'opacity-100'}`}>
              {clientCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-5 md:px-10 py-5 md:py-8">
                    <div className="font-black text-slate-900 text-[11px] md:text-sm truncate max-w-[150px] md:max-w-none">{cp.name}</div>
                    <div className="text-[8px] font-bold text-blue-500 uppercase tracking-widest mt-1">ID: {cp.campaignId.slice(-8)}</div>
                  </td>
                  <td className="px-5 md:px-10 py-5 md:py-8 text-right font-black tabular-nums text-slate-900 text-[11px] md:text-sm">{DB.formatCurrency(cp.spend, cp.currency)}</td>
                  <td className={`px-5 md:px-10 py-5 md:py-8 text-right font-black tabular-nums text-sm md:text-xl ${cp.roas > 4 ? 'text-emerald-500' : 'text-blue-600'}`}>{cp.roas.toFixed(2)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 md:hidden text-center text-[8px] font-black text-slate-300 uppercase tracking-widest border-t border-slate-50">
             Slide to see more metrics
          </div>
        </div>
      </div>
    </div>
  );
};

const KPIBox = ({ label, value, color, compact }: any) => {
  const themes: any = {
    blue: 'bg-blue-600 text-white shadow-lg shadow-blue-50',
    emerald: 'bg-emerald-500 text-white shadow-lg shadow-emerald-50',
    indigo: 'bg-indigo-600 text-white shadow-lg shadow-indigo-50',
    white: 'bg-white text-slate-900 border-slate-200'
  };
  return (
    <div className={`p-4 md:p-8 rounded-[1.2rem] md:rounded-[2rem] border transition-all active:scale-95 ${themes[color] || themes.white}`}>
      <p className="text-[7px] md:text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
      <p className="text-sm md:text-3xl font-black tabular-nums tracking-tighter truncate leading-none md:leading-normal">{value}</p>
    </div>
  );
};

export default ClientDashboard;
