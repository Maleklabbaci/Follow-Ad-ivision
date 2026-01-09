
import React, { useMemo, useState, useEffect } from 'react';
import { Client, CampaignStats, IntegrationSecret } from '../types';
import { useCurrency } from '../contexts/CurrencyContext';

interface AdminCampaignsProps {
  clients: Client[];
  campaigns: CampaignStats[];
  secrets: IntegrationSecret[];
}

const AdminCampaigns: React.FC<AdminCampaignsProps> = ({ 
  clients = [], 
  campaigns = [], 
  secrets = [] 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState('all'); 
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { format } = useCurrency();
  
  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  const filteredCampaigns = useMemo(() => {
    return (campaigns || []).filter(cp => {
      const matchesSearch = (cp.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClient = filterClient === 'all' || (clients.find(c => c.id === filterClient)?.campaignIds.includes(cp.campaignId));
      return matchesSearch && matchesClient;
    }).sort((a, b) => (b.lastSync || '').localeCompare(a.lastSync || ''));
  }, [campaigns, clients, searchTerm, filterClient]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="relative">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Engine Control</h2>
          <div className="flex items-center gap-3 mt-1">
             <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                {isOnline ? 'Meta API v19.0 (Background Sync Active)' : 'Mode Hors-ligne (Local Mirror)'}
             </p>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dernier Refresh Global: {campaigns[0]?.lastSync ? new Date(campaigns[0].lastSync).toLocaleTimeString() : '---'}</span>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 md:p-10 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-6">
          <h3 className="text-2xl font-black text-slate-800 tracking-tighter italic uppercase">Registre des Flux</h3>
          <div className="flex gap-4 w-full lg:w-auto">
             <input 
                type="text"
                placeholder="RECHERCHE..."
                className="flex-1 sm:w-64 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[1000px]">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-10 py-6">Campagne</th>
                <th className="px-10 py-6 text-right">Dépense</th>
                <th className="px-10 py-6 text-right">Résultats</th>
                <th className="px-10 py-6 text-right">Dernier Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCampaigns.length > 0 ? filteredCampaigns.map(cp => (
                <tr key={cp.id} className="hover:bg-slate-50 transition-all">
                  <td className="px-10 py-6 font-black text-slate-900 uppercase italic">{cp.name}</td>
                  <td className="px-10 py-6 text-right font-black text-slate-900 tabular-nums">{format(cp.spend)}</td>
                  <td className="px-10 py-6 text-right font-black text-emerald-600 tabular-nums text-lg">{cp.results || 0}</td>
                  <td className="px-10 py-6 text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                       {cp.lastSync ? new Date(cp.lastSync).toLocaleTimeString() : 'Never'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-10 py-20 text-center font-black text-slate-300 uppercase italic tracking-widest">
                    Aucun flux de données détecté.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminCampaigns;
