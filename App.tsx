
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
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('app_clients');
    const parsed = saved ? JSON.parse(saved) : [];
    if (parsed.length === 0) {
      return [
        { id: 'c1', name: 'Elite Fitness Pro', email: 'contact@fitness.com', createdAt: '2024-01-01', adAccounts: ['act_12345678'], campaignIds: ['cp_1', 'cp_2'] },
        { id: 'c2', name: 'Bloom Boutique', email: 'client@bloom.com', createdAt: '2024-02-15', adAccounts: ['act_87654321'], campaignIds: ['cp_3', 'cp_4'] }
      ];
    }
    return parsed;
  });

  const [secrets, setSecrets] = useState<IntegrationSecret[]>(() => {
    const saved = localStorage.getItem('app_secrets');
    return saved ? JSON.parse(saved) : [];
  });

  const [campaigns, setCampaigns] = useState<CampaignStats[]>(() => {
    const saved = localStorage.getItem('app_campaigns');
    return saved ? JSON.parse(saved) : [];
  });

  const calculateDerivedStats = useCallback((cp: Partial<CampaignStats>): CampaignStats => {
    const spend = cp.spend || 0;
    const clicks = cp.clicks || 0;
    const conv = cp.conversions || 0;
    const imps = cp.impressions || 0;
    const AOV = 145.00; 

    return {
      ...(cp as CampaignStats),
      ctr: imps > 0 ? clicks / imps : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      roas: spend > 0 ? (conv * AOV) / spend : 0,
      lastSync: cp.lastSync || new Date().toISOString(),
      isValidated: cp.isValidated ?? false
    };
  }, []);

  // AUTO-PROVISIONING: Link campaigns to clients automatically
  useEffect(() => {
    const assignedCampaignIds = new Set(clients.flatMap(c => c.campaignIds));
    const existingCampaignIds = new Set(campaigns.map(c => c.campaignId));
    const missingIds = Array.from(assignedCampaignIds).filter(id => !existingCampaignIds.has(id));
    
    if (missingIds.length > 0) {
      const newEntries: CampaignStats[] = missingIds.map(id => {
        const owner = clients.find(c => c.campaignIds.includes(id));
        return calculateDerivedStats({
          id: `local_${Math.random().toString(36).substring(2, 9)}`,
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
  }, [clients, campaigns.length, calculateDerivedStats]);

  // LIVE PULSE: Only for non-validated mock data
  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setCampaigns(prev => {
        let hasChanges = false;
        const updated = prev.map(cp => {
          const isAssigned = clients.some(c => c.campaignIds.includes(cp.campaignId));
          if (!isAssigned || cp.status !== 'ACTIVE' || cp.dataSource === 'REAL_API' || cp.isValidated) return cp;
          
          hasChanges = true;
          const tick = Math.random();
          const addImps = Math.floor(tick * 150);
          const addClicks = tick > 0.85 ? Math.floor(Math.random() * 5) : 0;
          const addConv = tick > 0.98 ? 1 : 0;
          const addedSpend = (addClicks * (cp.cpc || 1.1)) + (Math.random() * 0.2);

          return calculateDerivedStats({
            ...cp,
            impressions: cp.impressions + addImps,
            clicks: cp.clicks + addClicks,
            conversions: cp.conversions + addConv,
            spend: cp.spend + addedSpend
          });
        });
        return hasChanges ? updated : prev;
      });
    }, 5000);

    return () => clearInterval(pulseInterval);
  }, [clients, calculateDerivedStats]);

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
          <Route path="/admin/campaigns" element={<AdminCampaigns clients={clients} campaigns={campaigns} setCampaigns={setCampaigns} secrets={secrets} />} />
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
