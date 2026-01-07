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
    return saved ? JSON.parse(saved) : [];
  });

  // Moteur de calcul marketing certifié (ROAS, CTR, CPC)
  const calculateDerivedStats = useCallback((cp: Partial<CampaignStats>): CampaignStats => {
    const spend = cp.spend || 0;
    const clicks = cp.clicks || 0;
    const conv = cp.conversions || 0;
    const imps = cp.impressions || 0;
    const AOV = 145.00; // Panier moyen simulé pour le calcul du revenu

    return {
      ...(cp as CampaignStats),
      ctr: imps > 0 ? clicks / imps : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      roas: spend > 0 ? (conv * AOV) / spend : 0,
      lastSync: new Date().toISOString()
    };
  }, []);

  // AUTO-PROVISIONING : Détecte toute campagne "assignée" mais pas encore "dans la plateforme"
  useEffect(() => {
    // 1. On récupère TOUS les IDs que les admins ont assigné aux clients
    const assignedCampaignIds = new Set(clients.flatMap(c => c.campaignIds));
    
    // 2. On récupère les IDs déjà présents dans notre base de stats
    const existingCampaignIds = new Set(campaigns.map(c => c.campaignId));
    
    // 3. On identifie les manquants
    const missingIds = Array.from(assignedCampaignIds).filter(id => !existingCampaignIds.has(id));
    
    if (missingIds.length > 0) {
      console.log(`[Auto-Provisioning] Initialisation de ${missingIds.length} nouvelles campagnes...`);
      
      const newEntries: CampaignStats[] = missingIds.map(id => {
        // On cherche si le nom est disponible dans un "pool" ou on en génère un
        const client = clients.find(c => c.campaignIds.includes(id));
        return calculateDerivedStats({
          id: `local_${Math.random().toString(36).substr(2, 9)}`,
          campaignId: id,
          name: `Campagne ${id} - ${client?.name || 'Inconnu'}`,
          date: new Date().toISOString(),
          spend: 50 + Math.random() * 100, // Budget initial
          impressions: 5000 + Math.floor(Math.random() * 5000),
          clicks: 150 + Math.floor(Math.random() * 200),
          conversions: 5 + Math.floor(Math.random() * 10),
          status: 'ACTIVE',
          dataSource: 'MOCK'
        });
      });
      
      setCampaigns(prev => [...prev, ...newEntries]);
    }
  }, [clients, campaigns, calculateDerivedStats]);

  // LIVE PULSE ENGINE : Fait vivre uniquement les campagnes assignées
  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setCampaigns(prev => prev.map(cp => {
        // Est-ce que cette campagne appartient toujours à quelqu'un ?
        const isCurrentlyAssigned = clients.some(c => c.campaignIds.includes(cp.campaignId));
        
        if (!isCurrentlyAssigned || cp.status !== 'ACTIVE') return cp;
        
        // Simulation de trafic incrémental réaliste
        const growthFactor = Math.random();
        const newImps = cp.impressions + Math.floor(growthFactor * 300);
        const newClicks = cp.clicks + (growthFactor > 0.8 ? Math.floor(Math.random() * 8) : 0);
        const newConv = cp.conversions + (growthFactor > 0.96 ? 1 : 0);
        const addedSpend = (newClicks - cp.clicks) * (cp.cpc || 1.25) + (Math.random() * 0.5);

        return calculateDerivedStats({
          ...cp,
          impressions: newImps,
          clicks: newClicks,
          conversions: newConv,
          spend: cp.spend + addedSpend
        });
      }));
    }, 5000);

    return () => clearInterval(pulseInterval);
  }, [clients, calculateDerivedStats]);

  // Persistance Locale
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