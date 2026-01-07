
import React, { useMemo, useState } from 'react';
import { Outlet, useLocation, useParams, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { User, Client, UserRole, IntegrationSecret } from '../types';
import { useCurrency } from '../contexts/CurrencyContext';
import ADiVISIONChatbot from './AdPulseChatbot';
import ShakeReporter from './ShakeReporter';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  clients: Client[];
  secrets?: IntegrationSecret[];
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, clients, secrets = [] }) => {
  const { clientId } = useParams<{ clientId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currency, setCurrency, rates } = useCurrency();

  const isImpersonating = useMemo(() => {
    return user.role === UserRole.ADMIN && location.pathname.includes('/client/dashboard/') && clientId;
  }, [user.role, location.pathname, clientId]);

  const impersonatedClient = useMemo(() => {
    if (!isImpersonating) return null;
    return clients.find(c => c.id === clientId);
  }, [isImpersonating, clients, clientId]);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  // Sort currencies to put USD and DZD first as requested
  const sortedCurrencyCodes = useMemo(() => {
    const codes = Object.keys(rates);
    return codes.sort((a, b) => {
      if (a === 'USD') return -1;
      if (b === 'USD') return 1;
      if (a === 'DZD') return -1;
      if (b === 'DZD') return 1;
      return a.localeCompare(b);
    });
  }, [rates]);

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
              <span className="truncate">Audit: {impersonatedClient?.name || 'Client'}</span>
            </div>
            <button 
              onClick={() => navigate('/admin/clients')}
              className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-[8px] md:text-[10px] font-black transition-colors border border-white/40 uppercase whitespace-nowrap"
            >
              Quitter
            </button>
          </div>
        )}

        <header className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <button onClick={toggleMobileMenu} className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-sm md:text-lg font-black text-slate-900 tracking-tighter uppercase truncate max-w-[120px] md:max-w-none">
              {user.role === 'ADMIN' ? 'Control' : user.name}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 md:gap-6">
            <div className="flex items-center bg-slate-950 text-white rounded-xl px-3 py-1.5 gap-2 border border-white/10 shadow-lg group hover:bg-black transition-all">
              <div className="flex items-center gap-1.5 border-r border-white/20 pr-2">
                <svg className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Node</span>
              </div>
              <select 
                value={currency} 
                onChange={(e) => setCurrency(e.target.value)}
                className="bg-transparent text-[11px] font-black uppercase tracking-widest outline-none border-none cursor-pointer appearance-none hover:text-blue-400 transition-colors"
              >
                {sortedCurrencyCodes.map(cur => (
                  <option key={cur} value={cur} className="bg-slate-900 text-white font-black">{cur}</option>
                ))}
              </select>
              <svg className="w-3 h-3 text-white/40 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-black text-slate-700 uppercase tracking-tighter">{user.name}</span>
                <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">{user.role}</span>
              </div>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-black border-2 border-white shadow-sm ring-1 ring-blue-100">
                {user.name.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <ADiVISIONChatbot secrets={secrets} />
      <ShakeReporter />
    </div>
  );
};

export default Layout;
