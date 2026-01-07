
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, UserRole, Client, CampaignStats, IntegrationSecret } from './types';
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
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('auth_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [clients, setClients] = useState<Client[]>(() => DB.getClients());
  const [secrets, setSecrets] = useState<IntegrationSecret[]>(() => DB.getSecrets());
  const [campaigns, setCampaigns] = useState<CampaignStats[]>(() => DB.getCampaigns());

  useEffect(() => { DB.saveClients(clients); }, [clients]);
  useEffect(() => { DB.saveSecrets(secrets); }, [secrets]);
  useEffect(() => { DB.saveCampaigns(campaigns); }, [campaigns]);

  const sanitizeCampaign = useCallback((cp: any): CampaignStats => {
    const spend = Math.max(0, parseFloat(String(cp.spend)) || 0);
    const conv = Math.max(0, parseInt(String(cp.conversions)) || 0);
    const imps = Math.max(0, parseInt(String(cp.impressions)) || 0);
    const reach = Math.max(0, parseInt(String(cp.reach)) || Math.round(imps * 0.8));
    const clicks = Math.max(0, parseInt(String(cp.clicks)) || 0);
    const currency = cp.currency || 'USD';
    const AOV = currency === 'EUR' ? 135.00 : 145.00; 

    return {
      id: cp.id || `cp_${Math.random().toString(36).substring(2, 9)}`,
      campaignId: cp.campaignId || 'unassigned',
      name: cp.name || 'Untitled Campaign',
      date: cp.date || new Date().toISOString(),
      spend: spend,
      currency: currency,
      clicks: clicks,
      conversions: conv,
      impressions: imps,
      reach: reach,
      frequency: reach > 0 ? imps / reach : 1,
      ctr: imps > 0 ? (clicks / imps) : 0,
      cpc: clicks > 0 ? (spend / clicks) : 0,
      cpm: imps > 0 ? (spend / imps) * 1000 : 0,
      cpa: conv > 0 ? spend / conv : 0,
      roas: spend > 0 ? (conv * AOV) / spend : 0,
      lastSync: cp.lastSync || new Date().toISOString(),
      isValidated: !!cp.isValidated,
      status: cp.status || 'ACTIVE',
      dataSource: cp.dataSource || 'MOCK',
      auditLogs: Array.isArray(cp.auditLogs) ? cp.auditLogs : []
    };
  }, []);

  useEffect(() => {
    if (campaigns.length === 0 && clients.length > 0) {
      const allLinkedIds = clients.flatMap(c => c.campaignIds);
      const newEntries = allLinkedIds.map(id => {
        const owner = clients.find(c => c.campaignIds?.includes(id));
        const isFitness = owner?.name.includes('Fitness');
        return sanitizeCampaign({
          campaignId: id,
          name: `Marketing Campaign ${id} (${owner?.name})`,
          spend: 1200 + Math.random() * 3000, 
          impressions: 85000 + Math.floor(Math.random() * 50000),
          clicks: 2500 + Math.floor(Math.random() * 1500),
          conversions: 45 + Math.floor(Math.random() * 120),
          currency: isFitness ? 'USD' : 'EUR',
          dataSource: 'MOCK'
        });
      });
      setCampaigns(newEntries);
    }
  }, [clients, campaigns.length, sanitizeCampaign]);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('auth_session', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('auth_session');
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
          <Route path="/client/dashboard/:clientId?" element={<ClientDashboard user={user} campaigns={campaigns} clients={clients} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
