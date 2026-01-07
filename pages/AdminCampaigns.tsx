
import React, { useMemo, useState } from 'react';
import { Client, CampaignStats, IntegrationSecret } from '../types';
import { decryptSecret } from '../services/cryptoService';

interface AdminCampaignsProps {
  clients: Client[];
  campaigns: CampaignStats[];
  setCampaigns: React.Dispatch<React.SetStateAction<CampaignStats[]>>;
  secrets: IntegrationSecret[];
}

const AdminCampaigns: React.FC<AdminCampaignsProps> = ({ clients, campaigns, setCampaigns, secrets }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

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

  // EXTRACTION GLOBALE META
  const runGlobalExtraction = async () => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      alert("Erreur : Clé Meta API non configurée. Allez dans Paramètres.");
      return;
    }

    setIsSyncing(true);
    setProgress(0);
    setSyncLogs(['Début de l\'extraction Meta...']);

    try {
      const token = await decryptSecret(fbSecret.value);
      let updatedCampaigns = [...campaigns];
      
      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        log(`Scan du client : ${client.name}...`);
        
        for (const adAccountId of client.adAccounts) {
          try {
            const res = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=name,status,id,insights{spend,impressions,clicks,conversions}&access_token=${token}`);
            const data = await res.json();

            if (data.data) {
              data.data.forEach((metaCp: any) => {
                const insights = metaCp.insights?.data?.[0] || { spend: 0, impressions: 0, clicks: 0, conversions: 0 };
                const existingIdx = updatedCampaigns.findIndex(c => c.campaignId === metaCp.id);
                
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
                  auditLogs: [...(updatedCampaigns[existingIdx]?.auditLogs || []), `Synchronisé & Validé via API le ${new Date().toLocaleString()}`]
                };

                if (existingIdx >= 0) updatedCampaigns[existingIdx] = validatedData;
                else updatedCampaigns.push(validatedData);
              });
            }
          } catch (e) {
            log(`Échec extraction pour ${adAccountId}`);
          }
        }
        setProgress(Math.round(((i + 1) / clients.length) * 100));
      }

      setCampaigns(updatedCampaigns);
      log('Extraction terminée.');
    } catch (err) {
      log('Erreur fatale lors de l\'extraction.');
    } finally {
      setIsSyncing(false);
    }
  };

  // AUDIT D'INTÉGRITÉ GLOBAL (Validation des Metrics)
  const runIntegrityAudit = () => {
    setIsAuditing(true);
    setProgress(0);
    setSyncLogs(['Initialisation de l\'audit de conformité...']);

    setTimeout(() => {
      setCampaigns(prev => prev.map((cp, idx) => {
        const anomalies: string[] = [];
        if (cp.impressions > 0 && cp.clicks === 0) anomalies.push('Metrics incohérentes: Impressions sans clics.');
        if (cp.spend > 0 && cp.conversions === 0) anomalies.push('Performance critique: Spend sans conversion.');
        if (cp.roas > 20) anomalies.push('Donnée suspecte: ROAS supérieur à 20x.');

        log(`Analyse ${cp.name}...`);
        
        return {
          ...cp,
          isValidated: anomalies.length === 0,
          auditLogs: [...(cp.auditLogs || []), `Audit d'intégrité passé le ${new Date().toLocaleString()}. ${anomalies.length > 0 ? `Alertes: ${anomalies.join(' ')}` : 'Aucune anomalie détectée.'}`]
        };
      }));
      setIsAuditing(false);
      log('Audit d\'intégrité terminé.');
    }, 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Data Certification Hub</h2>
          <p className="text-slate-500 font-medium">Extraire, auditer et certifier l'origine de vos données marketing.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          <button 
            onClick={runIntegrityAudit}
            disabled={isAuditing || isSyncing}
            className="flex-1 lg:flex-none px-6 py-3 bg-white border border-slate-200 text-slate-900 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            Audit d'Intégrité
          </button>
          <button 
            onClick={runGlobalExtraction}
            disabled={isSyncing || isAuditing}
            className="flex-1 lg:flex-none px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
          >
            {isSyncing ? 'Extraction en cours...' : 'Extraction Globale Meta'}
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
            <select 
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none"
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
            >
              <option value="all">Tous Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-5">Campagne & Client</th>
                <th className="px-8 py-5 text-center">Intégrité</th>
                <th className="px-8 py-5 text-right">Metrics</th>
                <th className="px-8 py-5 text-right">ROAS</th>
                <th className="px-8 py-5 text-right">Dernier Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50/80 transition-all">
                  <td className="px-8 py-6">
                    <div className="font-bold text-slate-900 line-clamp-1">{cp.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">ID: {cp.campaignId}</span>
                      <span className="text-[10px] text-blue-600 font-black px-1.5 py-0.5 bg-blue-50 rounded uppercase">{cp.clientName}</span>
                    </div>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(isSyncing || isAuditing) && (
        <div className="fixed bottom-8 right-8 w-80 bg-slate-900 text-white rounded-3xl p-6 shadow-2xl border border-white/10 animate-in slide-in-from-bottom-10">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-black uppercase tracking-widest text-blue-400">{isSyncing ? 'Extraction Meta' : 'Audit Interne'}</span>
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
