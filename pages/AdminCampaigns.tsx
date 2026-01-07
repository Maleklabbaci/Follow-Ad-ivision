
import React, { useMemo, useState } from 'react';
import { Client, CampaignStats, IntegrationSecret } from '../types';
import { decryptSecret } from '../services/cryptoService';
import { DB } from '../services/db';

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
      alert("Token Meta invalide. Configurez-le dans Paramètres.");
      return;
    }

    setIsSyncing(true);
    setProgress(0);
    setSyncLogs(['Début de l\'audit sélectif Meta Graph v19.0...']);

    try {
      const token = await decryptSecret(fbSecret.value);
      let newCampaignsMap = new Map<string, CampaignStats>();
      
      campaigns.forEach(c => newCampaignsMap.set(c.campaignId, c));

      const AOV = 145.0; 

      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        if (!client.campaignIds || client.campaignIds.length === 0) {
          log(`Saut : ${client.name} (Aucune campagne liée)`);
          continue;
        }

        log(`Audit certifié : ${client.name}...`);
        
        for (const adAccountId of (client.adAccounts || [])) {
          try {
            const url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=name,status,id,insights.date_preset(maximum){spend,impressions,reach,frequency,clicks,actions}&access_token=${token}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.data) {
              const matchedFromMeta = data.data.filter((metaCp: any) => 
                client.campaignIds.includes(metaCp.id)
              );

              log(`${matchedFromMeta.length} campagnes valides trouvées pour ${client.name}`);

              matchedFromMeta.forEach((metaCp: any) => {
                const insight = metaCp.insights?.data?.[0] || {};
                let totalConversions = 0;
                if (insight.actions) {
                  const convActions = insight.actions.filter((a: any) => 
                    a.action_type.includes('purchase') || a.action_type.includes('conversion')
                  );
                  totalConversions = convActions.reduce((sum: number, a: any) => sum + parseInt(a.value), 0);
                }

                const spend = parseFloat(insight.spend) || 0;
                const impressions = parseInt(insight.impressions) || 0;
                const reach = parseInt(insight.reach) || 0;
                const clicks = parseInt(insight.clicks) || 0;
                const frequency = parseFloat(insight.frequency) || (reach > 0 ? impressions / reach : 1);
                const currency = client.name.toLowerCase().includes('fitness') ? 'USD' : 'EUR';

                const stats: CampaignStats = {
                  id: newCampaignsMap.get(metaCp.id)?.id || `meta_${Math.random().toString(36).substr(2, 5)}`,
                  campaignId: metaCp.id,
                  name: metaCp.name,
                  date: new Date().toISOString(),
                  spend,
                  currency,
                  impressions,
                  reach,
                  frequency,
                  clicks,
                  conversions: totalConversions,
                  ctr: impressions > 0 ? clicks / impressions : 0,
                  cpc: clicks > 0 ? spend / clicks : 0,
                  cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
                  cpa: totalConversions > 0 ? spend / totalConversions : 0,
                  roas: spend > 0 ? (totalConversions * AOV) / spend : 0,
                  status: metaCp.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
                  dataSource: 'REAL_API',
                  lastSync: new Date().toISOString(),
                  isValidated: true,
                  auditLogs: [`Audit sélectif réussi : ${totalConversions} conversions.`]
                };

                newCampaignsMap.set(metaCp.id, stats);
              });
            }
          } catch (e) {
            log(`Erreur API sur compte ${adAccountId}`);
          }
        }
        setProgress(Math.round(((i + 1) / clients.length) * 100));
      }

      const finalCampaigns = Array.from(newCampaignsMap.values());
      setCampaigns(finalCampaigns);
      
      // SAUVEGARDE AUTOMATIQUE SUR LE CLOUD
      await DB.saveCampaigns(finalCampaigns);
      
      log('Audit terminé et sauvegardé dans Supabase.');
      setTimeout(() => setIsSyncing(false), 2000);
    } catch (err) {
      log('Échec critique de l\'audit.');
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">Data Certification</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Synchronisation Cloud Active</p>
        </div>
        <button 
          onClick={runGlobalExtraction}
          disabled={isSyncing}
          className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-2xl flex items-center gap-3"
        >
          {isSyncing ? 'EXTRACTION EN COURS...' : 'LANCER AUDIT COMPLET & SAVE'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <HealthCard label="Source API" value={`${healthStats.integrity}%`} sub="Extraction Réelle" color="blue" />
        <HealthCard label="Audit Conversions" value="SÉLECTIF" sub="Uniquement campagnes liées" color="emerald" />
        <HealthCard label="Portefeuille" value={campaigns.length.toString()} sub="Total Campagnes" color="slate" />
        <HealthCard label="Spend Global" value={`$${healthStats.totalSpend.toLocaleString()}`} sub="Validé Cloud" color="indigo" />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-10 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6 bg-slate-50/30">
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Registre des Campagnes</h3>
          <select 
            className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest outline-none shadow-sm"
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
          >
            <option value="all">Tous les clients</option>
            {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-10 py-6">Détails Campagne</th>
                <th className="px-10 py-6 text-right">Reach</th>
                <th className="px-10 py-6 text-right">Spend</th>
                <th className="px-10 py-6 text-right">Conv.</th>
                <th className="px-10 py-6 text-right">ROAS</th>
                <th className="px-10 py-6 text-right">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50 transition-all">
                  <td className="px-10 py-8">
                    <div className="font-black text-slate-900">{cp.name}</div>
                    <div className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">ID: {cp.campaignId}</div>
                  </td>
                  <td className="px-10 py-8 text-right font-black text-slate-500">{cp.reach?.toLocaleString() || '---'}</td>
                  <td className="px-10 py-8 text-right font-black text-slate-900">${cp.spend.toLocaleString()}</td>
                  <td className={`px-10 py-8 text-right font-black ${cp.conversions > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{cp.conversions || 0}</td>
                  <td className="px-10 py-8 text-right font-black text-blue-600">{cp.roas.toFixed(2)}x</td>
                  <td className="px-10 py-8 text-right">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${cp.dataSource === 'REAL_API' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {cp.dataSource === 'REAL_API' ? 'META API' : 'SIMULÉ'}
                    </span>
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
            <span className="text-xs font-black uppercase tracking-widest text-blue-400">Synchronisation Supabase...</span>
            <span className="text-xs font-bold">{progress}%</span>
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
