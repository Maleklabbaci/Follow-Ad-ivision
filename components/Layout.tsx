
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useLocation, useParams, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { User, Client, UserRole, IntegrationSecret, CampaignStats } from '../types';
import { useCurrency } from '../contexts/CurrencyContext';
import AdPulseChatbot from './AdPulseChatbot';
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
  
  // Ref pour éviter les dépendances circulaires dans runGlobalSync
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

  // LOGIQUE DE SYNCHRONISATION GLOBALE SILENCIEUSE
  const runGlobalSync = useCallback(async () => {
    if (!navigator.onLine || !setCampaigns || clients.length === 0) return;
    
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') return;

    setIsSyncing(true);
    try {
      const token = await decryptSecret(fbSecret.value);
      if (!token) throw new Error("Token Meta invalide ou vide");

      let newCampaignsMap = new Map<string, CampaignStats>();
      
      // On garde une trace des campagnes existantes pour ne pas perdre les données locales
      campaignsRef.current.forEach(c => newCampaignsMap.set(c.campaignId, c));

      // On boucle sur tous les clients pour rafraîchir les données
      for (const client of clients) {
        if (!client.campaignIds || client.campaignIds.length === 0) continue;
        
        for (const adAccountId of (client.adAccounts || [])) {
          try {
            const url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=name,status,id,account_id,insights.date_preset(maximum){spend,impressions,reach,frequency,clicks,actions}&access_token=${token}`;
            const res = await fetch(url);
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              console.warn(`Meta API Error for account ${adAccountId}:`, errData.error?.message || res.statusText);
              continue;
            }
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
                      a.action_type.includes('messaging_conversation_started') || a.action_type === 'conversions'
                    );
                    conversionsCount = targetActions.reduce((sum: number, a: any) => sum + parseInt(a.value), 0);
                  }

                  const existing = newCampaignsMap.get(metaCp.id);
                  
                  // Calcul des métriques de base
                  const ctr = impressions > 0 ? (clicks / impressions) : 0;
                  const cpc = clicks > 0 ? (spend / clicks) : 0;
                  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
                  const cpa = conversionsCount > 0 ? (spend / conversionsCount) : 0;

                  const stats: CampaignStats = {
                    ...existing,
                    id: existing?.id || `meta_${Math.random().toString(36).substr(2, 5)}`,
                    campaignId: metaCp.id,
                    name: metaCp.name,
                    date: existing?.date || new Date().toISOString().split('T')[0],
                    spend,
                    impressions,
                    reach: parseInt(insight.reach) || 0,
                    frequency: parseFloat(insight.frequency) || 1,
                    clicks,
                    conversions: conversionsCount, 
                    resultat: conversionsCount,
                    results: conversionsCount,
                    cost: spend,
                    cost_per_result: cpa,
                    ctr,
                    cpc,
                    cpm,
                    cpa,
                    roas: 0, // Optionnel si non fourni
                    status: metaCp.status as any,
                    dataSource: 'REAL_API',
                    lastSync: new Date().toISOString(),
                    isValidated: true,
                    currency: existing?.currency || 'USD'
                  } as CampaignStats;
                  newCampaignsMap.set(metaCp.id, stats);
                }
              });
            }
          } catch (e: any) {
            console.warn(`Failed to sync account ${adAccountId}:`, e?.message || e);
          }
        }
      }

      const finalCampaigns = Array.from(newCampaignsMap.values());
      if (finalCampaigns.length > 0) {
        setCampaigns(finalCampaigns);
        await DB.saveCampaigns(finalCampaigns);
      }
    } catch (err: any) {
      // Correction de l'affichage de l'erreur [object Object]
      console.error("Global sync failed:", err?.message || err);
    } finally {
      setIsSyncing(false);
    }
  }, [clients, secrets, setCampaigns]);

  // Déclencher la sync au montage et à chaque changement de route majeur
  useEffect(() => {
    runGlobalSync();
    const interval = setInterval(runGlobalSync, 120000); // Sync toutes les 2 min
    return () => clearInterval(interval);
  }, [location.pathname, runGlobalSync]);

  const activeClientId = useMemo(() => {
    if (user.role === UserRole.ADMIN) return urlClientId;
    return user.clientId;
  }, [user, urlClientId]);

  const activeClient = useMemo(() => {
    if (!activeClientId) return null;
    return clients.find(c => c.id === activeClientId);
  }, [activeClientId, clients]);

  const isImpersonating = useMemo(() => {
    return user.role === UserRole.ADMIN && location.pathname.includes('/client/dashboard/') && urlClientId;
  }, [user.role, location.pathname, urlClientId]);

  const contextualCampaigns = useMemo(() => {
    if (!activeClient) return campaigns;
    const ids = activeClient.campaignIds || [];
    return campaigns.filter(c => ids.includes(c.campaignId));
  }, [activeClient, campaigns]);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar user={user} onLogout={onLogout} />

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={toggleMobileMenu}></div>
          <div className="fixed inset-y-0 left-0 w-[280px] bg-white shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="flex justify-end p-4">
              <button onClick={toggleMobileMenu} className="p-2 text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <Sidebar user={user} onLogout={onLogout} isMobile mobileCallback={toggleMobileMenu} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {isImpersonating && (
          <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-2 shadow-md z-10">
            <div className="flex items-center gap-2 text-[9px] md:text-sm font-bold uppercase tracking-tight truncate">
              <svg className="w-3 h-3 md:w-4 md:h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className="truncate">Audit: {activeClient?.name || 'Client'}</span>
            </div>
            <button onClick={() => navigate('/admin/clients')} className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-[8px] md:text-[10px] font-black uppercase">Quitter</button>
          </div>
        )}

        <header className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <button onClick={toggleMobileMenu} className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
               <h1 className="text-sm md:text-lg font-black text-slate-900 tracking-tighter uppercase truncate max-w-[120px] md:max-w-none">
                {user.role === 'ADMIN' ? 'Control' : user.name}
               </h1>
               <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${isOnline ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? (isSyncing ? 'bg-blue-500 animate-spin' : 'bg-emerald-500 animate-pulse') : 'bg-red-500'}`}></div>
                  <span className="text-[8px] font-black uppercase tracking-widest">
                    {isOnline ? (isSyncing ? 'Syncing' : 'Live') : 'Cache'}
                  </span>
               </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-6">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 gap-1">
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

      <AdPulseChatbot secrets={secrets} campaigns={contextualCampaigns} activeClientName={activeClient?.name} />
    </div>
  );
};

export default Layout;
