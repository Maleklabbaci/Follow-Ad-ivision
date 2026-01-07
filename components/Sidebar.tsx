
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
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
          isActive 
          ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-100' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-bold'
        }`}
      >
        <div className={`${isActive ? 'text-white' : 'text-slate-400'}`}>
          {icon}
        </div>
        <span className="text-sm tracking-tight">{label}</span>
      </Link>
    );
  };

  const content = (
    <>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="text-2xl font-black text-slate-900 tracking-tighter italic">ADPULSE</span>
        </div>

        <nav className="space-y-1.5">
          {isAdmin ? (
            <>
              <div className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 mt-8">Agency Engine</div>
              <NavLink to="/" label="Dashboard" icon={<DashboardIcon />} />
              <NavLink to="/admin/clients" label="Clients" icon={<ClientsIcon />} />
              <NavLink to="/admin/campaigns" label="Campaigns" icon={<CampaignsIcon />} />
              <div className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 mt-8">Technical Access</div>
              <NavLink to="/admin/sql-editor" label="Database" icon={<DatabaseIcon />} />
              <NavLink to="/admin/settings" label="Settings" icon={<SettingsIcon />} />
            </>
          ) : (
            <>
              <div className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 mt-8">Workspace</div>
              <NavLink to="/client/dashboard" label="Analytics" icon={<DashboardIcon />} />
            </>
          )}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-slate-100">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-4 w-full rounded-2xl text-red-600 hover:bg-red-50 transition-all font-black text-sm group"
        >
          <div className="group-hover:scale-110 transition-transform">
            <LogoutIcon />
          </div>
          <span>LOGOUT</span>
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return <div className="h-full flex flex-col">{content}</div>;
  }

  return (
    <aside className="w-72 bg-white border-r border-slate-200 flex flex-col h-full hidden lg:flex shrink-0">
      {content}
    </aside>
  );
};

const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
  </svg>
);
const ClientsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const CampaignsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const DatabaseIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);
const LogoutIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

export default Sidebar;
