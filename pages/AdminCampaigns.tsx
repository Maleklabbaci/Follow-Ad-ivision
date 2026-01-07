
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

  const log = (msg: string) => setSyncLogs(prev => [msg, ...prev].slice(0, 15));

  const runGlobalExtraction = async () => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      alert("Configuration Meta API requise.");
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
        log(`Analyse Client : ${client.name}...`);
        let clientCampaignIds = [...(client.campaignIds || [])];
        
        for (const adAccountId of (client.adAccounts || [])) {
          try {
            // Requête complète incluant reach, frequency, impressions, spend et actions
            const url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=name,status,id,insights.date_preset(maximum){spend,impressions,reach,frequency,clicks,actions}&access_token=${token}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.data) {
              data.data.forEach((metaCp: any) => {
                const insight = metaCp.insights?.data?.[0] || {};
                
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
                const reach = parseInt(insight.reach) || 0;
                const frequency = parseFloat(insight.frequency) || (reach > 0 ? impressions / reach : 1);

                if (!clientCampaignIds.includes(metaCp.id)) clientCampaignIds.push(metaCp.id);

                const stats: CampaignStats = {
                  id: newCampaignsMap.get(metaCp.id)?.id || `ext_${Math.random().toString(36).substr(2, 9)}`,
                  campaignId: metaCp.id,
                  name: metaCp.name,
                  date: new Date().toISOString(),
                  spend,
                  impressions,
                  reach,
                  frequency,
                  clicks,
                  conversions,
                  ctr: impressions > 0 ? clicks / impressions : 0,
                  cpc: clicks > 0 ? spend / clicks : 0,
                  cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
                  cpa: conversions > 0 ? spend / conversions : 0,
                  roas: spend > 0 ? (conversions * AOV) / spend : 0,
                  status: metaCp.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
                  dataSource: 'REAL_API',
                  lastSync: new Date().toISOString(),
                  isValidated: spend > 0 && impressions > 0,
                  auditLogs: [`Sync Meta API complète effectuée avec succès.`]
                };

                newCampaignsMap.set(metaCp.id, stats);
              });
            }
          } catch (e) {
            log(`Erreur sur le compte ${adAccountId}`);
          }
        }
        
        updatedClients = updatedClients.map(c => c.id === client.id ? { ...c, campaignIds: clientCampaignIds } : c);
        setProgress(Math.round(((i + 1) / clients.length) * 100));
      }

      setCampaigns(Array.from(newCampaignsMap.values()));
      setClients(updatedClients);
      log('Extraction terminée. Données synchronisées.');
      setTimeout(() => setIsSyncing(false), 1500);
    } catch (err) {
      log('Échec de l\'extraction.');
      setIsSyncing(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Supprimer les données de ${name} ?`)) {
      setCampaigns(prev => prev.filter(c => c.id !== id));
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
          <h2 className="text-4xl font-black text-slate-900 tracking-tight italic">DATA AUDIT CENTER</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Moteur d'extraction Haute Précision v19.0</p>
        </div>
        <button 
          onClick={runGlobalExtraction}
          disabled={isSyncing}
          className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center gap-3"
        >
          <svg className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isSyncing ? 'EXTRACTION...' : 'TOUT EXTRAIRE (META)'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <HealthCard label="Source API" value={`${healthStats.integrity}%`} sub="Certifié Live" color="blue" />
        <HealthCard label="Précision Conversion" value="MAX" sub="Détail par Action" color="emerald" />
        <HealthCard label="Campagnes" value={campaigns.length.toString()} sub="En Base" color="slate" />
        <HealthCard label="Budget Global" value={`$${healthStats.totalSpend.toLocaleString()}`} sub="Sync Automatique" color="indigo" />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-10 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row justify-between items-center gap-6">
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Registre Centralisé</h3>
          <div className="flex gap-4 w-full sm:w-auto">
            <select 
              className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black outline-none uppercase shadow-sm"
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
            >
              <option value="all">Tous les clients</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-10 py-6">Campagne</th>
                <th className="px-10 py-6">Propriétaire</th>
                <th className="px-10 py-6 text-right">Dépense</th>
                <th className="px-10 py-6 text-right">Conv.</th>
                <th className="px-10 py-6 text-right">CPM</th>
                <th className="px-10 py-6 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50 transition-all">
                  <td className="px-10 py-8">
                    <div className="font-black text-slate-900">{cp.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {cp.campaignId}</div>
                  </td>
                  <td className="px-10 py-8">
                    <button onClick={() => setLinkingCampaignId(cp.campaignId)} className="text-blue-600 font-bold hover:underline">
                      {cp.clientName}
                    </button>
                  </td>
                  <td className="px-10 py-8 text-right font-black text-slate-900">${cp.spend.toLocaleString()}</td>
                  <td className="px-10 py-8 text-right font-black text-emerald-600">{cp.conversions}</td>
                  <td className="px-10 py-8 text-right font-bold text-slate-400">${cp.cpm.toFixed(2)}</td>
                  <td className="px-10 py-8 text-right font-black text-blue-600">{cp.roas.toFixed(2)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isSyncing && (
        <div className="fixed bottom-10 right-10 w-96 bg-slate-900 text-white rounded-[2rem] p-8 shadow-2xl z-50 border border-white/10">
          <div className="flex justify-between items-center mb-6">
            <span className="text-xs font-black uppercase tracking-widest text-blue-400">Sync Meta...</span>
            <span className="text-xs font-bold">{progress}%</span>
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
    blue: 'bg-blue-600 text-white',
    emerald: 'bg-emerald-500 text-white',
    slate: 'bg-white border-slate-200 text-slate-900',
    indigo: 'bg-indigo-600 text-white',
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
