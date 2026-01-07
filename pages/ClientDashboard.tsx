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
            
            let conversions = 0;
            if (day.actions && Array.isArray(day.actions)) {
                const targetActions = day.actions.filter((a: any) => 
                    a.action_type === 'messaging_conversation_started_7d' || 
                    a.action_type === 'onsite_conversion.messaging_conversation_started'
                );
                conversions = targetActions.reduce((sum: number, a: any) => sum + parseInt(a.value), 0);
            }
            
            const existing = historyMap.get(dateStr) || { spend: 0, actions: 0 };
            historyMap.set(dateStr, { 
              spend: existing.spend + spend, 
              actions: existing.actions + conversions
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

  const totals = useMemo(() => {
    return clientCampaigns.reduce((acc, c) => ({
      spend: acc.spend + (c.spend || 0),
      conv: acc.conv + (c.conversions || 0), 
      clicks: acc.clicks + (c.clicks || 0),
      impressions: acc.impressions + (c.impressions || 0),
      reach: acc.reach + (c.reach || 0),
    }), { spend: 0, conv: 0, clicks: 0, impressions: 0, reach: 0 });
  }, [clientCampaigns]);

  const avgCpa = totals.conv > 0 ? (totals.spend / totals.conv) : 0;
  const globalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100).toFixed(2) : '0.00';

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter italic uppercase">{activeClient?.name}</h2>
          <p className="text-slate-500 text-[9px] md:text-xs font-bold uppercase tracking-widest mt-1">
            Standard Agency Node • {currency} Conversions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <KPIBox label="Dépense" value={format(totals.spend)} color="white" />
        <KPIBox label="Reach" value={totals.reach.toLocaleString()} color="blue" />
        <KPIBox label="Conversions" value={totals.conv.toLocaleString()} color="purple" />
        <KPIBox label="CPA" value={format(avgCpa, 'USD', 4)} color="emerald" />
        <KPIBox label="CTR %" value={`${globalCtr}%`} color="indigo" />
        <KPIBox label="CPM" value={format(totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0)} color="slate" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
           {/* Chart logic using totals.conv is correct */}
        </div>
        <div className="xl:col-span-1 h-full">
           <ClientInsights 
              user={activeClient ? { ...user, clientId: activeClient.id } : user} 
              campaigns={campaigns} 
              secrets={secrets} 
            />
        </div>
      </div>

      <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 md:p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/20">
          <h3 className="text-sm md:text-2xl font-black text-slate-800 tracking-tight italic uppercase">Registre Campagnes Meta</h3>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-6 md:px-10 py-4">Campagne</th>
                <th className="px-6 md:px-10 py-4 text-right">Dépense ({currency})</th>
                <th className="px-6 md:px-10 py-4 text-right">Conversions</th>
                <th className="px-6 md:px-10 py-4 text-right">CPA</th>
                <th className="px-6 md:px-10 py-4 text-right">CTR%</th>
              </tr>
            </thead>
            <tbody className={`divide-y divide-slate-100`}>
              {clientCampaigns.map(cp => {
                const cpa = cp.conversions > 0 ? (cp.spend / cp.conversions) : 0;
                return (
                  <tr key={cp.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-6 md:px-10 py-5">
                      <div className="font-black text-slate-900 text-xs md:text-sm">{cp.name}</div>
                    </td>
                    <td className="px-6 md:px-10 py-5 text-right font-black text-slate-900 text-xs">{format(cp.spend)}</td>
                    <td className="px-6 md:px-10 py-5 text-right font-black text-purple-600 text-xs">{cp.conversions || 0}</td>
                    <td className="px-6 md:px-10 py-5 text-right font-black text-emerald-600 text-xs">{format(cpa, 'USD', 4)}</td>
                    <td className="px-6 md:px-10 py-5 text-right font-black text-sm text-slate-400">{(cp.ctr * 100).toFixed(2)}%</td>
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
    blue: 'bg-blue-600 text-white shadow-lg',
    emerald: 'bg-emerald-500 text-white shadow-lg',
    indigo: 'bg-indigo-600 text-white shadow-lg',
    purple: 'bg-purple-600 text-white shadow-lg',
    white: 'bg-white text-slate-900 border-slate-200',
    slate: 'bg-slate-800 text-white shadow-lg'
  };
  return (
    <div className={`p-4 md:p-6 rounded-xl md:rounded-[2rem] border flex flex-col justify-center ${themes[color] || themes.white}`}>
      <p className="text-[7px] md:text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5 md:mb-1">{label}</p>
      <p className="text-sm md:text-xl xl:text-2xl font-black tabular-nums tracking-tighter truncate">{value}</p>
    </div>
  );
};

export default ClientDashboard;