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
    // Données par défaut si vide pour la démo
    if (parsed.length === 0) {
      return [
        { id: 'c1', name: 'Elite Fitness', email: 'contact@fitness.com', createdAt: '2024-01-01', adAccounts: ['act_123'], campaignIds: ['cp_1', 'cp_2'] },
        { id: 'c2', name: 'Bloom Boutique', email: 'client@bloom.com', createdAt: '2024-02-15', adAccounts: ['act_456'], campaignIds: ['cp_3'] }
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
        { id: '1', campaignId: 'cp_1', name: 'Spring Promo', date: '2024-05-01', spend: 1200, impressions: 50000, clicks: 1200, conversions: 45, ctr: 0.024, cpc: 1.0, roas: 3.5, status: 'ACTIVE', dataSource: 'MOCK' },
        { id: '2', campaignId: 'cp_2', name: 'Retargeting High-Value', date: '2024-05-01', spend: 800, impressions: 20000, clicks: 950, conversions: 32, ctr: 0.0475, cpc: 0.84, roas: 4.2, status: 'ACTIVE', dataSource: 'MOCK' },
        { id: '3', campaignId: 'cp_3', name: 'Brand Awareness Bloom', date: '2024-05-01', spend: 500, impressions: 100000, clicks: 800, conversions: 12, ctr: 0.008, cpc: 0.62, roas: 1.5, status: 'ACTIVE', dataSource: 'MOCK' }
      ];
    }
    return parsed;
  });

  const [isPulseActive, setIsPulseActive] = useState(true);

  // Fonction de calcul des KPIs marketing réels
  const calculateDerivedStats = useCallback((stats: Partial<CampaignStats>): CampaignStats => {
    const spend = stats.spend || 0;
    const clicks = stats.clicks || 0;
    const conversions = stats.conversions || 0;
    const impressions = stats.impressions || 0;
    
    return {
      ...(stats as CampaignStats),
      ctr: impressions > 0 ? clicks / impressions : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      roas: spend > 0 ? (conversions * 45) / spend : 0, // 45€ de panier moyen simulé
      lastSync: new Date().toISOString()
    };
  }, []);

  // Effet de rechargement/pulse automatique pour simuler le temps réel
  useEffect(() => {
    if (!isPulseActive) return;

    const interval = setInterval(() => {
      setCampaigns(prev => prev.map(cp => {
        if (cp.status !== 'ACTIVE') return cp;
        
        // Simulation de trafic incrémental (vrais calculs basés sur progression)
        const newImpressions = cp.impressions + Math.floor(Math.random() * 50);
        const newClicks = cp.clicks + (Math.random() > 0.7 ? 1 : 0);
        const newConversions = cp.conversions + (Math.random() > 0.95 ? 1 : 0);
        const newSpend = cp.spend + (Math.random() * 0.5);

        return calculateDerivedStats({
          ...cp,
          impressions: newImpressions,
          clicks: newClicks,
          conversions: newConversions,
          spend: newSpend
        });
      }));
    }, 5000); // Pulse toutes les 5 secondes

    return () => clearInterval(interval);
  }, [isPulseActive, calculateDerivedStats]);

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