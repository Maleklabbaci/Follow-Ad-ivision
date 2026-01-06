
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, UserRole, Client, CampaignStats, IntegrationSecret } from './types';
import Layout from './components/Layout';
import AdminDashboard from './pages/AdminDashboard';
import ClientDashboard from './pages/ClientDashboard';
import AdminClients from './pages/AdminClients';
import AdminSettings from './pages/AdminSettings';
import AdminCampaigns from './pages/AdminCampaigns';
import AdminSqlEditor from './pages/AdminSqlEditor';
import Login from './pages/Login';

// Mock DB Initial State
const MOCK_CLIENTS: Client[] = [
  { id: 'c1', name: 'Elite Fitness', email: 'owner@elitefitness.com', createdAt: '2023-10-01', adAccounts: ['act_12345678'], campaignIds: ['cp_1'] },
  { id: 'c2', name: 'Bloom Boutique', email: 'contact@bloomboutique.fr', createdAt: '2023-11-15', adAccounts: ['act_87654321'], campaignIds: ['cp_2', 'cp_3'] }
];

const MOCK_CAMPAIGNS: CampaignStats[] = [
  { id: '1', campaignId: 'cp_1', name: 'Spring Sale - Fitness', date: '2024-03-20', spend: 450.50, impressions: 12500, clicks: 850, conversions: 45, ctr: 0.068, cpc: 0.53, roas: 3.2, status: 'ACTIVE' },
  { id: '2', campaignId: 'cp_2', name: 'Remarketing - Bloom', date: '2024-03-20', spend: 120.00, impressions: 5000, clicks: 300, conversions: 12, ctr: 0.06, cpc: 0.40, roas: 5.1, status: 'ACTIVE' },
  { id: '3', campaignId: 'cp_3', name: 'Cold Interest - Bloom', date: '2024-03-20', spend: 850.00, impressions: 45000, clicks: 1200, conversions: 25, ctr: 0.026, cpc: 0.70, roas: 1.8, status: 'PAUSED' }
];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const saved = localStorage.getItem('app_clients');
      return saved ? JSON.parse(saved) : MOCK_CLIENTS;
    } catch {
      return MOCK_CLIENTS;
    }
  });

  const [secrets, setSecrets] = useState<IntegrationSecret[]>(() => {
    try {
      const saved = localStorage.getItem('app_secrets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [campaigns] = useState<CampaignStats[]>(MOCK_CAMPAIGNS);

  useEffect(() => {
    localStorage.setItem('app_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('app_secrets', JSON.stringify(secrets));
  }, [secrets]);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('auth_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
  };

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />} />
        
        <Route element={user ? <Layout user={user} onLogout={handleLogout} clients={clients} /> : <Navigate to="/login" replace />}>
          <Route path="/" element={user?.role === UserRole.ADMIN ? <AdminDashboard clients={clients} campaigns={campaigns} /> : <Navigate to="/client/dashboard" replace />} />
          
          {/* Admin Routes */}
          <Route path="/admin/clients" element={<AdminClients clients={clients} setClients={setClients} secrets={secrets} />} />
          <Route path="/admin/campaigns" element={<AdminCampaigns clients={clients} campaigns={campaigns} />} />
          <Route path="/admin/sql-editor" element={<AdminSqlEditor clients={clients} campaigns={campaigns} secrets={secrets} />} />
          <Route path="/admin/settings" element={<AdminSettings secrets={secrets} setSecrets={setSecrets} />} />
          
          {/* Client Routes - Support optional clientId for admin impersonation */}
          <Route path="/client/dashboard/:clientId?" element={<ClientDashboard user={user} campaigns={campaigns} clients={clients} secrets={secrets} />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
