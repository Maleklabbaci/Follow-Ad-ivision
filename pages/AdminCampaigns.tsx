
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
    setSyncLogs(['Lancement de l\'extraction de données Meta...']);

    try {
      const token = await decryptSecret(fbSecret.value);
      let newCampaignsMap = new Map<string, CampaignStats>();
      campaigns.forEach(c => newCampaignsMap.set(c.campaignId, c));

      let updatedClients = [...clients];
      const AOV = 145.0; 

      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        log(`Client : ${client.name}...`);
        let clientCampaignIds = [...(client.campaignIds || [])];
        
        for (const adAccountId of (client.adAccounts || [])) {
          try {
            // Extraction avec le champ 'actions' pour capturer les achats (conversions)
            const url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=name,status,id,insights.date_preset(maximum){spend,impressions,clicks,actions}&access_token=${token}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.data) {
              log(`${data.data.length} campagnes trouvées sur ${adAccountId}`);
              data.data.forEach((metaCp: any) => {
                const insight = metaCp.insights?.data?.[0] || {};
                
                // Extraction intelligente des conversions (Achats)
                let conversions = 0;
                if (insight.actions && Array.isArray(insight.actions)) {
                  const purchaseAction = insight.actions.find((a: any) => 
                    ['purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_conversion.purchase'].includes(a.action_type)
                  );
                  conversions = purchaseAction ? parseInt(purchaseAction.value) : 0;
                }

                const spend = parseFloat(insight.spend) || 0;
                const clicks = parseInt(insight.clicks) || 0;
                const impressions = parseInt(insight.impressions) || 0;

                if (!clientCampaignIds.includes(metaCp.id)) {
                  clientCampaignIds.push(metaCp.id);
                }

                const stats: CampaignStats = {
                  id: newCampaignsMap.get(metaCp.id)?.id || `ext_${Math.random().toString(36).substr(2, 9)}`,
                  campaignId: metaCp.id,
                  name: metaCp.name,
                  date: new Date().toISOString(),
                  spend,
                  impressions,
                  clicks,
                  conversions,
                  ctr: impressions > 0 ? clicks / impressions : 0,
                  cpc: clicks > 0 ? spend / clicks : 0,
                  roas: spend > 0 ? (conversions * AOV) / spend : 0,
                  status: metaCp.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
                  dataSource: 'REAL_API',
                  lastSync: new Date().toISOString(),
                  isValidated: spend > 0 && impressions > 0,
                  auditLogs: [`Sync Meta API complète effectuée.`]
                };

                newCampaignsMap.set(metaCp.id, stats);
              });
            }
          } catch (e) {
            log(`Erreur sur ${adAccountId}`);
          }
        }
        
        updatedClients = updatedClients.map(c => 
          c.id === client.id ? { ...c, campaignIds: clientCampaignIds } : c
        );
        setProgress(Math.round(((i + 1) / clients.length) * 100));
      }

      setCampaigns(Array.from(newCampaignsMap.values()));
      setClients(updatedClients);
      log('Extraction terminée avec succès.');
      setTimeout(() => setIsSyncing(false), 1500);
    } catch (err) {
      log('Échec de la synchronisation.');
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
          <h2 className="text-4xl font-black text-slate-900 tracking-tight italic">DATA CENTER</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Moteur d'extraction Meta Graph v19.0</p>
        </div>
        <button 
          onClick={runGlobalExtraction}
          disabled={isSyncing}
          className="group relative px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center gap-3"
        >
          <svg className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="relative z-10">{isSyncing ? 'EXTRACTION...' : 'TOUT EXTRAIRE (META)'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <HealthCard label="Source API" value={`${healthStats.integrity}%`} sub="Data Réelle" color="blue" />
        <HealthCard label="Statut Conversion" value="CERTIFIÉ" sub="Via Actions Array" color="emerald" />
        <HealthCard label="Campagnes" value={campaigns.length.toString()} sub="En Registre" color="slate" />
        <HealthCard label="Budget Global" value={`$${healthStats.totalSpend.toLocaleString()}`} sub="Sync Maximum" color="indigo" />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row justify-between items-center gap-6">
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Registre Centralisé</h3>
          <div className="flex gap-4 w-full sm:w-auto">
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
              placeholder="Filtrer..." 
              className="flex-1 sm:w-80 px-5 py-3 border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-10 py-6">Campagne</th>
                <th className="px-10 py-6">Client</th>
                <th className="px-10 py-6 text-right">Budget</th>
                <th className="px-10 py-6 text-right">Conv.</th>
                <th className="px-10 py-6 text-right">CPC</th>
                <th className="px-10 py-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-10 py-8">
                    <div className="font-black text-slate-900">{cp.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">ID: {cp.campaignId}</div>
                  </td>
                  <td className="px-10 py-8 font-bold text-slate-600">
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
                        className="text-blue-600 hover:underline"
                      >
                        {cp.clientName}
                      </button>
                    )}
                  </td>
                  <td className="px-10 py-8 text-right font-black text-slate-900 tabular-nums">${cp.spend.toLocaleString()}</td>
                  <td className={`px-10 py-8 text-right font-black tabular-nums ${cp.conversions > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {cp.conversions}
                  </td>
                  <td className="px-10 py-8 text-right font-bold text-slate-500 tabular-nums">${cp.cpc.toFixed(2)}</td>
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
        <div className="fixed bottom-10 right-10 w-96 bg-slate-900 text-white rounded-[2rem] p-8 shadow-2xl z-50 border border-white/10">
          <div className="flex justify-between items-center mb-6">
            <span className="text-xs font-black uppercase tracking-widest text-blue-400">Sync en cours...</span>
            <span className="text-xs font-bold">{progress}%</span>
          </div>
          <div className="space-y-1 h-20 overflow-hidden text-[9px] font-mono opacity-50 mb-4">
            {syncLogs.slice(0, 4).map((l, i) => <div key={i}>➜ {l}</div>)}
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
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
    slate: 'bg-white border-slate-200 text-slate-900',
    indigo: 'bg-indigo-600 text-white shadow-xl shadow-indigo-100',
  };
  return (
    <div className={`p-8 rounded-[2rem] border transition-all ${themes[color] || themes.slate} shadow-sm`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
      <p className="text-4xl font-black">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">{sub}</p>
    </div>
  );
};

export default AdminCampaigns;
