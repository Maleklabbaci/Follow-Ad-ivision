
import React, { useMemo, useState, useEffect } from 'react';
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
  const [syncProgress, setSyncProgress] = useState(0);

  const detailedCampaigns = useMemo(() => {
    return campaigns.map(campaign => {
      const associatedClient = clients.find(c => c.campaignIds.includes(campaign.campaignId));
      return {
        ...campaign,
        clientName: associatedClient ? associatedClient.name : 'Unassigned',
        clientId: associatedClient ? associatedClient.id : null
      };
    }).filter(cp => {
      const matchesSearch = cp.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClient = filterClient === 'all' || cp.clientId === filterClient;
      return matchesSearch && matchesClient;
    });
  }, [campaigns, clients, searchTerm, filterClient]);

  const syncAllData = async () => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      alert("Erreur: Token Facebook manquant ou invalide dans les paramètres.");
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    const token = await decryptSecret(fbSecret.value);
    const updatedCampaigns = [...campaigns];

    try {
      for (let i = 0; i < campaigns.length; i++) {
        const cp = campaigns[i];
        setSyncProgress(Math.round(((i + 1) / campaigns.length) * 100));

        try {
          const res = await fetch(`https://graph.facebook.com/v19.0/${cp.campaignId}/insights?fields=spend,impressions,clicks,conversions&access_token=${token}`);
          const data = await res.json();

          if (data.data && data.data.length > 0) {
            const insight = data.data[0];
            const spend = parseFloat(insight.spend || 0);
            const clicks = parseInt(insight.clicks || 0);
            const conv = parseInt(insight.conversions || 0);
            const impressions = parseInt(insight.impressions || 0);

            updatedCampaigns[i] = {
              ...cp,
              spend,
              clicks,
              conversions: conv,
              impressions,
              ctr: impressions > 0 ? clicks / impressions : 0,
              cpc: clicks > 0 ? spend / clicks : 0,
              roas: spend > 0 ? (conv * 50) / spend : 0, // 50€ valeur moyenne par conv
              dataSource: 'REAL_API',
              lastSync: new Date().toISOString()
            };
          }
        } catch (e) {
          console.error(`Sync error for ${cp.campaignId}`, e);
        }
      }
      setCampaigns(updatedCampaigns);
      alert("Extraction et validation des données Meta terminées.");
    } catch (err) {
      alert("Échec de la synchronisation globale.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Validation des Données Réelles</h2>
          <p className="text-slate-500">Extraction directe depuis l'API Meta Graph.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={syncAllData} 
            disabled={isSyncing}
            className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            {isSyncing ? `Synchronisation (${syncProgress}%)...` : 'Lancer l\'extraction Meta'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Campagne</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Statut Sync</th>
                <th className="px-6 py-4 text-right">Dépenses Réelles</th>
                <th className="px-6 py-4 text-right">Conv.</th>
                <th className="px-6 py-4 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detailedCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{cp.name}</div>
                    <div className="text-xs text-slate-400">{cp.clientName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cp.dataSource === 'REAL_API' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {cp.dataSource}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-500">
                      {cp.lastSync ? new Date(cp.lastSync).toLocaleString() : 'Jamais'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900">${cp.spend.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-slate-600">{cp.conversions}</td>
                  <td className="px-6 py-4 text-right font-bold text-indigo-600">{cp.roas.toFixed(2)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminCampaigns;
