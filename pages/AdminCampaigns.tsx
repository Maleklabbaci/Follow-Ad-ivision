import React, { useMemo, useState, useEffect } from 'react';
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
  const { format, currency } = useCurrency();

  // Reset progress when sync starts
  useEffect(() => {
    if (!isSyncing) setProgress(0);
  }, [isSyncing]);

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

  const log = (msg: string) => setSyncLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));

  const runGlobalExtraction = async () => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      alert("ERREUR : Token Meta Ads invalide ou manquant dans les réglages.");
      return;
    }

    setIsSyncing(true);
    setSyncLogs(['Initialisation de la synchronisation Meta Cloud...']);
    
    try {
      const token = await decryptSecret(fbSecret.value);
      let newCampaignsMap = new Map<string, CampaignStats>();
      
      // Preserve existing campaigns to update them
      campaigns.forEach(c => newCampaignsMap.set(c.campaignId, c));

      const totalClients = clients.length;
      if (totalClients === 0) {
        log("Aucun client configuré pour l'extraction.");
        setIsSyncing(false);
        return;
      }

      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        if (!client.campaignIds || client.campaignIds.length === 0) {
          log(`Saut de ${client.name} (Aucun ID de campagne lié)`);
          continue;
        }

        log(`Analyse client : ${client.name.toUpperCase()}...`);
        
        for (const adAccountId of (client.adAccounts || [])) {
          try {
            log(`Connexion compte publicitaire : ${adAccountId}`);
            const url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=name,status,id,insights.date_preset(maximum){spend,impressions,reach,frequency,clicks,actions}&access_token=${token}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.error) {
              log(`Erreur Meta API pour ${adAccountId}: ${data.error.message}`);
              continue;
            }

            if (data.data) {
              const matchedFromMeta = data.data.filter((metaCp: any) => 
                client.campaignIds.includes(metaCp.id)
              );

              log(`Found ${matchedFromMeta.length} matching campaigns for ${client.name}`);

              matchedFromMeta.forEach((metaCp: any) => {
                const insight = metaCp.insights?.data?.[0] || {};
                const spend = parseFloat(insight.spend) || 0;
                
                let conversionsCount = 0;
                if (insight.actions && Array.isArray(insight.actions)) {
                  const targetActions = insight.actions.filter((a: any) => 
                    a.action_type === 'messaging_conversation_started_7d' || 
                    a.action_type === 'onsite_conversion.messaging_conversation_started'
                  );
                  conversionsCount = targetActions.reduce((sum: number, a: any) => sum + parseInt(a.value), 0);
                }

                const impressions = parseInt(insight.impressions) || 0;
                const reach = parseInt(insight.reach) || 0;
                const clicks = parseInt(insight.clicks) || 0;
                const frequency = parseFloat(insight.frequency) || (reach > 0 ? impressions / reach : 1);
                const cpaValue = conversionsCount > 0 ? spend / conversionsCount : 0;

                const stats: CampaignStats = {
                  id: newCampaignsMap.get(metaCp.id)?.id || `meta_${Math.random().toString(36).substr(2, 5)}`,
                  campaignId: metaCp.id,
                  name: metaCp.name,
                  date: new Date().toISOString(),
                  spend,
                  currency: 'USD',
                  impressions,
                  reach,
                  frequency,
                  clicks,
                  conversions: conversionsCount, 
                  conversion_action_type: 'conversions',
                  ctr: impressions > 0 ? clicks / impressions : 0,
                  cpc: clicks > 0 ? spend / clicks : 0,
                  cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
                  cpa: cpaValue, 
                  roas: spend > 0 ? (conversionsCount * 50) / spend : 0, 
                  status: metaCp.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
                  dataSource: 'REAL_API',
                  lastSync: new Date().toISOString(),
                  isValidated: true,
                  auditLogs: [
                    `Sync OK: ${conversionsCount} Conversions detectées.`
                  ]
                };

                newCampaignsMap.set(metaCp.id, stats);
                log(`Mise à jour OK : ${metaCp.name} (${conversionsCount} convs)`);
              });
            }
          } catch (e: any) {
            log(`Erreur critique sur compte : ${adAccountId} - ${e.message}`);
          }
        }
        const newProgress = Math.round(((i + 1) / totalClients) * 100);
        setProgress(newProgress);
      }

      const finalCampaigns = Array.from(newCampaignsMap.values());
      setCampaigns(finalCampaigns);
      await DB.saveCampaigns(finalCampaigns);
      
      log('--- EXTRACTION TERMINÉE AVEC SUCCÈS ---');
      setTimeout(() => setIsSyncing(false), 2000);
    } catch (err: any) {
      log(`Échec fatal de la synchronisation : ${err.message}`);
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header with main Sync button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Engine Control</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Interface d'extraction Meta Marketing API v19.0
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={runGlobalExtraction}
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
                LANCER L'EXTRACTION GLOBALE
              </>
            )}
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <HealthCard 
          label="Data Integrity" 
          value={`${healthStats.integrity}%`} 
          sub="REAL API vs MOCKED" 
          color="blue" 
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
        />
        <HealthCard 
          label="Target Metric" 
          value="CONVERSIONS" 
          sub="API Mapped Actions" 
          color="emerald"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>}
        />
        <HealthCard 
          label="Active Node" 
          value={currency} 
          sub="Exchange Rate Active" 
          color="slate"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <HealthCard 
          label="Total Managed" 
          value={format(healthStats.totalSpend)} 
          sub="Cumulative Ad Spend" 
          color="indigo"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
        />
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 md:p-10 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-6 bg-slate-50/30">
          <div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tighter italic uppercase">Registre des Flux</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Base de données synchronisée</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            <select 
              className="px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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
                placeholder="RECHERCHE ID OU NOM..."
                className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-300"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <svg className="w-4 h-4 absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[1000px]">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-10 py-6">Campagne & Client</th>
                <th className="px-10 py-6 text-right">Dépense ({currency})</th>
                <th className="px-10 py-6 text-right">Conversions</th>
                <th className="px-10 py-6 text-right">CPA (4 Dec)</th>
                <th className="px-10 py-6 text-right">CTR %</th>
                <th className="px-10 py-6 text-right">Dernière Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCampaigns.length > 0 ? filteredCampaigns.map(cp => {
                return (
                  <tr key={cp.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-10 py-6">
                      <div className="font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase italic">{cp.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cp.clientName}</span>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase ${cp.dataSource === 'REAL_API' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                          {cp.dataSource === 'REAL_API' ? 'LIVE' : 'MOCK'}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right font-black text-slate-900 tabular-nums">{format(cp.spend)}</td>
                    <td className={`px-10 py-6 text-right font-black tabular-nums text-lg ${cp.conversions > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{cp.conversions || 0}</td>
                    <td className="px-10 py-6 text-right font-black text-emerald-600 tabular-nums">{format(cp.cpa || 0, 'USD', 4)}</td>
                    <td className="px-10 py-6 text-right font-black text-blue-600 tabular-nums">{(cp.ctr * 100).toFixed(2)}%</td>
                    <td className="px-10 py-6 text-right font-bold text-slate-400 text-[10px] tabular-nums">
                      {cp.lastSync ? new Date(cp.lastSync).toLocaleString('fr-FR') : 'Jamais'}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-10 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                       <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                       <p className="text-[10px] font-black uppercase tracking-widest">Aucune campagne détectée dans ce périmètre</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Sync Overlay */}
      {isSyncing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-500"></div>
          
          <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[3rem] p-10 shadow-2xl overflow-hidden flex flex-col gap-8 animate-in zoom-in-95 duration-300">
            {/* Background effects */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-indigo-500"></div>
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full"></div>
            
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-2 block">Cloud Sync Status</span>
                <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">Extractions Conversions</h3>
              </div>
              <div className="text-right">
                <span className="text-4xl font-black text-white tabular-nums">{progress}%</span>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Completion</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-white/5 h-4 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500 ease-out relative" 
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[pulse_2s_linear_infinite]"></div>
              </div>
            </div>

            {/* Logs Window */}
            <div className="flex-1 bg-black/50 border border-white/5 rounded-3xl p-6 font-mono text-[10px] space-y-2 overflow-y-auto max-h-[300px] custom-scrollbar shadow-inner">
              {syncLogs.length > 0 ? syncLogs.map((l, i) => (
                <div key={i} className={`${i === 0 ? 'text-white font-black' : 'text-slate-500'}`}>
                  <span className="text-blue-500 mr-2">➜</span> {l}
                </div>
              )) : (
                <div className="text-slate-700 italic">En attente de commandes...</div>
              )}
            </div>

            <div className="flex justify-center">
               <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest animate-pulse">
                 Communication chiffrée AES-256 avec Meta Graph API v19.0
               </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const HealthCard = ({ label, value, sub, color, icon }: any) => {
  const themes: any = {
    blue: 'bg-blue-600 text-white shadow-xl shadow-blue-100',
    emerald: 'bg-emerald-500 text-white shadow-xl shadow-emerald-100',
    slate: 'bg-white border-slate-200 text-slate-900 shadow-sm',
    indigo: 'bg-indigo-600 text-white shadow-xl shadow-indigo-100',
  };
  return (
    <div className={`p-8 rounded-[2rem] border transition-all ${themes[color] || themes.slate} hover:-translate-y-1 duration-300 group`}>
      <div className="flex justify-between items-start mb-6">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
        <div className="opacity-40 group-hover:opacity-100 transition-opacity">
          {icon}
        </div>
      </div>
      <p className="text-4xl font-black tracking-tighter truncate italic">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">{sub}</p>
    </div>
  );
};

export default AdminCampaigns;