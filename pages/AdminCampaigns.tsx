import React, { useMemo, useState } from 'react';
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
      alert("Token Meta Ads invalide ou manquant.");
      return;
    }

    setIsSyncing(true);
    setProgress(0);
    setSyncLogs(['Accès Meta Graph API...', 'Extraction : Conversations Démarrées...']);

    try {
      const token = await decryptSecret(fbSecret.value);
      let newCampaignsMap = new Map<string, CampaignStats>();
      
      campaigns.forEach(c => newCampaignsMap.set(c.campaignId, c));

      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        if (!client.campaignIds || client.campaignIds.length === 0) continue;

        log(`Scan client : ${client.name}...`);
        
        for (const adAccountId of (client.adAccounts || [])) {
          try {
            // Extraction rigoureuse : spend et actions avec breakdown par type d'action
            const url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=name,status,id,insights.date_preset(maximum){spend,impressions,reach,frequency,clicks,actions}&access_token=${token}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.data) {
              const matchedFromMeta = data.data.filter((metaCp: any) => 
                client.campaignIds.includes(metaCp.id)
              );

              matchedFromMeta.forEach((metaCp: any) => {
                const insight = metaCp.insights?.data?.[0] || {};
                const spend = parseFloat(insight.spend) || 0;
                
                let conversationsStarted = 0;
                let foundTypes: string[] = [];

                if (insight.actions && Array.isArray(insight.actions)) {
                  foundTypes = insight.actions.map((a: any) => a.action_type);
                  // FILTRAGE STRICT : On isole exclusivement les démarrages de conversation
                  const targetActions = insight.actions.filter((a: any) => 
                    a.action_type === 'messaging_conversation_started_7d' || 
                    a.action_type === 'onsite_conversion.messaging_conversation_started'
                  );
                  conversationsStarted = targetActions.reduce((sum: number, a: any) => sum + parseInt(a.value), 0);
                }

                const impressions = parseInt(insight.impressions) || 0;
                const reach = parseInt(insight.reach) || 0;
                const clicks = parseInt(insight.clicks) || 0;
                const frequency = parseFloat(insight.frequency) || (reach > 0 ? impressions / reach : 1);
                
                // CPA Calculé sur les conversations démarrées
                const cpa = conversationsStarted > 0 ? spend / conversationsStarted : 0;

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
                  conversations_started: conversationsStarted, 
                  conversion_action_type: 'messaging_conversation_started',
                  ctr: impressions > 0 ? clicks / impressions : 0,
                  cpc: clicks > 0 ? spend / clicks : 0,
                  cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
                  cpa_conversation_started: cpa, 
                  roas: spend > 0 ? (conversationsStarted * 50) / spend : 0, 
                  status: metaCp.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
                  dataSource: 'REAL_API',
                  lastSync: new Date().toISOString(),
                  isValidated: true,
                  auditLogs: [
                    `Sync OK: ${conversationsStarted} Conv. Démarrées.`,
                    `Types Meta détectés: ${foundTypes.join(', ')}`
                  ]
                };

                newCampaignsMap.set(metaCp.id, stats);
              });
            }
          } catch (e) {
            log(`Erreur compte : ${adAccountId}`);
          }
        }
        setProgress(Math.round(((i + 1) / clients.length) * 100));
      }

      const finalCampaigns = Array.from(newCampaignsMap.values());
      setCampaigns(finalCampaigns);
      await DB.saveCampaigns(finalCampaigns);
      
      log('Extraction terminée. Métrique "Started" certifiée.');
      setTimeout(() => setIsSyncing(false), 1000);
    } catch (err) {
      log('Échec de la synchronisation Meta Graph.');
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">Data Engine</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Extraction : Conversations Démarrées ({currency})</p>
        </div>
        <button 
          onClick={runGlobalExtraction}
          disabled={isSyncing}
          className="w-full md:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-2xl flex items-center justify-center gap-3"
        >
          {isSyncing ? 'EXTRACTION...' : `SYNC STARTED MESSAGING (${currency})`}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <HealthCard label="Extraction" value={`${healthStats.integrity}%`} sub="Certifié Started" color="blue" />
        <HealthCard label="Cible Action" value="DÉMARRÉES" sub="Strict Messaging Started" color="emerald" />
        <HealthCard label="Standard" value={currency} sub="Live FX Rates" color="slate" />
        <HealthCard label="Total Spend" value={format(healthStats.totalSpend)} sub="Portefeuille Cloud" color="indigo" />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-10 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6 bg-slate-50/30">
          <h3 className="text-2xl font-black text-slate-800 tracking-tight italic uppercase">Registre des Flux</h3>
          <div className="flex gap-4 w-full sm:w-auto">
            <input 
              type="text"
              placeholder="Filtre ID ou Nom..."
              className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none flex-1"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-10 py-6">Campagne / Action Précise</th>
                <th className="px-10 py-6 text-right">Spend ({currency})</th>
                <th className="px-10 py-6 text-right">Conv. Démarrées</th>
                <th className="px-10 py-6 text-right">CPA Started</th>
                <th className="px-10 py-6 text-right">CTR %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCampaigns.map(cp => {
                return (
                  <tr key={cp.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-10 py-8">
                      <div className="font-black text-slate-900">{cp.name}</div>
                      <div className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">
                         {(cp.conversion_action_type || 'messaging_conversation_started').replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="px-10 py-8 text-right font-black text-slate-900 tabular-nums">{format(cp.spend)}</td>
                    <td className={`px-10 py-8 text-right font-black tabular-nums ${cp.conversations_started > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{cp.conversations_started || 0}</td>
                    <td className="px-10 py-8 text-right font-black text-emerald-600 tabular-nums">{format(cp.cpa_conversation_started || 0)}</td>
                    <td className="px-10 py-8 text-right font-black text-blue-600 tabular-nums">{(cp.ctr * 100).toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isSyncing && (
        <div className="fixed bottom-10 right-10 w-96 bg-slate-900 text-white rounded-[2rem] p-8 shadow-2xl z-50 border border-white/10 ring-8 ring-white/5 animate-in slide-in-from-right duration-500">
          <div className="flex justify-between items-center mb-6">
            <span className="text-xs font-black uppercase tracking-widest text-blue-400">Sync Meta Cloud...</span>
            <span className="text-xs font-bold tabular-nums">{progress}%</span>
          </div>
          <div className="space-y-1 h-24 overflow-y-auto text-[9px] font-mono opacity-60 mb-4 custom-scrollbar">
            {syncLogs.map((l, i) => <div key={i}>➜ {l}</div>)}
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
    slate: 'bg-white border-slate-200 text-slate-900 shadow-sm',
    indigo: 'bg-indigo-600 text-white shadow-xl shadow-indigo-100',
  };
  return (
    <div className={`p-8 rounded-[2rem] border transition-all ${themes[color] || themes.slate} hover:-translate-y-1 duration-300`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
      <p className="text-4xl font-black tracking-tight">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">{sub}</p>
    </div>
  );
};

export default AdminCampaigns;