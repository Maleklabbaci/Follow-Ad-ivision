
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useLocation, useParams, useNavigate } from 'react-router-dom';
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

  const runGlobalSync = useCallback(async (force = false) => {
    const now = Date.now();
    if (!navigator.onLine || !setCampaigns) return;
    if (!force && isSyncing) return;
    
    // Fréquence : 30s si forcé, sinon 60s pour admin, 120s pour client
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
        // Pour l'admin sur le Dashboard Global, on veut tout synchroniser, donc on ne filtre pas si urlClientId est undefined
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
    // Déclenchement sur Dashboard Client OU Control Room Admin (/)
    if (location.pathname === '/' || location.pathname.includes('dashboard')) {
      runGlobalSync(true); 
    }
    setIsMobileMenuOpen(false);
  }, [location.pathname, runGlobalSync]);

  useEffect(() => {
    // Intervalle plus court pour l'admin (60s) vs Client (120s)
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
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center gap-3">
               <h1 className="text-sm md:text-lg font-black text-slate-900 tracking-tighter uppercase italic truncate">
                {user.role === 'ADMIN' ? 'Control' : user.name}
               </h1>
               <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all duration-500 ${isSyncing ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-blue-500 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></div>
                  <span className="text-[8px] font-black uppercase tracking-widest">
                    {isSyncing ? 'Syncing Meta...' : 'Live Stream'}
                  </span>
               </div>
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
