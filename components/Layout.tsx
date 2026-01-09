
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useLocation, useParams, useNavigate, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import { User, Client, UserRole, IntegrationSecret, CampaignStats } from '../types';
import { useCurrency } from '../contexts/CurrencyContext';
import AdiVisionChatbot from './AdiVisionChatbot';
import { decryptSecret } from '../services/cryptoService';
import { DB } from '../services/db';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  clients: Client[];
  setClients?: React.Dispatch<React.SetStateAction<Client[]>>;
  secrets?: IntegrationSecret[];
  campaigns?: CampaignStats[];
  setCampaigns?: React.Dispatch<React.SetStateAction<CampaignStats[]>>;
}

const Layout: React.FC<LayoutProps> = ({ 
  user, 
  onLogout, 
  clients, 
  setClients,
  secrets = [], 
  campaigns = [],
  setCampaigns 
}) => {
  const { clientId: urlClientId } = useParams<{ clientId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const { currency, setCurrency, rates } = useCurrency();
  
  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  const lastSyncTimeRef = useRef<number>(0);
  const campaignsRef = useRef(campaigns);
  
  useEffect(() => {
    campaignsRef.current = campaigns;
  }, [campaigns]);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const runGlobalSync = useCallback(async (force = false) => {
    const now = Date.now();
    if (!navigator.onLine || !setCampaigns) return;
    if (!force && isSyncing) return;
    
    const minInterval = force ? 30000 : (user.role === UserRole.ADMIN ? 60000 : 120000);
    if (!force && (now - lastSyncTimeRef.current < minInterval)) return;
    
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') return;

    setIsSyncing(true);
    try {
      const token = await decryptSecret(fbSecret.value);
      if (!token) throw new Error("Token Meta invalide");

      let newCampaignsMap = new Map<string, CampaignStats>();
      campaignsRef.current.forEach(c => newCampaignsMap.set(c.campaignId, c));

      const activeId = user.role === UserRole.ADMIN ? urlClientId : user.clientId;
      const sortedClients = [...clients].sort((a, b) => (a.id === activeId ? -1 : 1));

      for (const client of sortedClients) {
        if (!client.campaignIds || client.campaignIds.length === 0) continue;
        if (force && user.role === UserRole.ADMIN && urlClientId && client.id !== urlClientId) continue;
        if (force && user.role === UserRole.CLIENT && client.id !== user.clientId) continue;

        for (const adAccountId of (client.adAccounts || [])) {
          try {
            const url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=name,status,id,account_id,insights.date_preset(maximum){spend,impressions,reach,frequency,clicks,actions}&access_token=${token}`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();

            if (data.data) {
              data.data.forEach((metaCp: any) => {
                if (client.campaignIds.includes(metaCp.id)) {
                  if (metaCp.status === 'DELETED') return;
                  
                  const insight = metaCp.insights?.data?.[0] || {};
                  const spend = parseFloat(insight.spend) || 0;
                  const impressions = parseInt(insight.impressions) || 0;
                  const clicks = parseInt(insight.clicks) || 0;
                  
                  let conversionsCount = 0;
                  if (insight.actions) {
                    const targetActions = insight.actions.filter((a: any) => 
                      a.action_type.includes('messaging_conversation_started') || 
                      a.action_type === 'conversions' ||
                      a.action_type.includes('purchase')
                    );
                    conversionsCount = targetActions.reduce((sum: number, a: any) => sum + parseInt(a.value), 0);
                  }

                  const existing = newCampaignsMap.get(metaCp.id);
                  const cpa = conversionsCount > 0 ? (spend / conversionsCount) : 0;

                  const stats: CampaignStats = {
                    ...existing,
                    id: existing?.id || `meta_${Math.random().toString(36).substr(2, 5)}`,
                    campaignId: metaCp.id,
                    name: metaCp.name,
                    date: new Date().toISOString().split('T')[0],
                    spend,
                    impressions,
                    reach: parseInt(insight.reach) || 0,
                    frequency: parseFloat(insight.frequency) || 1,
                    clicks,
                    conversions: conversionsCount, 
                    results: conversionsCount,
                    resultat: conversionsCount,
                    cost: spend,
                    cost_per_result: cpa,
                    ctr: impressions > 0 ? (clicks / impressions) : 0,
                    cpc: clicks > 0 ? (spend / clicks) : 0,
                    status: metaCp.status as any,
                    dataSource: 'REAL_API',
                    lastSync: new Date().toISOString(),
                    isValidated: true
                  } as CampaignStats;
                  newCampaignsMap.set(metaCp.id, stats);
                }
              });
            }
          } catch (e) { }
        }
      }

      const finalCampaigns = Array.from(newCampaignsMap.values());
      if (finalCampaigns.length > 0) {
        setCampaigns(finalCampaigns);
        await DB.saveCampaigns(finalCampaigns);
        lastSyncTimeRef.current = Date.now();
      }
    } catch (err: any) {
      console.error("Sync Engine Error:", err?.message);
    } finally {
      setIsSyncing(false);
    }
  }, [clients, secrets, setCampaigns, urlClientId, user.clientId, user.role, isSyncing]);

  useEffect(() => {
    if (location.pathname === '/' || location.pathname.includes('dashboard')) {
      runGlobalSync(true); 
    }
    setIsMobileMenuOpen(false);
  }, [location.pathname, runGlobalSync]);

  useEffect(() => {
    const intervalTime = user.role === UserRole.ADMIN ? 60000 : 120000;
    const interval = setInterval(() => runGlobalSync(), intervalTime);
    return () => clearInterval(interval);
  }, [runGlobalSync, user.role]);

  const activeClient = useMemo(() => {
    const id = user.role === UserRole.ADMIN ? urlClientId : user.clientId;
    return clients.find(c => c.id === id);
  }, [user, urlClientId, clients]);

  const contextualCampaigns = useMemo(() => {
    if (!activeClient) return campaigns;
    const ids = activeClient.campaignIds || [];
    return campaigns.filter(c => ids.includes(c.campaignId));
  }, [activeClient, campaigns]);

  // Search Results Filtering Logic
  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return { clients: [], campaigns: [] };
    const query = searchQuery.toLowerCase();
    
    let filteredClients: Client[] = [];
    let filteredCampaigns: { cp: CampaignStats; client: Client | undefined }[] = [];

    if (user.role === UserRole.ADMIN) {
      filteredClients = clients.filter(c => c.name.toLowerCase().includes(query));
      filteredCampaigns = campaigns
        .filter(cp => cp.name.toLowerCase().includes(query))
        .map(cp => ({
          cp,
          client: clients.find(c => c.campaignIds.includes(cp.campaignId))
        }));
    } else {
      // Clients only see their own campaigns
      filteredCampaigns = contextualCampaigns
        .filter(cp => cp.name.toLowerCase().includes(query))
        .map(cp => ({ cp, client: activeClient }));
    }

    return {
      clients: filteredClients.slice(0, 5),
      campaigns: filteredCampaigns.slice(0, 8)
    };
  }, [searchQuery, clients, campaigns, contextualCampaigns, user.role, activeClient]);

  const handleResultClick = (type: 'client' | 'campaign', id: string) => {
    setSearchQuery('');
    setIsSearchOpen(false);
    if (type === 'client') {
      navigate(`/client/dashboard/${id}`);
    } else {
      // Find which client owns this campaign to navigate correctly
      const owner = clients.find(c => c.campaignIds.includes(id)) || activeClient;
      if (owner) {
        navigate(`/client/dashboard/${owner.id}`);
      }
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar user={user} onLogout={onLogout} />

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl animate-in slide-in-from-left duration-300 flex flex-col">
            <div className="absolute top-4 right-4">
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <Sidebar 
              user={user} 
              onLogout={() => { onLogout(); setIsMobileMenuOpen(false); }} 
              isMobile={true} 
              mobileCallback={() => setIsMobileMenuOpen(false)} 
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0 z-20">
          <div className="flex items-center gap-2 flex-1">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center gap-3 hidden sm:flex">
               <h1 className="text-sm md:text-lg font-black text-slate-900 tracking-tighter uppercase italic truncate">
                {user.role === 'ADMIN' ? 'Control' : user.name}
               </h1>
               <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all duration-500 ${isSyncing ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-blue-500 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></div>
                  <span className="text-[8px] font-black uppercase tracking-widest">
                    {isSyncing ? 'Syncing...' : 'Live Stream'}
                  </span>
               </div>
            </div>

            {/* Global Search Bar */}
            <div className="relative mx-4 md:mx-8 flex-1 max-w-xl" ref={searchRef}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  placeholder={user.role === 'ADMIN' ? "Search clients, campaigns..." : "Search your campaigns..."}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                />
              </div>

              {/* Search Results Dropdown */}
              {isSearchOpen && searchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-200/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {filteredResults.clients.length > 0 && (
                      <div className="p-2">
                        <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">Clients</div>
                        {filteredResults.clients.map(client => (
                          <button 
                            key={client.id} 
                            onClick={() => handleResultClick('client', client.id)}
                            className="w-full text-left px-3 py-3 rounded-xl hover:bg-slate-50 flex items-center gap-3 transition-colors group"
                          >
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-black text-xs group-hover:bg-blue-600 group-hover:text-white transition-all">
                              {client.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-slate-900 uppercase truncate italic tracking-tight">{client.name}</p>
                              <p className="text-[9px] text-slate-400 font-bold truncate">{client.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {filteredResults.campaigns.length > 0 && (
                      <div className={`p-2 ${filteredResults.clients.length > 0 ? 'border-t border-slate-50' : ''}`}>
                        <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">Campaigns</div>
                        {filteredResults.campaigns.map(({ cp, client }) => (
                          <button 
                            key={cp.campaignId} 
                            onClick={() => handleResultClick('campaign', cp.campaignId)}
                            className="w-full text-left px-3 py-3 rounded-xl hover:bg-slate-50 flex items-center gap-3 transition-colors group"
                          >
                            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 font-black text-xs group-hover:bg-emerald-600 group-hover:text-white transition-all">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-slate-900 uppercase truncate italic tracking-tight">{cp.name}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">{client?.name}</span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${cp.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                  {cp.status}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {filteredResults.clients.length === 0 && filteredResults.campaigns.length === 0 && (
                      <div className="p-12 text-center">
                        <p className="text-xs font-black text-slate-300 uppercase italic tracking-widest">No matching nodes found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4 md:gap-6">
            <div className="hidden sm:flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="bg-transparent text-[10px] font-black uppercase outline-none border-none cursor-pointer">
                {Object.keys(rates).map(cur => <option key={cur} value={cur}>{cur}</option>)}
              </select>
            </div>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-black border-2 border-white shadow-sm ring-1 ring-blue-100">
              {user.name.charAt(0)}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-[1600px] mx-auto"><Outlet /></div>
        </main>
      </div>

      <AdiVisionChatbot secrets={secrets} campaigns={contextualCampaigns} activeClientName={activeClient?.name} />
    </div>
  );
};

export default Layout;
