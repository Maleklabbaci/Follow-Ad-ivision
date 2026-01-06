import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, AdAccount, IntegrationSecret, FacebookCampaign } from '../types';
import { decryptSecret } from '../services/cryptoService';

interface AdminClientsProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  secrets: IntegrationSecret[];
}

const MOCK_FALLBACK_ACCOUNTS: AdAccount[] = [
  { id: 'act_12345678', name: 'Elite Fitness Pro (Mock)', currency: 'USD' },
  { id: 'act_87654321', name: 'Bloom Boutique FR (Mock)', currency: 'EUR' },
  { id: 'act_11223344', name: 'Global Tech Store (Mock)', currency: 'USD' },
];

const MOCK_FALLBACK_CAMPAIGNS: Record<string, FacebookCampaign[]> = {
  'act_12345678': [
    { id: 'cp_1', name: 'Spring Sale - Fitness', status: 'ACTIVE', account_id: 'act_12345678' },
    { id: 'cp_101', name: 'Winter Warmup', status: 'PAUSED', account_id: 'act_12345678' },
  ],
  'act_87654321': [
    { id: 'cp_2', name: 'Remarketing - Bloom', status: 'ACTIVE', account_id: 'act_87654321' },
    { id: 'cp_3', name: 'Cold Interest - Bloom', status: 'ACTIVE', account_id: 'act_87654321' },
  ],
};

const AdminClients: React.FC<AdminClientsProps> = ({ clients, setClients, secrets }) => {
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');

  const [modalStep, setModalStep] = useState<'ACCOUNTS' | 'CAMPAIGNS'>('ACCOUNTS');
  const [linkingClient, setLinkingClient] = useState<Client | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<AdAccount[]>([]);
  const [availableCampaigns, setAvailableCampaigns] = useState<FacebookCampaign[]>([]);
  
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const newClient: Client = {
      id: Math.random().toString(36).substr(2, 9),
      name: newClientName,
      email: newClientEmail,
      createdAt: new Date().toISOString().split('T')[0],
      adAccounts: [],
      campaignIds: []
    };
    setClients([...clients, newClient]);
    setIsAdding(false);
    setNewClientName('');
    setNewClientEmail('');
  };

  const handleDeleteClient = (clientId: string, clientName: string) => {
    if (window.confirm(`Are you sure you want to delete ${clientName}? This action cannot be undone.`)) {
      setClients(prev => prev.filter(c => c.id !== clientId));
    }
  };

  const openLinkingModal = async (client: Client) => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    
    if (!fbSecret) {
      alert("Facebook API Token not configured. Please go to Settings.");
      return;
    }

    setLinkingClient(client);
    setModalStep('ACCOUNTS');
    setSelectedAccountIds(client.adAccounts || []);
    setSelectedCampaignIds(client.campaignIds || []);
    setIsLoading(true);
    setError(null);
    setAvailableAccounts([]);

    try {
      const token = await decryptSecret(fbSecret.value);
      const response = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=name,currency,id&access_token=${token}`);
      const data = await response.json();

      if (data.error) throw new Error(data.error.message);
      if (data.data && Array.isArray(data.data)) {
        setAvailableAccounts(data.data);
      }
    } catch (err: any) {
      setAvailableAccounts(MOCK_FALLBACK_ACCOUNTS);
      setError("Fallback to demo data (API restricted or CORS).");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    if (selectedAccountIds.length === 0) return alert("Select an account.");
    setIsLoading(true);
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    
    try {
      const token = await decryptSecret(fbSecret!.value);
      let allCampaigns: FacebookCampaign[] = [];

      for (const accId of selectedAccountIds) {
        try {
          const response = await fetch(`https://graph.facebook.com/v19.0/${accId}/campaigns?fields=name,status,id,account_id&access_token=${token}`);
          const data = await response.json();
          if (data.data) allCampaigns = [...allCampaigns, ...data.data];
        } catch (e) {
          if (MOCK_FALLBACK_CAMPAIGNS[accId]) allCampaigns = [...allCampaigns, ...MOCK_FALLBACK_CAMPAIGNS[accId]];
        }
      }
      setAvailableCampaigns(allCampaigns);
      setModalStep('CAMPAIGNS');
    } catch (err) {
      setModalStep('CAMPAIGNS');
    } finally {
      setIsLoading(false);
    }
  };

  const saveLinking = () => {
    if (!linkingClient) return;
    setClients(prev => prev.map(c => 
      c.id === linkingClient.id 
        ? { ...c, adAccounts: selectedAccountIds, campaignIds: selectedCampaignIds } 
        : c
    ));
    setLinkingClient(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Client Portfolio</h2>
          <p className="text-slate-500">Manage clients and marketing links.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Client
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm">
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
              <input required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Primary Email</label>
              <input type="email" required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-600 font-medium">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium">Save Client</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {clients.map(client => (
          <div key={client.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 group relative">
            <button
              type="button"
              onClick={() => handleDeleteClient(client.id, client.name)}
              className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-1">{client.name}</h3>
            <p className="text-sm text-slate-500 mb-4">{client.email}</p>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => openLinkingModal(client)} className="flex-1 py-2 bg-slate-50 text-slate-700 rounded-lg text-sm font-medium border border-slate-200 hover:bg-slate-100 transition-colors">Configure</button>
              <button type="button" onClick={() => navigate(`/client/dashboard/${client.id}`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Dashboard</button>
            </div>
          </div>
        ))}
      </div>

      {linkingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">{modalStep === 'ACCOUNTS' ? 'Step 1: Accounts' : 'Step 2: Campaigns'}</h3>
              <button type="button" onClick={() => setLinkingClient(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 max-h-[50vh] overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
              ) : (
                <div className="space-y-2">
                  {modalStep === 'ACCOUNTS' ? (
                    availableAccounts.map(acc => (
                      <div key={acc.id} onClick={() => setSelectedAccountIds(prev => prev.includes(acc.id) ? prev.filter(i => i !== acc.id) : [...prev, acc.id])} 
                           className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedAccountIds.includes(acc.id) ? 'border-blue-600 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                        <p className="font-bold text-slate-900">{acc.name}</p>
                        <p className="text-xs text-slate-500">{acc.id}</p>
                      </div>
                    ))
                  ) : (
                    availableCampaigns.map(cp => (
                      <div key={cp.id} onClick={() => setSelectedCampaignIds(prev => prev.includes(cp.id) ? prev.filter(i => i !== cp.id) : [...prev, cp.id])}
                           className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedCampaignIds.includes(cp.id) ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                        <p className="font-bold text-slate-900">{cp.name}</p>
                        <p className="text-xs text-slate-500">{cp.status}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={() => setLinkingClient(null)} className="px-4 py-2 text-slate-600 font-medium">Cancel</button>
              {modalStep === 'ACCOUNTS' ? (
                <button type="button" onClick={fetchCampaigns} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors">Next</button>
              ) : (
                <button type="button" onClick={saveLinking} className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors">Save</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClients;