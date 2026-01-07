
import React, { useMemo, useState } from 'react';
import { Outlet, useLocation, useParams, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { User, Client, UserRole } from '../types';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  clients: Client[];
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, clients }) => {
  const { clientId } = useParams<{ clientId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isImpersonating = useMemo(() => {
    return user.role === UserRole.ADMIN && location.pathname.includes('/client/dashboard/') && clientId;
  }, [user.role, location.pathname, clientId]);

  const impersonatedClient = useMemo(() => {
    if (!isImpersonating) return null;
    return clients.find(c => c.id === clientId);
  }, [isImpersonating, clients, clientId]);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      {/* Sidebar Desktop */}
      <Sidebar user={user} onLogout={onLogout} />

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={toggleMobileMenu}></div>
          <div className="fixed inset-y-0 left-0 w-[280px] bg-white shadow-2xl animate-in slide-in-from-left duration-300 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-slate-50">
               <span className="text-xl font-black italic tracking-tighter text-slate-900">ADPULSE</span>
               <button onClick={toggleMobileMenu} className="p-2 text-slate-400 hover:text-slate-600 active:scale-90 transition-all">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
               </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar user={user} onLogout={onLogout} isMobile mobileCallback={toggleMobileMenu} />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Impersonation Banner - Mobile Optimized */}
        {isImpersonating && (
          <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-2 shadow-lg z-[40] sticky top-0">
            <div className="flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-tight truncate">
              <svg className="w-3 h-3 md:w-4 md:h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className="hidden xs:inline">Audit :</span> {impersonatedClient?.name || 'Client'}
            </div>
            <button 
              onClick={() => navigate('/admin/clients')}
              className="bg-white text-amber-600 px-3 py-1.5 rounded-lg text-[9px] font-black transition-all active:scale-95 border-none uppercase shadow-sm"
            >
              Quitter
            </button>
          </div>
        )}

        <header className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 z-30">
          <div className="flex items-center gap-2">
            <button onClick={toggleMobileMenu} className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-xl active:scale-90 transition-all">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-xs md:text-base font-black text-slate-900 tracking-tighter uppercase truncate max-w-[120px] xs:max-w-[180px] md:max-w-none italic">
              {user.role === 'ADMIN' ? 'Control Center' : user.name}
            </h1>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] md:text-xs font-black text-slate-700 uppercase tracking-tighter">{user.name}</span>
              <span className="text-[8px] md:text-[10px] text-blue-600 font-bold uppercase tracking-widest leading-none">{user.role}</span>
            </div>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xs font-black border-2 border-white shadow-sm ring-1 ring-blue-100">
              {user.name.charAt(0)}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-slate-50/50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
