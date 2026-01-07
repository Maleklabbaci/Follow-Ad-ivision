
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
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [linkingCampaignId, setLinkingCampaignId] = useState<string | null>(null);

  const healthStats = useMemo(() => {
    try {
      const total = Array.isArray(campaigns) ? campaigns.length : 0;
      const real = campaigns.filter(c => c?.dataSource === 'REAL_API').length;
      const validated = campaigns.filter(c => c?.isValidated).length;
      const totalSpend = campaigns.reduce((sum, c) => sum + (Number(c?.spend) || 0), 0);
      return {
        integrity: total > 0 ? Math.round((real / total) * 100) : 0,
        validationRate: total > 0 ? Math.round((validated / total) * 100) : 0,
        totalSpend
      };
    } catch { return { integrity: 0, validationRate: 0, totalSpend: 0 }; }
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    try {
      if (!Array.isArray(campaigns)) return [];
      
      return campaigns.map(campaign => {
        if (!campaign) return null;
        const associatedClient = clients.find(c => c?.campaignIds?.includes(campaign.campaignId));
        return {
          ...campaign,
          clientName: associatedClient ? associatedClient.name : 'Non assignée',
          clientId: associatedClient ? associatedClient.id : null
        };
      }).filter((cp): cp is any => {
        if (!cp) return false;
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
    } catch { return []; }
  }, [campaigns, clients, searchTerm, filterClient]);

  const log = (msg: string) => setSyncLogs(prev => [msg, ...prev].slice(0, 10));

  const handleLinkClient = (campaignId: string, targetClientId: string) => {
    setClients(prev => prev.map(client => {
      const ids = Array.isArray(client.campaignIds) ? client.campaignIds : [];
      const isCurrentOwner = ids.includes(campaignId);
      const isTarget = client.id === targetClientId;

      let newIds = [...ids];
      if (isCurrentOwner && !isTarget) {
        newIds = newIds.filter(id => id !== campaignId);
      }
      if (isTarget && !isCurrentOwner) {
        newIds.push(campaignId);
      }
      
      return { ...client, campaignIds: newIds };
    }));
    setLinkingCampaignId(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Supprimer ${name} ?`)) {
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

  const runGlobalExtraction = async () => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      alert("Config Meta API requise dans Paramètres.");
      return;
    }

    setIsSyncing(true);
    setProgress(0);
    setSyncLogs(['Démarrage...']);

    try {
      const token = await decryptSecret(fbSecret.value);
      let updatedCampaigns = [...campaigns];
      let updatedClients = [...clients];
      
      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        let clientCampaignIds = [...(client.campaignIds || [])];
        log(`Scan: ${client.name}...`);
        
        for (const adAccountId of (client.adAccounts || [])) {
          try {
            const res = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=name,status,id,insights{spend,impressions,clicks,conversions}&access_token=${token}`);
            const data = await res.json();

            if (data.data) {
              data.data.forEach((metaCp: any) => {
                const insights = metaCp.insights?.data?.[0] || { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
                const existingIdx = updatedCampaigns.findIndex(c => c.campaignId === metaCp.id);
                
                if (!clientCampaignIds.includes(metaCp.id)) {
                  clientCampaignIds.push(metaCp.id);
                }

                const validatedData: CampaignStats = {
                  id: existingIdx >= 0 ? updatedCampaigns[existingIdx].id : `ext_${Math.random().toString(36).substr(2, 9)}`,
                  campaignId: metaCp.id,
                  name: metaCp.name,
                  date: new Date().toISOString(),
                  spend: parseFloat(insights.spend || 0),
                  impressions: parseInt(insights.impressions || 0),
                  clicks: parseInt(insights.clicks || 0),
                  conversions: parseInt(insights.conversions || 0),
                  ctr: insights.impressions > 0 ? insights.clicks / insights.impressions : 0,
                  cpc: insights.clicks > 0 ? insights.spend / insights.clicks : 0,
                  roas: insights.spend > 0 ? (insights.conversions * 145) / insights.spend : 0,
                  status: metaCp.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
                  dataSource: 'REAL_API',
                  lastSync: new Date().toISOString(),
                  isValidated: true,
                  auditLogs: [`Sync API le ${new Date().toLocaleString()}`]
                };

                if (existingIdx >= 0) updatedCampaigns[existingIdx] = validatedData;
                else updatedCampaigns.push(validatedData);
              });
            }
          } catch (e) { log(`Erreur compte ${adAccountId}`); }
        }
        
        updatedClients = updatedClients.map(c => 
          c.id === client.id ? { ...c, campaignIds: clientCampaignIds } : c
        );
        setProgress(Math.round(((i + 1) / clients.length) * 100));
      }

      setCampaigns(updatedCampaigns);
      setClients(updatedClients);
      log('Extraction terminée.');
    } catch { log('Erreur fatale.'); } finally { setIsSyncing(false); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Data Certification Hub</h2>
          <p className="text-slate-500 font-medium">Extraire et auditer vos données marketing.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          <button 
            onClick={runGlobalExtraction}
            disabled={isSyncing}
            className="flex-1 lg:flex-none px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
          >
            {isSyncing ? 'Extraction...' : 'Actualiser Tout (Meta)'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <HealthCard label="Certifié API" value={`${healthStats.integrity}%`} sub="Source réelle" color="blue" />
        <HealthCard label="Validation" value={`${healthStats.validationRate}%`} sub="Sans anomalie" color="emerald" />
        <HealthCard label="Total" value={campaigns.length.toString()} sub="En base" color="slate" />
        <HealthCard label="Budget Audité" value={`$${healthStats.totalSpend.toLocaleString(undefined, {maximumFractionDigits: 0})}`} sub="Investi" color="indigo" />
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-xl font-bold text-slate-800">Registre</h3>
          <div className="flex flex-wrap gap-4 w-full sm:w-auto">
            <select 
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none font-bold"
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
            >
              <option value="all">Tous les clients</option>
              <option value="unassigned">Non assignées</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input 
              type="text" 
              placeholder="Chercher..." 
              className="flex-1 sm:w-64 px-4 py-2 border rounded-xl text-sm outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-5">Campagne</th>
                <th className="px-8 py-5">Client</th>
                <th className="px-8 py-5 text-center">Intégrité</th>
                <th className="px-8 py-5 text-right">Metrics</th>
                <th className="px-8 py-5 text-right">ROAS</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50/80 transition-all group">
                  <td className="px-8 py-6">
                    <div className="font-bold text-slate-900">{cp.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">ID: {cp.campaignId}</div>
                  </td>
                  <td className="px-8 py-6">
                    {linkingCampaignId === cp.campaignId ? (
                      <select 
                        className="px-3 py-1.5 border border-blue-500 rounded-lg text-xs"
                        value={cp.clientId || ''}
                        onChange={(e) => handleLinkClient(cp.campaignId, e.target.value)}
                        onBlur={() => setLinkingCampaignId(null)}
                      >
                        <option value="">-- Détacher --</option>
                        {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : (
                      <button 
                        onClick={() => setLinkingCampaignId(cp.campaignId)}
                        className="text-xs font-black text-blue-600 uppercase"
                      >
                        {cp.clientName}
                      </button>
                    )}
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${cp.isValidated ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {cp.isValidated ? 'VALIDE' : 'A VÉRIFIER'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right font-black text-slate-900">
                    ${(cp.spend || 0).toLocaleString()}
                  </td>
                  <td className="px-8 py-6 text-right font-black text-blue-600">
                    {(cp.roas || 0).toFixed(2)}x
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button onClick={() => handleDelete(cp.id, cp.name)} className="text-red-300 hover:text-red-600 font-bold text-xs uppercase">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isSyncing && (
        <div className="fixed bottom-8 right-8 w-80 bg-slate-900 text-white rounded-3xl p-6 shadow-2xl z-50">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-black uppercase tracking-widest text-blue-400">Sync Meta</span>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          </div>
          <div className="space-y-1 mb-6 h-12 overflow-hidden text-[9px] font-mono opacity-80">
            {syncLogs.map((log, i) => <div key={i}>{`> ${log}`}</div>)}
          </div>
          <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full transition-all" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}
    </div>
  );
};

const HealthCard = ({ label, value, sub, color }: any) => {
  const themes: any = {
    blue: 'bg-blue-50 border-blue-100 text-blue-900',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    slate: 'bg-slate-50 border-slate-200 text-slate-900',
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-900',
  };
  return (
    <div className={`p-6 rounded-3xl border ${themes[color] || themes.slate}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
      <p className="text-3xl font-black">{value || '---'}</p>
      <p className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">{sub}</p>
    </div>
  );
};

export default AdminCampaigns;
