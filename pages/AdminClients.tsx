
import React, { useState, useEffect, useCallback } from 'react';
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

  // Linking Modal State
  const [linkingClient, setLinkingClient] = useState<Client | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<AdAccount[]>([]);
  const [availableCampaigns, setAvailableCampaigns] = useState<FacebookCampaign[]>([]);
  
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
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
    if (window.confirm(`Are you sure you want to delete ${clientName}? This action cannot be undone and will remove all associated campaign links.`)) {
      setClients(prev => prev.filter(c => c.id !== clientId));
    }
  };

  const openLinkingModal = async (client: Client) => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    
    if (!fbSecret) {
      alert("Facebook API Token not configured. Please go to Settings.");
      return;
    }

    if (fbSecret.status === 'INVALID') {
      alert("Stored Facebook token is marked as INVALID. Please re-validate in Settings.");
      return;
    }

    setLinkingClient(client);
    setSelectedAccountIds(client.adAccounts || []);
    setSelectedCampaignIds(client.campaignIds || []);
    setIsLoadingAccounts(true);
    setError(null);
    setAvailableAccounts([]);
    setAvailableCampaigns([]);

    try {
      const token = await decryptSecret(fbSecret.value);
      const response = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=name,currency,id&access_token=${token}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || "Meta API Error");
      }

      if (data.data && Array.isArray(data.data)) {
        setAvailableAccounts(data.data);
      } else {
        setAvailableAccounts([]);
      }
    } catch (err: any) {
      console.warn("Falling back to mock accounts data.", err);
      setAvailableAccounts(MOCK_FALLBACK_ACCOUNTS);
      setError("Note: Live connection failed (CORS or Invalid Token). Showing demo accounts.");
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  // AUTOMATIC CAMPAIGN FETCHING
  const fetchCampaigns = useCallback(async (accountIds: string[]) => {
    if (accountIds.length === 0) {
      setAvailableCampaigns([]);
      return;
    }

    setIsLoadingCampaigns(true);
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    
    try {
      const token = await decryptSecret(fbSecret!.value);
      let allCampaigns: FacebookCampaign[] = [];

      for (const accId of accountIds) {
        try {
          const response = await fetch(`https://graph.facebook.com/v19.0/${accId}/campaigns?fields=name,status,id,account_id&access_token=${token}`);
          const data = await response.json();
          if (data.data) allCampaigns = [...allCampaigns, ...data.data];
        } catch (e) {
          console.error(`Failed to fetch campaigns for ${accId}`, e);
          if (MOCK_FALLBACK_CAMPAIGNS[accId]) {
            allCampaigns = [...allCampaigns, ...MOCK_FALLBACK_CAMPAIGNS[accId]];
          }
        }
      }

      setAvailableCampaigns(allCampaigns);
    } catch (err) {
      console.error("Critical failure fetching campaigns", err);
      let fallbackCampaigns: FacebookCampaign[] = [];
      accountIds.forEach(id => {
        if (MOCK_FALLBACK_CAMPAIGNS[id]) fallbackCampaigns = [...fallbackCampaigns, ...MOCK_FALLBACK_CAMPAIGNS[id]];
      });
      setAvailableCampaigns(fallbackCampaigns);
    } finally {
      setIsLoadingCampaigns(false);
    }
  }, [secrets]);

  // Reactive Effect: Fetch campaigns whenever selected accounts change
  useEffect(() => {
    if (linkingClient) {
      fetchCampaigns(selectedAccountIds);
    }
  }, [selectedAccountIds, linkingClient, fetchCampaigns]);

  const handleToggleAccount = (accountId: string) => {
    setSelectedAccountIds(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId) 
        : [...prev, accountId]
    );
  };

  const handleToggleCampaign = (campaignId: string) => {
    setSelectedCampaignIds(prev => 
      prev.includes(campaignId) 
        ? prev.filter(id => id !== campaignId) 
        : [...prev, campaignId]
    );
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
          <p className="text-slate-500">Manage clients and their associated marketing accounts.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Client
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm animate-in fade-in slide-in-from-top-2">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">Register New Client</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
              <input
                required
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Primary Email</label>
              <input
                type="email"
                required
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Save Client
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {clients.map(client => (
          <div key={client.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all p-6 group relative">
            <button
              onClick={() => handleDeleteClient(client.id, client.name)}
              className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
              title="Delete Client"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => navigate(`/client/dashboard/${client.id}`)}
                  className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  title="View Client Dashboard"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </button>
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">{client.name}</h3>
            <p className="text-sm text-slate-500 mb-4">{client.email}</p>
            
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Linked Accounts:</span>
                <span className="font-semibold text-slate-900">{client.adAccounts.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Linked Campaigns:</span>
                <span className="font-semibold text-slate-900">{client.campaignIds.length}</span>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button 
                onClick={() => openLinkingModal(client)}
                className="flex-1 py-2 bg-slate-50 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors border border-slate-200"
              >
                Configure Campaigns
              </button>
              <button 
                onClick={() => navigate(`/client/dashboard/${client.id}`)}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                title="Go to Client View"
              >
                Dashboard
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* SINGLE-VIEW LINKING MODAL */}
      {linkingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-[85vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Configure Marketing Assets</h3>
                <p className="text-sm text-slate-500">Select accounts and specific campaigns for {linkingClient.name}</p>
              </div>
              <button 
                onClick={() => setLinkingClient(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex bg-slate-50/50">
              {/* LEFT COLUMN: ACCOUNTS */}
              <div className="w-1/3 border-r border-slate-200 flex flex-col p-6 overflow-hidden">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Ad Accounts</h4>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {isLoadingAccounts ? (
                    <div className="py-12 text-center text-slate-400">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-xs">Loading accounts...</p>
                    </div>
                  ) : (
                    availableAccounts.map(account => {
                      const isSelected = selectedAccountIds.includes(account.id);
                      return (
                        <div 
                          key={account.id}
                          onClick={() => handleToggleAccount(account.id)}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                            isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                            {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-bold truncate ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>{account.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{account.id}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: CAMPAIGNS */}
              <div className="flex-1 flex flex-col p-6 overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Available Campaigns</h4>
                  {isLoadingCampaigns && (
                    <div className="flex items-center gap-2 text-[10px] text-blue-600 font-bold uppercase tracking-tighter">
                      <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      Fetching...
                    </div>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {error && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 mb-4">
                      {error}
                    </div>
                  )}

                  {selectedAccountIds.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      <p className="text-sm font-medium">Select an account to view campaigns</p>
                    </div>
                  ) : availableCampaigns.length === 0 && !isLoadingCampaigns ? (
                    <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
                      No campaigns found for selected accounts.
                    </div>
                  ) : (
                    availableCampaigns.map(cp => {
                      const isSelected = selectedCampaignIds.includes(cp.id);
                      return (
                        <div 
                          key={cp.id}
                          onClick={() => handleToggleCampaign(cp.id)}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                            isSelected ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-300'}`}>
                              {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-sm font-bold truncate ${isSelected ? 'text-emerald-900' : 'text-slate-900'}`}>{cp.name}</p>
                              <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{cp.status} • {cp.id}</p>
                            </div>
                          </div>
                          <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                            {cp.account_id.slice(-4)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-between bg-white shrink-0">
              <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                <div className="flex items-center gap-1">
                  <span className="text-blue-600">{selectedAccountIds.length}</span> Accounts
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-emerald-600">{selectedCampaignIds.length}</span> Campaigns
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setLinkingClient(null)}
                  className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={saveLinking}
                  className="px-8 py-2.5 bg-slate-900 text-white font-black rounded-xl hover:bg-black transition-all shadow-lg shadow-slate-200 uppercase tracking-widest text-xs"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClients;
