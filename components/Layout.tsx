
import React, { useMemo } from 'react';
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

  // Check if we are in impersonation mode (Admin viewing a client dashboard)
  const isImpersonating = useMemo(() => {
    return user.role === UserRole.ADMIN && location.pathname.includes('/client/dashboard/') && clientId;
  }, [user.role, location.pathname, clientId]);

  const impersonatedClient = useMemo(() => {
    if (!isImpersonating) return null;
    return clients.find(c => c.id === clientId);
  }, [isImpersonating, clients, clientId]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar user={user} onLogout={onLogout} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Impersonation Banner */}
        {isImpersonating && (
          <div className="bg-amber-500 text-white px-6 py-2 flex items-center justify-between shadow-md z-10">
            <div className="flex items-center gap-2 text-sm font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Simulation Mode: Viewing data for {impersonatedClient?.name || 'Unknown Client'}
            </div>
            <button 
              onClick={() => navigate('/admin/clients')}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-bold transition-colors border border-white/40"
            >
              Back to Clients Management
            </button>
          </div>
        )}

        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <h1 className="text-xl font-semibold text-slate-800">
            {user.role === 'ADMIN' ? 'Agency Control Center' : `Workspace: ${user.name}`}
          </h1>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-slate-700">{user.name}</span>
              <span className="text-xs text-slate-500 uppercase tracking-wider">{user.role}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200">
              {user.name.charAt(0)}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
