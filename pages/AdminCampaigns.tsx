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

  const syncAllCampaigns = async () => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      alert("Please configure and VALIDATE a Facebook API Token in Settings first.");
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    const token = await decryptSecret(fbSecret.value);
    const updatedCampaigns = [...campaigns];
    const campaignIdsToSync = campaigns.map(c => c.campaignId);

    try {
      for (let i = 0; i < campaignIdsToSync.length; i++) {
        const cpId = campaignIdsToSync[i];
        setSyncProgress(Math.round(((i + 1) / campaignIdsToSync.length) * 100));

        try {
          const response = await fetch(
            `https://graph.facebook.com/v19.0/${cpId}/insights?fields=spend,impressions,clicks,conversions&access_token=${token}`
          );
          const data = await response.json();

          if (data.data && data.data.length > 0) {
            const insight = data.data[0];
            const spend = parseFloat(insight.spend || 0);
            const clicks = parseInt(insight.clicks || 0);
            const conversions = parseInt(insight.conversions || 0);
            const impressions = parseInt(insight.impressions || 0);

            const idx = updatedCampaigns.findIndex(c => c.campaignId === cpId);
            if (idx !== -1) {
              updatedCampaigns[idx] = {
                ...updatedCampaigns[idx],
                spend,
                clicks,
                conversions,
                impressions,
                ctr: impressions > 0 ? clicks / impressions : 0,
                cpc: clicks > 0 ? spend / clicks : 0,
                roas: spend > 0 ? (conversions * 50) / spend : 0,
                dataSource: 'META_API',
                lastSync: new Date().toISOString()
              };
            }
          }
        } catch (e) {
          console.error(`Error syncing campaign ${cpId}:`, e);
        }
        await new Promise(r => setTimeout(r, 200));
      }

      setCampaigns(updatedCampaigns);
      alert("Data sync completed successfully!");
    } catch (err) {
      alert("Global sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Campaign Management</h2>
          <p className="text-slate-500">Monitor and validate linked Facebook campaigns with real-time API data.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search campaigns..."
            className="w-full md:w-64 pl-4 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
          >
            <option value="all">All Clients</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {isSyncing && (
        <div className="bg-blue-600 rounded-xl p-4 text-white shadow-lg animate-pulse">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold">Extracting Meta API Data...</span>
            <span className="text-xs">{syncProgress}%</span>
          </div>
          <div className="w-full bg-blue-400 h-2 rounded-full overflow-hidden">
            <div className="bg-white h-full transition-all duration-300" style={{ width: `${syncProgress}%` }}></div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Campaign Name</th>
                <th className="px-6 py-4">Source & Sync</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Spend</th>
                <th className="px-6 py-4 text-right">Conv.</th>
                <th className="px-6 py-4 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detailedCampaigns.length > 0 ? (
                detailedCampaigns.map(cp => (
                  <tr key={cp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{cp.name}</div>
                      <div className="text-xs text-slate-500">{cp.clientName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-400">{cp.dataSource}</span>
                        {cp.lastSync && (
                          <span className="text-[10px] text-slate-400 italic">{new Date(cp.lastSync).toLocaleTimeString()}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${cp.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                        {cp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">${cp.spend.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right text-slate-600">{cp.conversions}</td>
                    <td className="px-6 py-4 text-right text-indigo-600 font-bold">{cp.roas.toFixed(2)}x</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">No campaigns match your criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="flex justify-center mt-6">
        <button 
          onClick={syncAllCampaigns} 
          disabled={isSyncing}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isSyncing ? 'Syncing...' : 'Global Meta API Sync'}
        </button>
      </div>
    </div>
  );
};

export default AdminCampaigns;
