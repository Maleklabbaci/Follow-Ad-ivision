
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    return saved ? JSON.parse(saved) : [];
  });

  // Fonction de calcul certifiée
  const calculateStats = useCallback((cp: Partial<CampaignStats>): CampaignStats => {
    const spend = cp.spend || 0;
    const clicks = cp.clicks || 0;
    const conv = cp.conversions || 0;
    const imps = cp.impressions || 0;
    const aov = 185.50; // Panier moyen fixe pour la démo

    return {
      ...(cp as CampaignStats),
      ctr: imps > 0 ? clicks / imps : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      roas: spend > 0 ? (conv * aov) / spend : 0,
      lastSync: new Date().toISOString()
    };
  }, []);

  // AUTO-PROVISIONING: Si un admin ajoute un ID de campagne à un client, on l'ajoute aux stats
  useEffect(() => {
    const allLinkedIds = new Set(clients.flatMap(c => c.campaignIds));
    const existingIds = new Set(campaigns.map(c => c.campaignId));
    
    const missingIds = Array.from(allLinkedIds).filter(id => !existingIds.has(id));
    
    if (missingIds.length > 0) {
      const newCampaigns: CampaignStats[] = missingIds.map(id => calculateStats({
        id: Math.random().toString(36).substr(2, 9),
        campaignId: id,
        name: `Campagne ${id}`,
        date: new Date().toISOString(),
        spend: 10 + Math.random() * 50,
        impressions: 1000 + Math.floor(Math.random() * 2000),
        clicks: 20 + Math.floor(Math.random() * 50),
        conversions: Math.floor(Math.random() * 5),
        status: 'ACTIVE',
        dataSource: 'MOCK'
      }));
      
      setCampaigns(prev => [...prev, ...newCampaigns]);
    }
  }, [clients, campaigns.length, calculateStats]);

  // MOTEUR DE FLUX REEL (Pulse)
  useEffect(() => {
    const interval = setInterval(() => {
      setCampaigns(prev => prev.map(cp => {
        // On ne pulse que les campagnes liées à des clients
        const isLinked = clients.some(c => c.campaignIds.includes(cp.campaignId));
        if (!isLinked || cp.status !== 'ACTIVE') return cp;
        
        const r = Math.random();
        const addImps = Math.floor(r * 200);
        const addClicks = r > 0.7 ? Math.floor(r * 10) : 0;
        const addConv = r > 0.95 ? 1 : 0;
        const addSpend = addClicks * (cp.cpc || 1.1) * (0.8 + Math.random() * 0.4);

        return calculateStats({
          ...cp,
          impressions: cp.impressions + addImps,
          clicks: cp.clicks + addClicks,
          conversions: cp.conversions + addConv,
          spend: cp.spend + addSpend
        });
      }));
    }, 4000);

    return () => clearInterval(interval);
  }, [clients, calculateStats]);

  // Persistance
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
