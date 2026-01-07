
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, UserRole, Client, CampaignStats, IntegrationSecret, AuditLog, AiReport } from './types';
import { DB } from './services/db';
import Layout from './components/Layout';
import AdminDashboard from './pages/AdminDashboard';
import ClientDashboard from './pages/ClientDashboard';
import AdminClients from './pages/AdminClients';
import AdminSettings from './pages/AdminSettings';
import AdminCampaigns from './pages/AdminCampaigns';
import AdminSqlEditor from './pages/AdminSqlEditor';
import Login from './pages/Login';

const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('auth_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [secrets, setSecrets] = useState<IntegrationSecret[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [aiReports, setAiReports] = useState<AiReport[]>([]);

  useEffect(() => {
    const initApp = async () => {
      try {
        const data = await DB.fetchAll();
        if (data) {
          setClients(data.clients || []);
          setCampaigns(data.campaigns || []);
          setSecrets(data.secrets || []);
          setUsers(data.users || []);
          setAuditLogs(data.auditLogs || []);
          setAiReports(data.aiReports || []);
        }
      } catch (err) {
        console.warn("Soft initialization error, using local defaults if available.");
      } finally {
        // We delay slightly for UX feel
        setTimeout(() => setIsInitializing(false), 500);
      }
    };
    initApp();
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('auth_session', JSON.stringify(u));
    DB.addAuditLog({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      userId: u.id,
      userName: u.name,
      action: 'USER_LOGIN',
      resource: 'AUTH',
      ipAddress: 'local'
    });
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('auth_session');
  };

  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white flex-col gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-center">
          <p className="font-black text-xl tracking-tighter uppercase italic">AdPulse Engine</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-2 animate-pulse">Syncing Data...</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} users={users} />} />
        <Route element={user ? <Layout user={user} onLogout={handleLogout} clients={clients} /> : <Navigate to="/login" replace />}>
          <Route path="/" element={user?.role === UserRole.ADMIN ? <AdminDashboard clients={clients} campaigns={campaigns} /> : <Navigate to="/client/dashboard" replace />} />
          <Route path="/admin/clients" element={<AdminClients clients={clients} setClients={setClients} users={users} setUsers={setUsers} secrets={secrets} />} />
          <Route path="/admin/campaigns" element={<AdminCampaigns clients={clients} setClients={setClients} campaigns={campaigns} setCampaigns={setCampaigns} secrets={secrets} />} />
          <Route path="/admin/sql-editor" element={<AdminSqlEditor clients={clients} campaigns={campaigns} secrets={secrets} users={users} auditLogs={auditLogs} aiReports={aiReports} />} />
          <Route path="/admin/settings" element={<AdminSettings secrets={secrets} setSecrets={setSecrets} />} />
          <Route path="/client/dashboard/:clientId?" element={<ClientDashboard user={user} campaigns={campaigns} clients={clients} secrets={secrets} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
