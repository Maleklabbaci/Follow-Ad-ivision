
import React, { useMemo, useState, useEffect } from 'react';
import { Outlet, useLocation, useParams, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { User, Client, UserRole, IntegrationSecret, CampaignStats } from '../types';
import { useCurrency } from '../contexts/CurrencyContext';
import AdPulseChatbot from './AdPulseChatbot';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  clients: Client[];
  secrets?: IntegrationSecret[];
  campaigns?: CampaignStats[];
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, clients, secrets = [], campaigns = [] }) => {
  const { clientId: urlClientId } = useParams<{ clientId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { currency, setCurrency, rates } = useCurrency();

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

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

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={toggleMobileMenu}></div>
          <div className="fixed inset-y-4 left-4 w-[280px] bg-white rounded-[2rem] shadow-2xl animate-in slide-in-from-left duration-500 overflow-hidden flex flex-col border border-white/10">
            <div className="flex justify-end p-4 absolute top-2 right-2 z-10">
              <button onClick={toggleMobileMenu} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
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

        <header className="h-14 md:h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-6 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <button onClick={toggleMobileMenu} className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
               <h1 className="text-sm md:text-lg font-black text-slate-900 tracking-tighter uppercase truncate max-w-[120px] md:max-w-none">
                {user.role === 'ADMIN' ? 'Control' : user.name}
               </h1>
               <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${isOnline ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-[8px] font-black uppercase tracking-widest">{isOnline ? 'Live' : 'Cache'}</span>
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
