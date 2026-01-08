
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, UserRole } from '../types';

interface SidebarProps {
  user: User;
  onLogout: () => void;
  isMobile?: boolean;
  mobileCallback?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout, isMobile = false, mobileCallback }) => {
  const location = useLocation();
  const isAdmin = user.role === UserRole.ADMIN;

  const NavLink = ({ to, label, icon }: { to: string, label: string, icon: React.ReactNode }) => {
    const isActive = location.pathname === to;
    return (
      <Link
        to={to}
        onClick={mobileCallback}
        className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group ${
          isActive 
          ? 'bg-[#2563eb] text-white font-bold shadow-xl shadow-blue-600/20' 
          : 'text-[#64748b] hover:bg-slate-50 hover:text-slate-900 font-semibold'
        }`}
      >
        <div className={`${isActive ? 'text-white' : 'text-[#94a3b8] group-hover:text-slate-600'} transition-colors`}>
          {icon}
        </div>
        <span className="tracking-tight text-sm uppercase">{label}</span>
      </Link>
    );
  };

  const content = (
    <div className="flex flex-col h-full bg-white">
      <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
        {/* Logo Section */}
        <div className="flex items-center gap-4 mb-12">
          <div className="w-12 h-12 bg-[#0f172a] rounded-xl flex items-center justify-center shadow-lg shadow-slate-200">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 7h4v4" />
            </svg>
          </div>
          <span className="text-2xl font-black text-[#0f172a] tracking-tighter italic uppercase">ADPULSE</span>
        </div>

        <nav className="space-y-1">
          {isAdmin ? (
            <>
              <div className="px-5 text-[10px] font-bold text-[#94a3b8] uppercase tracking-[0.2em] mb-4 mt-8">Agency Engine</div>
              <NavLink to="/" label="Dashboard" icon={<DashboardIcon />} />
              <NavLink to="/admin/clients" label="Clients" icon={<ClientsIcon />} />
              <NavLink to="/admin/campaigns" label="Campaigns" icon={<CampaignsIcon />} />
              <div className="px-5 text-[10px] font-bold text-[#94a3b8] uppercase tracking-[0.2em] mb-4 mt-10">Technical Access</div>
              <NavLink to="/admin/sql-editor" label="Database" icon={<DatabaseIcon />} />
              <NavLink to="/admin/settings" label="Settings" icon={<SettingsIcon />} />
            </>
          ) : (
            <>
              <div className="px-5 text-[10px] font-bold text-[#94a3b8] uppercase tracking-[0.2em] mb-4 mt-8">Workspace</div>
              <NavLink to="/client/dashboard" label="Analytics" icon={<DashboardIcon />} />
            </>
          )}
        </nav>
      </div>

      {/* Footer Section */}
      <div className="p-8 space-y-4 bg-gradient-to-t from-slate-50/50 to-transparent">
        <a 
          href="https://wa.me/213542586904" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-4 px-6 py-5 bg-[#10b981] text-white rounded-2xl hover:bg-[#059669] transition-all font-bold text-[12px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95"
        >
          <div className="shrink-0">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </div>
          <span className="flex-1">SUPPORT EXPERT</span>
        </a>
        
        <button
          onClick={onLogout}
          className="flex items-center gap-4 px-6 py-5 w-full rounded-2xl text-white bg-[#0f172a] hover:bg-black transition-all font-bold text-xs group shadow-lg shadow-slate-200 active:scale-95"
        >
          <div className="group-hover:translate-x-1 transition-transform">
            <LogoutIcon />
          </div>
          <span className="flex-1 text-left uppercase tracking-widest">DÉCONNEXION</span>
        </button>
      </div>
    </div>
  );

  return (
    <aside className={`${isMobile ? 'w-full h-full' : 'w-80 hidden lg:flex'} bg-white border-r border-slate-100 flex flex-col h-full shrink-0 shadow-sm`}>
      {content}
    </aside>
  );
};

const DashboardIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
  </svg>
);
const ClientsIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const SettingsIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const CampaignsIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const DatabaseIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);
const LogoutIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

export default Sidebar;
