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
        { id: 'c1', name: 'Elite Fitness Pro', email: 'contact@fitness.com', createdAt: '2024-01-01', adAccounts: ['act_123'], campaignIds: ['cp_1', 'cp_2'] },
        { id: 'c2', name: 'Bloom Boutique', email: 'client@bloom.com', createdAt: '2024-02-15', adAccounts: ['act_456'], campaignIds: ['cp_3', 'cp_4'] }
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
    const parsed = saved ? JSON.parse(saved) : [];
    if (parsed.length === 0) {
      return [
        { id: '1', campaignId: 'cp_1', name: 'Performance Max - Leads', date: '2024-05-01', spend: 4520.50, impressions: 154000, clicks: 3200, conversions: 124, ctr: 0.0207, cpc: 1.41, roas: 5.48, status: 'ACTIVE', dataSource: 'MOCK' },
        { id: '2', campaignId: 'cp_2', name: 'Retargeting - Abandoned Cart', date: '2024-05-01', spend: 1240.20, impressions: 45000, clicks: 1150, conversions: 89, ctr: 0.0255, cpc: 1.07, roas: 7.17, status: 'ACTIVE', dataSource: 'MOCK' },
        { id: '3', campaignId: 'cp_3', name: 'Collection Ad - New Arrival', date: '2024-05-01', spend: 2850.00, impressions: 210000, clicks: 5400, conversions: 65, ctr: 0.0257, cpc: 0.52, roas: 2.28, status: 'ACTIVE', dataSource: 'MOCK' },
        { id: '4', campaignId: 'cp_4', name: 'Brand Awareness - Lifestyle', date: '2024-05-01', spend: 850.00, impressions: 500000, clicks: 1200, conversions: 8, ctr: 0.0024, cpc: 0.70, roas: 0.94, status: 'ACTIVE', dataSource: 'MOCK' }
      ];
    }
    return parsed;
  });

  const calculateDerivedStats = useCallback((stats: Partial<CampaignStats>): CampaignStats => {
    const spend = stats.spend || 0;
    const clicks = stats.clicks || 0;
    const conversions = stats.conversions || 0;
    const impressions = stats.impressions || 0;
    
    // Valeur moyenne d'une conversion (AOV) estimée à 200€ pour le calcul du ROAS
    const aov = 200; 

    return {
      ...(stats as CampaignStats),
      ctr: impressions > 0 ? (clicks / impressions) : 0,
      cpc: clicks > 0 ? (spend / clicks) : 0,
      roas: spend > 0 ? (conversions * aov) / spend : 0,
      lastSync: new Date().toISOString()
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCampaigns(prev => prev.map(cp => {
        if (cp.status !== 'ACTIVE') return cp;
        
        // Simulation de progression organique
        const rand = Math.random();
        const addedImpressions = Math.floor(rand * 150);
        const addedClicks = rand > 0.8 ? Math.floor(rand * 5) : 0;
        const addedConversions = rand > 0.97 ? 1 : 0;
        const addedSpend = addedClicks * (cp.cpc || 1.2) * (0.9 + Math.random() * 0.2);

        return calculateDerivedStats({
          ...cp,
          impressions: cp.impressions + addedImpressions,
          clicks: cp.clicks + addedClicks,
          conversions: cp.conversions + addedConversions,
          spend: cp.spend + addedSpend
        });
      }));
    }, 3000); 

    return () => clearInterval(interval);
  }, [calculateDerivedStats]);

  useEffect(() => {
    localStorage.setItem('app_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('app_secrets', JSON.stringify(secrets));
  }, [secrets]);

  useEffect(() => {
    localStorage.setItem('app_campaigns', JSON.stringify(campaigns));
  }, [campaigns]);

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