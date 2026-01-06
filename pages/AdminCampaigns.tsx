
import React, { useMemo, useState } from 'react';
import { Client, CampaignStats } from '../types';

interface AdminCampaignsProps {
  clients: Client[];
  campaigns: CampaignStats[];
}

const AdminCampaigns: React.FC<AdminCampaignsProps> = ({ clients, campaigns }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState('all');

  // Join campaigns with clients for a unified view
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Campaign Management</h2>
          <p className="text-slate-500">Monitor all linked Facebook campaigns across your client portfolio.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search campaigns..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Campaign Details</th>
                <th className="px-6 py-4">Linked Client</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Spend</th>
                <th className="px-6 py-4 text-right">Conv.</th>
                <th className="px-6 py-4 text-right">ROAS</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detailedCampaigns.length > 0 ? (
                detailedCampaigns.map(cp => (
                  <tr key={cp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">{cp.name}</span>
                        <span className="text-xs text-slate-400 font-mono">ID: {cp.campaignId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {cp.clientName.charAt(0)}
                        </div>
                        <span className="text-sm text-slate-700">{cp.clientName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        cp.status === 'ACTIVE' 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {cp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">
                      ${cp.spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">
                      {cp.conversions}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${cp.roas >= 3 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {cp.roas.toFixed(2)}x
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="p-1 hover:bg-slate-200 rounded text-slate-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 italic">
                    No matching campaigns found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        <div className="bg-slate-900 rounded-xl p-6 text-white shadow-lg shadow-slate-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/10 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold">Automatic Sync</h3>
          </div>
          <p className="text-slate-300 text-sm mb-4">
            Data is synchronized every 6 hours with Meta Marketing API. Next sync scheduled for tonight at 02:00 AM.
          </p>
          <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-all border border-white/20">
            Manual Force Sync
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminCampaigns;
