
import React, { useMemo, useState } from 'react';
import { Client, CampaignStats, IntegrationSecret } from '../types';
import { decryptSecret } from '../services/cryptoService';

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
  const [linkingCampaignId, setLinkingCampaignId] = useState<string | null>(null);

  const healthStats = useMemo(() => {
    const total = Array.isArray(campaigns) ? campaigns.length : 0;
    const real = campaigns.filter(c => c?.dataSource === 'REAL_API').length;
    const validated = campaigns.filter(c => c?.isValidated).length;
    const totalSpend = campaigns.reduce((sum, c) => sum + (Number(c?.spend) || 0), 0);
    return {
      integrity: total > 0 ? Math.round((real / total) * 100) : 0,
      validationRate: total > 0 ? Math.round((validated / total) * 100) : 0,
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

  const log = (msg: string) => setSyncLogs(prev => [msg, ...prev].slice(0, 15));

  const runGlobalExtraction = async () => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      alert("Configuration Meta API requise. Allez dans Paramètres pour valider votre token.");
      return;
    }

    setIsSyncing(true);
    setProgress(0);
    setSyncLogs(['Initialisation de l\'extraction profonde...']);

    try {
      const token = await decryptSecret(fbSecret.value);
      let newCampaignsMap = new Map<string, CampaignStats>();
      
      // On garde les campagnes actuelles pour ne pas perdre l'historique local si l'API échoue sur une
      campaigns.forEach(c => newCampaignsMap.set(c.campaignId, c));

      let updatedClients = [...clients];
      const AOV = 145.0; // Panier moyen par défaut pour calcul ROAS

      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        log(`Analyse du portefeuille : ${client.name}...`);
        let clientCampaignIds = [...(client.campaignIds || [])];
        
        for (const adAccountId of (client.adAccounts || [])) {
          try {
            // Utilisation de date_preset(maximum) pour TOUT récupérer, pas juste aujourd'hui
            const url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=name,status,id,insights.date_preset(maximum){spend,impressions,clicks,conversions}&access_token=${token}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.error) {
              log(`Erreur API sur ${adAccountId}: ${data.error.message}`);
              continue;
            }

            if (data.data) {
              log(`Extraction de ${data.data.length} campagnes pour ${client.name}`);
              data.data.forEach((metaCp: any) => {
                const insight = metaCp.insights?.data?.[0] || { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
                
                const spend = parseFloat(insight.spend) || 0;
                const clicks = parseInt(insight.clicks) || 0;
                const conversions = parseInt(insight.conversions) || 0;
                const impressions = parseInt(insight.impressions) || 0;

                if (!clientCampaignIds.includes(metaCp.id)) {
                  clientCampaignIds.push(metaCp.id);
                }

                const stats: CampaignStats = {
                  id: newCampaignsMap.get(metaCp.id)?.id || `ext_${Math.random().toString(36).substr(2, 9)}`,
                  campaignId: metaCp.id,
                  name: metaCp.name,
                  date: new Date().toISOString(),
                  spend: spend,
                  impressions: impressions,
                  clicks: clicks,
                  conversions: conversions,
                  ctr: impressions > 0 ? clicks / impressions : 0,
                  cpc: clicks > 0 ? spend / clicks : 0,
                  roas: spend > 0 ? (conversions * AOV) / spend : 0,
                  status: metaCp.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
                  dataSource: 'REAL_API',
                  lastSync: new Date().toISOString(),
                  isValidated: true,
                  auditLogs: [`Sync Meta API complète le ${new Date().toLocaleString()}`]
                };

                newCampaignsMap.set(metaCp.id, stats);
              });
            }
          } catch (e) {
            log(`Échec réseau sur le compte ${adAccountId}`);
          }
        }
        
        // Mettre à jour les IDs liés au client
        updatedClients = updatedClients.map(c => 
          c.id === client.id ? { ...c, campaignIds: clientCampaignIds } : c
        );
        setProgress(Math.round(((i + 1) / clients.length) * 100));
      }

      setCampaigns(Array.from(newCampaignsMap.values()));
      setClients(updatedClients);
      log('Extraction terminée avec succès.');
      setTimeout(() => setIsSyncing(false), 2000);
    } catch (err) {
      log('Erreur fatale lors de la synchronisation.');
      setIsSyncing(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Supprimer définitivement les données de ${name} ?`)) {
      const target = campaigns.find(c => c.id === id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      if (target) {
        setClients(prev => prev.map(c => ({
          ...c,
          campaignIds: (c.campaignIds || []).filter(cid => cid !== target.campaignId)
        })));
      }
    }
  };

  const handleLinkClient = (campaignId: string, targetClientId: string) => {
    setClients(prev => prev.map(client => {
      const ids = Array.isArray(client.campaignIds) ? client.campaignIds : [];
      const isCurrentOwner = ids.includes(campaignId);
      const isTarget = client.id === targetClientId;

      let newIds = [...ids];
      if (isCurrentOwner && !isTarget) newIds = newIds.filter(id => id !== campaignId);
      if (isTarget && !isCurrentOwner) newIds.push(campaignId);
      
      return { ...client, campaignIds: newIds };
    }));
    setLinkingCampaignId(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight italic">DATA CERTIFICATION</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Moteur d'extraction Meta Graph v19.0</p>
        </div>
        <button 
          onClick={runGlobalExtraction}
          disabled={isSyncing}
          className="group relative px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-2xl flex items-center gap-3 overflow-hidden"
        >
          {isSyncing && <div className="absolute inset-0 bg-blue-600/20 animate-pulse"></div>}
          <svg className={`w-5 h-5 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="relative z-10">{isSyncing ? 'EXTRACTION EN COURS...' : 'TOUT EXTRAIRE (META)'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <HealthCard label="Source API" value={`${healthStats.integrity}%`} sub="Certifié Réel" color="blue" />
        <HealthCard label="Audit ROI" value={`${healthStats.validationRate}%`} sub="Data Cohérente" color="emerald" />
        <HealthCard label="Campagnes" value={campaigns.length.toString()} sub="Total Registre" color="slate" />
        <HealthCard label="Budget Global" value={`$${healthStats.totalSpend.toLocaleString(undefined, {maximumFractionDigits: 0})}`} sub="Investi" color="indigo" />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Registre Master</h3>
          <div className="flex flex-wrap gap-4 w-full sm:w-auto">
            <select 
              className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-xs outline-none font-black uppercase tracking-widest shadow-sm"
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
            >
              <option value="all">Tous les clients</option>
              <option value="unassigned">Non assignées</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input 
              type="text" 
              placeholder="Rechercher ID ou Nom..." 
              className="flex-1 sm:w-80 px-5 py-3 border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-10 py-6">Campagne</th>
                <th className="px-10 py-6">Propriétaire</th>
                <th className="px-10 py-6 text-center">Source</th>
                <th className="px-10 py-6 text-right">Budget</th>
                <th className="px-10 py-6 text-right">ROAS</th>
                <th className="px-10 py-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50/80 transition-all group">
                  <td className="px-10 py-8">
                    <div className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{cp.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">ID: {cp.campaignId}</div>
                  </td>
                  <td className="px-10 py-8">
                    {linkingCampaignId === cp.campaignId ? (
                      <select 
                        className="px-4 py-2 border-2 border-blue-500 rounded-xl text-xs font-bold bg-white"
                        autoFocus
                        value={cp.clientId || ''}
                        onChange={(e) => handleLinkClient(cp.campaignId, e.target.value)}
                        onBlur={() => setLinkingCampaignId(null)}
                      >
                        <option value="">-- DÉTACHER --</option>
                        {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : (
                      <button 
                        onClick={() => setLinkingCampaignId(cp.campaignId)}
                        className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                      >
                        {cp.clientName}
                      </button>
                    )}
                  </td>
                  <td className="px-10 py-8 text-center">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${cp.dataSource === 'REAL_API' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {cp.dataSource === 'REAL_API' ? 'META API' : 'SIMULÉ'}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-right font-black text-slate-900 text-lg tabular-nums">
                    ${(cp.spend || 0).toLocaleString()}
                  </td>
                  <td className={`px-10 py-8 text-right font-black tabular-nums text-lg ${cp.roas > 4 ? 'text-emerald-500' : 'text-blue-500'}`}>
                    {(cp.roas || 0).toFixed(2)}x
                  </td>
                  <td className="px-10 py-8 text-right">
                    <button onClick={() => handleDelete(cp.id, cp.name)} className="p-2 text-slate-300 hover:text-red-600 transition-colors">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isSyncing && (
        <div className="fixed bottom-10 right-10 w-96 bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl z-50 border border-white/10 animate-in slide-in-from-right-10 duration-500">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
               <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping"></div>
               <span className="text-xs font-black uppercase tracking-widest text-blue-400">SYNC META EN COURS</span>
            </div>
            <span className="text-xs font-bold text-slate-500">{progress}%</span>
          </div>
          <div className="space-y-2 mb-8 h-24 overflow-y-auto custom-scrollbar pr-2">
            {syncLogs.map((log, i) => (
              <div key={i} className="text-[10px] font-mono opacity-80 border-l border-blue-500/30 pl-3 py-1">
                <span className="text-blue-500 font-bold mr-2">➜</span>{log}
              </div>
            ))}
          </div>
          <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}
    </div>
  );
};

const HealthCard = ({ label, value, sub, color }: any) => {
  const themes: any = {
    blue: 'bg-blue-600 text-white shadow-xl shadow-blue-100 border-transparent',
    emerald: 'bg-white border-slate-200 text-slate-900',
    slate: 'bg-slate-900 text-white shadow-xl shadow-slate-200 border-transparent',
    indigo: 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 border-transparent',
  };
  return (
    <div className={`p-8 rounded-[2rem] border transition-all hover:scale-105 duration-300 ${themes[color] || themes.slate}`}>
      <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${color === 'blue' || color === 'slate' || color === 'indigo' ? 'text-white/60' : 'text-slate-400'}`}>{label}</p>
      <p className="text-4xl font-black tabular-nums">{value || '---'}</p>
      <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${color === 'blue' || color === 'slate' || color === 'indigo' ? 'text-white/40' : 'text-slate-300'}`}>{sub}</p>
    </div>
  );
};

export default AdminCampaigns;
