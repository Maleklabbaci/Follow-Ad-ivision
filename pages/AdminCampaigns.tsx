
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Client, CampaignStats, IntegrationSecret } from '../types';
import { decryptSecret } from '../services/cryptoService';
import { DB } from '../services/db';
import { useCurrency } from '../contexts/CurrencyContext';

interface AdminCampaignsProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  campaigns: CampaignStats[];
  setCampaigns: React.Dispatch<React.SetStateAction<CampaignStats[]>>;
  secrets: IntegrationSecret[];
}

const AdminCampaigns: React.FC<AdminCampaignsProps> = ({ 
  clients = [], 
  setClients, 
  campaigns = [], 
  setCampaigns, 
  secrets = [] 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState('all'); 
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { format, currency } = useCurrency();
  
  const isInitialSyncDone = useRef(false);
  const syncIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const log = useCallback((msg: string) => {
    setSyncLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));
  }, []);

  const runGlobalExtraction = useCallback(async (isBackground = false) => {
    if (!navigator.onLine) {
      if (!isBackground) {
        setIsSyncing(true);
        setProgress(0);
        log("HORS-LIGNE : Rafraîchissement depuis le miroir local...");
        setTimeout(() => setProgress(50), 200);
      }
      const cachedCampaigns = campaigns.map(c => ({ ...c, lastSync: new Date().toISOString() }));
      setCampaigns(cachedCampaigns);
      await DB.saveCampaigns(cachedCampaigns);
      if (!isBackground) {
        setTimeout(() => {
          setProgress(100);
          log("Miroir local synchronisé (Cache)");
          setIsSyncing(false);
        }, 600);
      }
      return;
    }

    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      if (!isBackground) log("ERREUR : Token Meta Ads invalide.");
      return;
    }

    if (isSyncing) return;
    setIsSyncing(true);
    if (!isBackground) setProgress(0);
    log(isBackground ? 'Cycle auto-sync...' : 'Protocole miroir Meta actif...');
    
    try {
      const token = await decryptSecret(fbSecret.value);
      let newCampaignsMap = new Map<string, CampaignStats>();
      let updatedClients = [...clients];
      campaigns.forEach(c => newCampaignsMap.set(c.campaignId, c));

      for (let i = 0; i < updatedClients.length; i++) {
        const client = updatedClients[i];
        if (!client.campaignIds || client.campaignIds.length === 0) continue;
        for (const adAccountId of (client.adAccounts || [])) {
          try {
            const url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=name,status,id,account_id,insights.date_preset(maximum){spend,impressions,reach,frequency,clicks,actions}&access_token=${token}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Fetch Failed");
            const data = await res.json();
            if (data.data) {
              data.data.forEach((metaCp: any) => {
                if (client.campaignIds.includes(metaCp.id)) {
                  if (metaCp.status === 'DELETED') return;
                  const insight = metaCp.insights?.data?.[0] || {};
                  const spend = parseFloat(insight.spend) || 0;
                  let conversionsCount = 0;
                  if (insight.actions) {
                    const targetActions = insight.actions.filter((a: any) => a.action_type.includes('messaging_conversation_started') || a.action_type === 'conversions');
                    conversionsCount = targetActions.reduce((sum: number, a: any) => sum + parseInt(a.value), 0);
                  }
                  const stats: CampaignStats = {
                    ...newCampaignsMap.get(metaCp.id),
                    id: newCampaignsMap.get(metaCp.id)?.id || `meta_${Math.random().toString(36).substr(2, 5)}`,
                    campaignId: metaCp.id,
                    name: metaCp.name,
                    spend,
                    impressions: parseInt(insight.impressions) || 0,
                    conversions: conversionsCount, 
                    results: conversionsCount,
                    status: metaCp.status as any,
                    dataSource: 'REAL_API',
                    lastSync: new Date().toISOString(),
                    isValidated: true
                  } as CampaignStats;
                  newCampaignsMap.set(metaCp.id, stats);
                }
              });
            }
          } catch (e) { log(`Erreur API: ${adAccountId}`); }
        }
        if (!isBackground) setProgress(Math.round(((i + 1) / updatedClients.length) * 100));
      }
      const finalCampaigns = Array.from(newCampaignsMap.values());
      setCampaigns(finalCampaigns);
      await DB.saveCampaigns(finalCampaigns);
      log(isBackground ? 'Auto-sync Meta OK.' : '--- SYNC META RÉUSSIE ---');
      setTimeout(() => setIsSyncing(false), 1500);
    } catch (err: any) {
      log(`Échec sync : Basculement cache local.`);
      setIsSyncing(false);
    }
  }, [clients, campaigns, secrets, isSyncing, setCampaigns, setClients, log]);

  useEffect(() => {
    if (!isInitialSyncDone.current) {
      isInitialSyncDone.current = true;
      runGlobalExtraction(true);
    }
    syncIntervalRef.current = window.setInterval(() => runGlobalExtraction(true), 60000);
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current); };
  }, [runGlobalExtraction]);

  const filteredCampaigns = useMemo(() => {
    return (campaigns || []).filter(cp => {
      const matchesSearch = (cp.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClient = filterClient === 'all' || (clients.find(c => c.id === filterClient)?.campaignIds.includes(cp.campaignId));
      return matchesSearch && matchesClient;
    }).sort((a, b) => (b.lastSync || '').localeCompare(a.lastSync || ''));
  }, [campaigns, clients, searchTerm, filterClient]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter italic uppercase leading-none mb-3">Engine Control</h2>
          <div className="flex items-center gap-3">
             <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
             <p className="text-slate-500 font-black uppercase tracking-[0.25em] text-[10px] md:text-[11px]">
                {isOnline ? 'PROTOCOLE META LIVE v19.0' : 'MODE HORS-LIGNE : LECTURE DU CACHE'}
             </p>
          </div>
        </div>
        <button 
          onClick={() => runGlobalExtraction(false)}
          disabled={isSyncing}
          className="w-full lg:w-auto px-12 py-6 bg-slate-900 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] hover:bg-black transition-all flex items-center justify-center gap-5 shadow-2xl shadow-slate-200 active:scale-95 disabled:opacity-50"
        >
          {isSyncing ? <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'FORCER LA SYNCHRO'}
        </button>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 md:p-12 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-8 bg-slate-50/20">
          <h3 className="text-2xl font-black text-slate-800 tracking-tighter italic uppercase">Registre des Flux</h3>
          <div className="flex gap-4 w-full lg:w-auto">
             <div className="relative flex-1 lg:w-80">
               <input 
                  type="text"
                  placeholder="RECHERCHER UN FLUX..."
                  className="w-full px-8 py-5 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[1000px]">
            <thead>
              <tr className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] border-b border-slate-100 bg-slate-50/50">
                <th className="px-12 py-8">Campagne / Client</th>
                <th className="px-12 py-8 text-right">Dépense Totale</th>
                <th className="px-12 py-8 text-right">Résultats Net</th>
                <th className="px-12 py-8 text-right">Horodatage Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-12 py-8">
                    <div className="font-black text-slate-900 uppercase italic text-lg group-hover:text-blue-600 transition-colors">{cp.name}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">ID: {cp.campaignId}</div>
                  </td>
                  <td className="px-12 py-8 text-right font-black text-slate-900 tabular-nums text-xl">{format(cp.spend)}</td>
                  <td className="px-12 py-8 text-right">
                    <div className="font-black text-emerald-600 tabular-nums text-2xl">{cp.results || 0}</div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Conversions</div>
                  </td>
                  <td className="px-12 py-8 text-right">
                    <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-4 py-2 rounded-full uppercase tracking-widest">
                       {cp.lastSync ? new Date(cp.lastSync).toLocaleTimeString() : 'JAMAIS SYNC'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isSyncing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-3xl animate-in fade-in duration-500"></div>
          <div className="relative w-full max-w-3xl bg-slate-900 border border-white/10 rounded-[4rem] p-12 shadow-2xl flex flex-col gap-10 animate-in zoom-in-95 duration-300">
            <div>
               <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">Extraction Miroir</h3>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Récupération des métriques publicitaires en cours...</p>
            </div>
            <div className="w-full bg-white/5 h-6 rounded-full overflow-hidden p-1.5 border border-white/5">
              <div className="h-full bg-blue-600 rounded-full transition-all duration-700 shadow-[0_0_20px_rgba(37,99,235,0.4)]" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="bg-black/80 border border-white/5 rounded-[2rem] p-8 font-mono text-[10px] space-y-3 overflow-y-auto max-h-[350px] text-slate-500 custom-scrollbar shadow-inner">
              {syncLogs.map((l, i) => (
                <div key={i} className={i === 0 ? 'text-blue-400 font-bold' : ''}>
                  <span className="text-slate-700 opacity-50 mr-2">[{i}]</span> {l}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCampaigns;
