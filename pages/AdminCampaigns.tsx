
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

const AdminCampaigns: React.FC<AdminCampaignsProps> = ({ clients, setClients, campaigns, setCampaigns, secrets }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [linkingCampaignId, setLinkingCampaignId] = useState<string | null>(null);

  const healthStats = useMemo(() => {
    const total = campaigns.length;
    const real = campaigns.filter(c => c.dataSource === 'REAL_API').length;
    const validated = campaigns.filter(c => c.isValidated).length;
    return {
      integrity: total > 0 ? Math.round((real / total) * 100) : 0,
      validationRate: total > 0 ? Math.round((validated / total) * 100) : 0,
      totalSpend: campaigns.reduce((sum, c) => sum + c.spend, 0)
    };
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.map(campaign => {
      const associatedClient = clients.find(c => c.campaignIds.includes(campaign.campaignId));
      return {
        ...campaign,
        clientName: associatedClient ? associatedClient.name : 'Non assignée',
        clientId: associatedClient ? associatedClient.id : null
      };
    }).filter(cp => {
      const matchesSearch = cp.name.toLowerCase().includes(searchTerm.toLowerCase()) || cp.campaignId.includes(searchTerm);
      const matchesClient = filterClient === 'all' || cp.clientId === filterClient;
      return matchesSearch && matchesClient;
    }).sort((a, b) => (b.lastSync || '').localeCompare(a.lastSync || ''));
  }, [campaigns, clients, searchTerm, filterClient]);

  const log = (msg: string) => setSyncLogs(prev => [msg, ...prev].slice(0, 10));

  const handleLinkClient = (campaignId: string, targetClientId: string) => {
    setClients(prev => prev.map(client => {
      const isCurrentOwner = client.campaignIds.includes(campaignId);
      const isTarget = client.id === targetClientId;

      let newIds = [...client.campaignIds];
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
    if (window.confirm(`Confirmer la suppression de la campagne : ${name} ?`)) {
      const campaignToDelete = campaigns.find(c => c.id === id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      
      if (campaignToDelete) {
        setClients(prev => prev.map(c => ({
          ...c,
          campaignIds: c.campaignIds.filter(cid => cid !== campaignToDelete.campaignId)
        })));
      }
    }
  };

  const refreshSingleCampaign = async (campaign: CampaignStats) => {
    if (campaign.dataSource !== 'REAL_API') {
      alert("Seules les campagnes certifiées API peuvent être actualisées.");
      return;
    }

    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      alert("Clé Meta API non valide.");
      return;
    }

    setRefreshingId(campaign.id);
    try {
      const token = await decryptSecret(fbSecret.value);
      const res = await fetch(`https://graph.facebook.com/v19.0/${campaign.campaignId}?fields=name,status,insights{spend,impressions,clicks,conversions}&access_token=${token}`);
      const data = await res.json();

      if (data.error) throw new Error(data.error.message);

      const insights = data.insights?.data?.[0] || { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
      
      setCampaigns(prev => prev.map(cp => {
        if (cp.id === campaign.id) {
          return {
            ...cp,
            spend: parseFloat(insights.spend || 0),
            impressions: parseInt(insights.impressions || 0),
            clicks: parseInt(insights.clicks || 0),
            conversions: parseInt(insights.conversions || 0),
            roas: insights.spend > 0 ? (insights.conversions * 145) / insights.spend : 0,
            lastSync: new Date().toISOString(),
            isValidated: true,
            auditLogs: [...(cp.auditLogs || []), `Actualisation réussie le ${new Date().toLocaleString()}`]
          };
        }
        return cp;
      }));
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setRefreshingId(null);
    }
  };

  const purgeMockData = () => {
    const mockCount = campaigns.filter(c => c.dataSource === 'MOCK').length;
    if (mockCount === 0) return;
    if (window.confirm(`Supprimer les ${mockCount} campagnes simulées ?`)) {
      setCampaigns(prev => prev.filter(c => c.dataSource === 'REAL_API'));
    }
  };

  const runGlobalExtraction = async () => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      alert("Clé Meta API non configurée.");
      return;
    }

    setIsSyncing(true);
    setProgress(0);
    setSyncLogs(['Initialisation de l\'extraction...']);

    try {
      const token = await decryptSecret(fbSecret.value);
      let updatedCampaigns = [...campaigns];
      let updatedClients = [...clients];
      
      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        let clientCampaignIds = [...client.campaignIds];
        log(`Scan: ${client.name}...`);
        
        for (const adAccountId of client.adAccounts) {
          try {
            const res = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=name,status,id,insights{spend,impressions,clicks,conversions}&access_token=${token}`);
            const data = await res.json();

            if (data.data) {
              data.data.forEach((metaCp: any) => {
                const insights = metaCp.insights?.data?.[0] || { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
                const existingIdx = updatedCampaigns.findIndex(c => c.campaignId === metaCp.id);
                
                // On s'assure que la campagne est liée au client si elle vient de son compte
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
                  auditLogs: [...(updatedCampaigns[existingIdx]?.auditLogs || []), `Synchronisé via API le ${new Date().toLocaleString()}`]
                };

                if (existingIdx >= 0) updatedCampaigns[existingIdx] = validatedData;
                else updatedCampaigns.push(validatedData);
              });
            }
          } catch (e) {
            log(`Erreur sur compte ${adAccountId}`);
          }
        }
        
        // Mise à jour du client avec ses nouvelles campagnes extraites
        updatedClients = updatedClients.map(c => 
          c.id === client.id ? { ...c, campaignIds: clientCampaignIds } : c
        );
        
        setProgress(Math.round(((i + 1) / clients.length) * 100));
      }

      setCampaigns(updatedCampaigns);
      setClients(updatedClients);
      log('Extraction et liaison terminées.');
    } catch (err) {
      log('Erreur fatale.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Data Certification Hub</h2>
          <p className="text-slate-500 font-medium">Extraire, auditer et certifier vos données marketing.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          <button 
            onClick={purgeMockData}
            className="flex-1 lg:flex-none px-6 py-3 bg-red-50 text-red-600 border border-red-100 rounded-2xl font-black text-sm hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            Nettoyer Simulations
          </button>
          <button 
            onClick={runGlobalExtraction}
            disabled={isSyncing || isAuditing}
            className="flex-1 lg:flex-none px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
          >
            <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isSyncing ? 'Extraction...' : 'Actualiser Tout (Meta)'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <HealthCard label="Certifié API" value={`${healthStats.integrity}%`} sub="Source réelle" color="blue" />
        <HealthCard label="Validation Rate" value={`${healthStats.validationRate}%`} sub="Sans anomalie" color="emerald" />
        <HealthCard label="Total Audité" value={campaigns.length.toString()} sub="En base" color="slate" />
        <HealthCard label="Budget Validé" value={`$${healthStats.totalSpend.toLocaleString(undefined, {maximumFractionDigits: 0})}`} sub="Investi" color="indigo" />
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-xl font-bold text-slate-800">Registre de Certification</h3>
          <div className="flex gap-4 w-full sm:w-auto">
            <input 
              type="text" 
              placeholder="Chercher ID ou Nom..." 
              className="flex-1 sm:w-64 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-5">Campagne & ID</th>
                <th className="px-8 py-5">Assignation Client</th>
                <th className="px-8 py-5 text-center">Intégrité</th>
                <th className="px-8 py-5 text-right">Metrics</th>
                <th className="px-8 py-5 text-right">ROAS</th>
                <th className="px-8 py-5 text-right">Dernier Check</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50/80 transition-all group">
                  <td className="px-8 py-6">
                    <div className="font-bold text-slate-900 line-clamp-1">{cp.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">ID: {cp.campaignId}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    {linkingCampaignId === cp.campaignId ? (
                      <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                        <select 
                          className="px-3 py-1.5 bg-white border border-blue-500 text-blue-900 rounded-lg text-xs font-bold outline-none shadow-sm"
                          value={cp.clientId || ''}
                          onChange={(e) => handleLinkClient(cp.campaignId, e.target.value)}
                        >
                          <option value="">-- Détacher --</option>
                          {clients.map(client => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                          ))}
                        </select>
                        <button 
                          onClick={() => setLinkingCampaignId(null)}
                          className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setLinkingCampaignId(cp.campaignId)}
                        className={`group/link flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border ${
                          cp.clientId 
                            ? 'bg-blue-50 text-blue-700 border-blue-100 hover:border-blue-300' 
                            : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100 hover:text-slate-600'
                        }`}
                      >
                        <span className="text-[11px] font-black uppercase tracking-tight">{cp.clientName}</span>
                        <svg className="w-3.5 h-3.5 opacity-0 group-hover/link:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    )}
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${cp.dataSource === 'REAL_API' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                          {cp.dataSource === 'REAL_API' ? 'API Meta' : 'MOCK'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${cp.isValidated ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {cp.isValidated ? 'VALIDE' : 'A VÉRIFIER'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right font-black text-slate-900 tabular-nums">
                    <div>${cp.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className="text-[10px] text-slate-400 font-bold">{cp.conversions} conv.</div>
                  </td>
                  <td className="px-8 py-6 text-right font-black text-blue-600 tabular-nums">{cp.roas.toFixed(2)}x</td>
                  <td className="px-8 py-6 text-right">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tabular-nums">
                      {cp.lastSync ? new Date(cp.lastSync).toLocaleTimeString() : '---'}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      {cp.dataSource === 'REAL_API' && (
                        <button 
                          onClick={() => refreshSingleCampaign(cp)}
                          disabled={refreshingId === cp.id}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Actualiser les données Meta"
                        >
                          <svg className={`w-5 h-5 ${refreshingId === cp.id ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(cp.id, cp.name)}
                        className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Supprimer la campagne"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCampaigns.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-8 py-20 text-center text-slate-400 italic font-medium">
                    Aucune campagne trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isSyncing && (
        <div className="fixed bottom-8 right-8 w-80 bg-slate-900 text-white rounded-3xl p-6 shadow-2xl border border-white/10 animate-in slide-in-from-bottom-10">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-black uppercase tracking-widest text-blue-400">Extraction Meta</span>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          </div>
          <div className="space-y-2 mb-6 h-20 overflow-hidden text-[10px] font-mono opacity-80">
            {syncLogs.map((log, i) => <div key={i} className={i === 0 ? 'text-white font-bold' : 'text-slate-500'}>{`> ${log}`}</div>)}
          </div>
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}
    </div>
  );
};

const HealthCard = ({ label, value, sub, color }: { label: string, value: string, sub: string, color: string }) => {
  const themes: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100 text-blue-900',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    slate: 'bg-slate-50 border-slate-200 text-slate-900',
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-900',
  };
  return (
    <div className={`p-6 rounded-3xl border ${themes[color]} shadow-sm`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
      <p className="text-3xl font-black mb-1">{value}</p>
      <p className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">{sub}</p>
    </div>
  );
};

export default AdminCampaigns;
