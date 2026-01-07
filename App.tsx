
import React, { useState, useEffect, useCallback } from 'react';
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

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const saved = localStorage.getItem('app_clients');
      const parsed = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return [
          { id: 'c1', name: 'Elite Fitness Pro', email: 'contact@fitness.com', createdAt: '2024-01-01', adAccounts: ['act_12345678'], campaignIds: ['cp_1', 'cp_2'] },
          { id: 'c2', name: 'Bloom Boutique', email: 'client@bloom.com', createdAt: '2024-02-15', adAccounts: ['act_87654321'], campaignIds: ['cp_3', 'cp_4'] }
        ];
      }
      return parsed.map(c => ({ ...c, campaignIds: c.campaignIds || [], adAccounts: c.adAccounts || [] }));
    } catch { return []; }
  });

  const [secrets, setSecrets] = useState<IntegrationSecret[]>(() => {
    try {
      const saved = localStorage.getItem('app_secrets');
      return Array.isArray(JSON.parse(saved || '[]')) ? JSON.parse(saved || '[]') : [];
    } catch { return []; }
  });

  const [campaigns, setCampaigns] = useState<CampaignStats[]>(() => {
    try {
      const saved = localStorage.getItem('app_campaigns');
      return Array.isArray(JSON.parse(saved || '[]')) ? JSON.parse(saved || '[]') : [];
    } catch { return []; }
  });

  const calculateDerivedStats = useCallback((cp: Partial<CampaignStats>): CampaignStats => {
    const spend = Number(cp.spend) || 0;
    const clicks = Number(cp.clicks) || 0;
    const conv = Number(cp.conversions) || 0;
    const imps = Number(cp.impressions) || 0;
    const AOV = 145.00; 

    return {
      ...(cp as CampaignStats),
      id: cp.id || `local_${Math.random().toString(36).substring(2, 9)}`,
      campaignId: cp.campaignId || 'unassigned',
      name: cp.name || 'Unnamed Campaign',
      spend,
      clicks,
      conversions: conv,
      impressions: imps,
      ctr: imps > 0 ? clicks / imps : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      roas: spend > 0 ? (conv * AOV) / spend : 0,
      lastSync: cp.lastSync || new Date().toISOString(),
      isValidated: !!cp.isValidated,
      status: cp.status || 'ACTIVE',
      dataSource: cp.dataSource || 'MOCK'
    };
  }, []);

  // AUTO-PROVISIONING
  useEffect(() => {
    const assignedCampaignIds = new Set(clients.flatMap(c => c.campaignIds || []));
    const existingCampaignIds = new Set(campaigns.map(c => c.campaignId));
    const missingIds = Array.from(assignedCampaignIds).filter(id => !existingCampaignIds.has(id));
    
    if (missingIds.length > 0) {
      const newEntries: CampaignStats[] = missingIds.map(id => {
        const owner = clients.find(c => c.campaignIds?.includes(id));
        return calculateDerivedStats({
          campaignId: id,
          name: `Campaign ${id} (${owner?.name || 'New'})`,
          date: new Date().toISOString(),
          spend: 100 + Math.random() * 200,
          impressions: 10000 + Math.floor(Math.random() * 5000),
          clicks: 200 + Math.floor(Math.random() * 300),
          conversions: 10 + Math.floor(Math.random() * 20),
          status: 'ACTIVE',
          dataSource: 'MOCK',
          isValidated: false,
          auditLogs: [`Auto-provisioned for client: ${owner?.name || 'Unknown'}`]
        });
      });
      setCampaigns(prev => [...prev, ...newEntries]);
    }
  }, [clients, calculateDerivedStats]);

  // Pulse Effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCampaigns(prev => {
        let changed = false;
        const next = prev.map(cp => {
          if (cp.status !== 'ACTIVE' || cp.dataSource === 'REAL_API' || cp.isValidated) return cp;
          changed = true;
          return calculateDerivedStats({
            ...cp,
            impressions: cp.impressions + Math.floor(Math.random() * 10),
            clicks: cp.clicks + (Math.random() > 0.9 ? 1 : 0),
            spend: cp.spend + (Math.random() * 0.5)
          });
        });
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [calculateDerivedStats]);

  useEffect(() => { localStorage.setItem('app_clients', JSON.stringify(clients)); }, [clients]);
  useEffect(() => { localStorage.setItem('app_secrets', JSON.stringify(secrets)); }, [secrets]);
  useEffect(() => { localStorage.setItem('app_campaigns', JSON.stringify(campaigns)); }, [campaigns]);

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
          <Route path="/admin/clients" element={<AdminClients clients={clients} setClients={setClients} secrets={secrets} />} />
          <Route path="/admin/campaigns" element={<AdminCampaigns clients={clients} setClients={setClients} campaigns={campaigns} setCampaigns={setCampaigns} secrets={secrets} />} />
          <Route path="/admin/sql-editor" element={<AdminSqlEditor clients={clients} campaigns={campaigns} secrets={secrets} />} />
          <Route path="/admin/settings" element={<AdminSettings secrets={secrets} setSecrets={setSecrets} />} />
          <Route path="/client/dashboard/:clientId?" element={<ClientDashboard user={user} campaigns={campaigns} clients={clients} secrets={secrets} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
