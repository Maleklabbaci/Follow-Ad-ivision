
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
  const [taskResult, setTaskResult] = useState<any | null>(null);
  const [isTaskRunning, setIsTaskRunning] = useState(false);
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
    // GESTION MODE HORS-LIGNE
    if (!navigator.onLine) {
      if (!isBackground) {
        setIsSyncing(true);
        setProgress(0);
        log("HORS-LIGNE : Rafraîchissement depuis le miroir local...");
        setTimeout(() => setProgress(50), 200);
      }

      const cachedCampaigns = campaigns.map(c => ({
        ...c,
        lastSync: new Date().toISOString()
      }));

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

    // GESTION MODE EN LIGNE (EXISTANT)
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
      const foundInMetaThisSync = new Set<string>();

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
                  foundInMetaThisSync.add(metaCp.id);
                  const insight = metaCp.insights?.data?.[0] || {};
                  const spend = parseFloat(insight.spend) || 0;
                  
                  let conversionsCount = 0;
                  if (insight.actions) {
                    const targetActions = insight.actions.filter((a: any) => 
                      a.action_type.includes('messaging_conversation_started') || a.action_type === 'conversions'
                    );
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="relative">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Engine Control</h2>
          <div className="flex items-center gap-3 mt-1">
             <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                {isOnline ? 'Meta API v19.0 LIVE' : 'Mode Hors-ligne (Local Mirror)'}
             </p>
          </div>
        </div>
        <button 
          onClick={() => runGlobalExtraction(false)}
          disabled={isSyncing}
          className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center gap-4"
        >
          {isSyncing ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'FORCER LA SYNC'}
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 md:p-10 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-6">
          <h3 className="text-2xl font-black text-slate-800 tracking-tighter italic uppercase">Registre des Flux</h3>
          <div className="flex gap-4 w-full lg:w-auto">
             <input 
                type="text"
                placeholder="RECHERCHE..."
                className="flex-1 sm:w-64 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[1000px]">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-10 py-6">Campagne</th>
                <th className="px-10 py-6 text-right">Dépense</th>
                <th className="px-10 py-6 text-right">Résultats</th>
                <th className="px-10 py-6 text-right">Dernier Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50 transition-all">
                  <td className="px-10 py-6 font-black text-slate-900 uppercase italic">{cp.name}</td>
                  <td className="px-10 py-6 text-right font-black text-slate-900 tabular-nums">{format(cp.spend)}</td>
                  <td className="px-10 py-6 text-right font-black text-emerald-600 tabular-nums text-lg">{cp.results || 0}</td>
                  <td className="px-10 py-6 text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       {cp.lastSync ? new Date(cp.lastSync).toLocaleTimeString() : 'Never'}
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
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-500"></div>
          <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[3rem] p-10 shadow-2xl flex flex-col gap-8">
            <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">Synchronisation Miroir</h3>
            <div className="w-full bg-white/5 h-4 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="bg-black/50 border border-white/5 rounded-3xl p-6 font-mono text-[10px] space-y-2 overflow-y-auto max-h-[300px] text-slate-500 custom-scrollbar">
              {syncLogs.map((l, i) => (
                <div key={i} className={i === 0 ? 'text-white' : ''}>➜ {l}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const HealthCard = ({ label, value, sub, color }: any) => {
  const themes: any = {
    blue: 'bg-blue-600 text-white',
    emerald: 'bg-emerald-500 text-white',
    slate: 'bg-white text-slate-900',
    indigo: 'bg-indigo-600 text-white',
  };
  return (
    <div className={`p-8 rounded-[2rem] border transition-all ${themes[color] || themes.slate}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-4">{label}</p>
      <p className="text-4xl font-black tracking-tighter italic">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">{sub}</p>
    </div>
  );
};

export default AdminCampaigns;
