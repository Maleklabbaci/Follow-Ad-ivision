
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
  const { format, currency } = useCurrency();
  
  // Ref pour éviter les doubles déclenchements et gérer l'intervalle
  const isInitialSyncDone = useRef(false);
  const syncIntervalRef = useRef<number | null>(null);

  const log = useCallback((msg: string) => {
    setSyncLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));
  }, []);

  const runGlobalExtraction = useCallback(async (isBackground = false) => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      if (!isBackground) log("ERREUR : Token Meta Ads invalide.");
      return;
    }

    if (isSyncing) return;

    setIsSyncing(true);
    if (!isBackground) setProgress(0);
    log(isBackground ? 'Cycle auto-sync en cours...' : 'Lancement du protocole de synchronisation miroir...');
    
    try {
      const token = await decryptSecret(fbSecret.value);
      let newCampaignsMap = new Map<string, CampaignStats>();
      let updatedClients = [...clients];
      const foundInMetaThisSync = new Set<string>();

      // On garde une trace des campagnes existantes
      campaigns.forEach(c => newCampaignsMap.set(c.campaignId, c));

      for (let i = 0; i < updatedClients.length; i++) {
        const client = updatedClients[i];
        if (!client.campaignIds || client.campaignIds.length === 0) continue;

        if (!isBackground) log(`Audit : ${client.name}...`);
        
        for (const adAccountId of (client.adAccounts || [])) {
          try {
            const url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=name,status,id,account_id,insights.date_preset(maximum){spend,impressions,reach,frequency,clicks,actions}&access_token=${token}`;
            const res = await fetch(url);
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

                  const metaStatus = metaCp.status as 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
                  const cpaValue = conversionsCount > 0 ? spend / conversionsCount : 0;

                  const stats: CampaignStats = {
                    id: newCampaignsMap.get(metaCp.id)?.id || `meta_${Math.random().toString(36).substr(2, 5)}`,
                    campaignId: metaCp.id,
                    name: metaCp.name,
                    date: new Date().toISOString(),
                    spend,
                    currency: 'USD',
                    impressions: parseInt(insight.impressions) || 0,
                    reach: parseInt(insight.reach) || 0,
                    frequency: parseFloat(insight.frequency) || 1,
                    clicks: parseInt(insight.clicks) || 0,
                    conversions: conversionsCount, 
                    resultat: conversionsCount, 
                    cost: cpaValue,
                    results: conversionsCount,
                    cost_per_result: cpaValue,
                    conversion_action_type: 'conversions',
                    ctr: parseInt(insight.impressions) > 0 ? (parseInt(insight.clicks) / parseInt(insight.impressions)) : 0,
                    cpc: parseInt(insight.clicks) > 0 ? spend / parseInt(insight.clicks) : 0,
                    cpm: parseInt(insight.impressions) > 0 ? (spend / parseInt(insight.impressions)) * 1000 : 0,
                    cpa: cpaValue, 
                    roas: spend > 0 ? (conversionsCount * 50) / spend : 0, 
                    status: metaStatus,
                    dataSource: 'REAL_API',
                    lastSync: new Date().toISOString(),
                    isValidated: true
                  };

                  newCampaignsMap.set(metaCp.id, stats);
                }
              });
            }
          } catch (e) { log(`Erreur API pour ${adAccountId}`); }
        }

        const activeLinkedIds = client.campaignIds.filter(id => {
          const isReal = campaigns.find(c => c.campaignId === id)?.dataSource === 'REAL_API';
          if (isReal && !foundInMetaThisSync.has(id)) {
            return false;
          }
          return true;
        });

        if (activeLinkedIds.length !== client.campaignIds.length) {
          updatedClients[i] = { ...client, campaignIds: activeLinkedIds };
        }

        if (!isBackground) setProgress(Math.round(((i + 1) / updatedClients.length) * 100));
      }

      const finalCampaigns = Array.from(newCampaignsMap.values()).filter(c => {
        if (c.dataSource === 'REAL_API' && !foundInMetaThisSync.has(c.campaignId)) {
          return false;
        }
        return true;
      });

      setCampaigns(finalCampaigns);
      setClients(updatedClients);
      
      await DB.saveCampaigns(finalCampaigns);
      await DB.saveClients(updatedClients);
      
      log(isBackground ? 'Flux synchronisé automatiquement.' : '--- MIROIR META SYNCHRONISÉ ---');
      setTimeout(() => setIsSyncing(false), 1500);
    } catch (err: any) {
      log(`Échec : ${err.message}`);
      setIsSyncing(false);
    }
  }, [clients, campaigns, secrets, isSyncing, setCampaigns, setClients, log]);

  // AUTOMATISATION : Lancement au montage et Intervalle
  useEffect(() => {
    if (!isInitialSyncDone.current && secrets.some(s => s.type === 'FACEBOOK' && s.status === 'VALID')) {
      isInitialSyncDone.current = true;
      runGlobalExtraction(true); // Premier run discret
    }

    // Intervalle toutes les 60 secondes (chaque moment)
    syncIntervalRef.current = window.setInterval(() => {
      runGlobalExtraction(true);
    }, 60000);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [runGlobalExtraction, secrets]);

  const healthStats = useMemo(() => {
    const total = Array.isArray(campaigns) ? campaigns.length : 0;
    const real = campaigns.filter(c => c?.dataSource === 'REAL_API').length;
    const totalSpend = campaigns.reduce((sum, c) => sum + (Number(c?.spend) || 0), 0);
    return {
      integrity: total > 0 ? Math.round((real / total) * 100) : 0,
      totalSpend
    };
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    if (!Array.isArray(campaigns)) return [];
    
    return campaigns.map(campaign => {
      const associatedClient = clients.find(c => c?.campaignIds?.includes(campaign.campaignId));
      return {
        ...campaign,
        clientName: associatedClient ? associatedClient.name : 'Non assignée',
        clientId: associatedClient ? associatedClient.id : null
      };
    }).filter((cp) => {
      const matchesSearch = (cp.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (cp.campaignId || '').includes(searchTerm);
      
      let matchesClient = true;
      if (filterClient === 'unassigned') {
        matchesClient = cp.clientId === null;
      } else if (filterClient !== 'all') {
        matchesClient = cp.clientId === filterClient;
      }
      
      return matchesSearch && matchesClient;
    }).sort((a, b) => (b.lastSync || '').localeCompare(a.lastSync || ''));
  }, [campaigns, clients, searchTerm, filterClient]);

  const runTechnicalSync = async (campaignId: string) => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      setTaskResult({ error: "Token Meta manquant ou invalide" });
      return;
    }

    setIsTaskRunning(true);
    try {
      const token = await decryptSecret(fbSecret.value);
      const url = `https://graph.facebook.com/v19.0/${campaignId}/insights?fields=actions,spend&date_preset=maximum&access_token=${token}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        setTaskResult({ error: data.error.message });
      } else if (data.data && data.data[0]) {
        const insight = data.data[0];
        const spend = parseFloat(insight.spend) || 0;
        
        let resultsCount = 0;
        if (insight.actions) {
          const targetActions = insight.actions.filter((a: any) => 
            a.action_type.includes('messaging_conversation_started') || a.action_type === 'conversions'
          );
          resultsCount = targetActions.reduce((sum: number, a: any) => sum + parseInt(a.value), 0);
        }

        const costPerResultValue = resultsCount > 0 ? spend / resultsCount : 0;

        const updatedCampaigns = campaigns.map(c => {
          if (c.campaignId === campaignId) {
            return { 
              ...c, 
              resultat: resultsCount, 
              cost: costPerResultValue,
              results: resultsCount,
              cost_per_result: costPerResultValue,
              lastSync: new Date().toISOString() 
            };
          }
          return c;
        });

        setCampaigns(updatedCampaigns);
        await DB.saveCampaigns(updatedCampaigns);

        setTaskResult({
          campaign_id: campaignId,
          resultat: resultsCount,
          cost: costPerResultValue
        });
      } else {
        setTaskResult({
          campaign_id: campaignId,
          resultat: 0,
          cost: 0
        });
      }
    } catch (err: any) {
      setTaskResult({ error: "Échec de connexion API" });
    } finally {
      setIsTaskRunning(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="relative">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Engine Control</h2>
          <div className="flex items-center gap-3 mt-1">
             <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Meta API v19.0 Active
             </p>
             <span className="bg-blue-600 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-tighter animate-pulse shadow-lg shadow-blue-200">
               AUTO-SYNC ACTIVE
             </span>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => runGlobalExtraction(false)}
            disabled={isSyncing}
            className={`flex-1 md:flex-none px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-2xl ${
              isSyncing 
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
              : 'bg-slate-900 text-white hover:bg-black hover:scale-[1.02] active:scale-95 shadow-slate-200'
            }`}
          >
            {isSyncing ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
                SYNC EN COURS...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                FORCER LA SYNC
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <HealthCard label="Data Integrity" value={`${healthStats.integrity}%`} sub="API SYNC STATUS" color="blue" />
        <HealthCard label="Target Metric" value="MESSAGING" sub="API Mapped Actions" color="emerald" />
        <HealthCard label="Active Node" value={currency} sub="Exchange Rate Active" color="slate" />
        <HealthCard label="Total Managed" value={format(healthStats.totalSpend)} sub="Managed Portfolio" color="indigo" />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 md:p-10 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-6 bg-slate-50/30">
          <div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tighter italic uppercase">Registre des Flux</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Mise à jour automatique chaque 60s</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            <select 
              className="px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
            >
              <option value="all">Tous les clients</option>
              <option value="unassigned">Non assignées</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="relative flex-1 sm:w-64">
              <input 
                type="text"
                placeholder="RECHERCHE..."
                className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-300"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[1000px]">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-10 py-6">Campagne</th>
                <th className="px-10 py-6 text-right">Dépense ({currency})</th>
                <th className="px-10 py-6 text-right">Résultats</th>
                <th className="px-10 py-6 text-right">Statut</th>
                <th className="px-10 py-6 text-right">Coût / Résultat</th>
                <th className="px-10 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCampaigns.length > 0 ? filteredCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-10 py-6">
                    <div className="font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase italic">{cp.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cp.clientName}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-right font-black text-slate-900 tabular-nums">{format(cp.spend)}</td>
                  <td className={`px-10 py-6 text-right font-black tabular-nums text-lg ${cp.results > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{cp.results || 0}</td>
                  <td className="px-10 py-6 text-right">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      cp.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 
                      cp.status === 'PAUSED' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {cp.status}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-right font-black text-blue-600 tabular-nums">{format(cp.cost_per_result, 'USD', 4)}</td>
                  <td className="px-10 py-6 text-right">
                    <button 
                      onClick={() => runTechnicalSync(cp.campaignId)}
                      disabled={isTaskRunning}
                      className={`p-3 rounded-xl transition-all shadow-sm ${isTaskRunning ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white hover:bg-black'}`}
                      title="Exécuter Tâche Technique"
                    >
                      <svg className={`w-4 h-4 ${isTaskRunning ? 'animate-spin' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-10 py-20 text-center text-[10px] font-black text-slate-300 uppercase italic">Aucune donnée sync</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL RÉSULTAT TECHNIQUE JSON */}
      {taskResult && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setTaskResult(null)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technical Response Output</span>
              <button onClick={() => setTaskResult(null)} className="p-2 text-slate-300 hover:text-slate-900">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-10 bg-slate-900 text-emerald-400 font-mono text-sm leading-relaxed overflow-x-auto">
              <pre>{JSON.stringify(taskResult, null, 2)}</pre>
            </div>
            <div className="p-6 text-center bg-white border-t border-slate-100">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Format JSON strict - Base de données mise à jour</p>
            </div>
          </div>
        </div>
      )}

      {isSyncing && progress > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-500"></div>
          <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[3rem] p-10 shadow-2xl flex flex-col gap-8">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-2 block">Cloud Sync Active</span>
                <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">Synchronisation Miroir</h3>
              </div>
              <span className="text-4xl font-black text-white tabular-nums">{progress}%</span>
            </div>
            <div className="w-full bg-white/5 h-4 rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="flex-1 bg-black/50 border border-white/5 rounded-3xl p-6 font-mono text-[10px] space-y-2 overflow-y-auto max-h-[300px] text-slate-500 custom-scrollbar">
              {syncLogs.map((l, i) => (
                <div key={i} className={i === 0 ? 'text-white font-black' : ''}>➜ {l}</div>
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
    blue: 'bg-blue-600 text-white shadow-xl shadow-blue-100',
    emerald: 'bg-emerald-500 text-white shadow-xl shadow-emerald-100',
    slate: 'bg-white border-slate-200 text-slate-900 shadow-sm',
    indigo: 'bg-indigo-600 text-white shadow-xl shadow-indigo-100',
  };
  return (
    <div className={`p-8 rounded-[2rem] border transition-all ${themes[color] || themes.slate} hover:-translate-y-1 duration-300`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-4">{label}</p>
      <p className="text-4xl font-black tracking-tighter italic truncate">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">{sub}</p>
    </div>
  );
};

export default AdminCampaigns;
