
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, AdAccount, IntegrationSecret, FacebookCampaign, User, UserRole } from '../types';
import { decryptSecret } from '../services/cryptoService';

interface AdminClientsProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  secrets: IntegrationSecret[];
}

const AdminClients: React.FC<AdminClientsProps> = ({ clients, setClients, users, setUsers, secrets }) => {
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPassword, setNewClientPassword] = useState('');

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
    const clientId = Math.random().toString(36).substr(2, 9);
    
    // 1. Créer le profil client (Marketing)
    const newClient: Client = {
      id: clientId,
      name: newClientName,
      email: newClientEmail,
      createdAt: new Date().toISOString().split('T')[0],
      adAccounts: [],
      campaignIds: []
    };

    // 2. Créer le compte utilisateur (Auth)
    const newUser: User = {
      id: `u_${clientId}`,
      email: newClientEmail,
      name: newClientName,
      role: UserRole.CLIENT,
      clientId: clientId,
      password: newClientPassword || 'client123' // Fallback si vide
    };

    setClients([...clients, newClient]);
    setUsers([...users, newUser]);
    
    setIsAdding(false);
    setNewClientName('');
    setNewClientEmail('');
    setNewClientPassword('');
    alert(`Client créé avec succès ! Identifiants : ${newClientEmail} / ${newClientPassword}`);
  };

  const handleDeleteClient = (clientId: string, clientName: string) => {
    if (window.confirm(`Supprimer ${clientName}? Cela supprimera aussi ses accès.`)) {
      setClients(prev => prev.filter(c => c.id !== clientId));
      setUsers(prev => prev.filter(u => u.clientId !== clientId));
    }
  };

  const openLinkingModal = async (client: Client) => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret) {
      alert("Token Facebook absent.");
      return;
    }

    setLinkingClient(client);
    setSelectedAccountIds(client.adAccounts || []);
    setSelectedCampaignIds(client.campaignIds || []);
    setIsLoadingAccounts(true);
    
    try {
      const token = await decryptSecret(fbSecret.value);
      const response = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=name,currency,id&access_token=${token}`);
      const data = await response.json();
      setAvailableAccounts(data.data || []);
    } catch {
      setError("Erreur API.");
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const fetchCampaigns = useCallback(async (accountIds: string[]) => {
    if (accountIds.length === 0) {
      setAvailableCampaigns([]);
      return;
    }
    setIsLoadingCampaigns(true);
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    try {
      const token = await decryptSecret(fbSecret!.value);
      let all: any[] = [];
      for (const id of accountIds) {
        const res = await fetch(`https://graph.facebook.com/v19.0/${id}/campaigns?fields=name,status,id,account_id&access_token=${token}`);
        const data = await res.json();
        if (data.data) all = [...all, ...data.data];
      }
      setAvailableCampaigns(all);
    } catch {
      setAvailableCampaigns([]);
    } finally {
      setIsLoadingCampaigns(false);
    }
  }, [secrets]);

  useEffect(() => {
    if (linkingClient) fetchCampaigns(selectedAccountIds);
  }, [selectedAccountIds, linkingClient, fetchCampaigns]);

  const saveLinking = () => {
    if (!linkingClient) return;
    setClients(prev => prev.map(c => 
      c.id === linkingClient.id ? { ...c, adAccounts: selectedAccountIds, campaignIds: selectedCampaignIds } : c
    ));
    setLinkingClient(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Portfolio Clients</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Gestion des accès & campagnes</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-700 transition-all flex items-center gap-2 shadow-xl shadow-blue-100 uppercase"
        >
          Nouveau Client
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-3xl border border-blue-200 shadow-xl animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-xl font-black mb-6 text-slate-900 uppercase italic">Inscription Nouveau SaaS</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom de l'entreprise</label>
              <input
                required
                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email (Login)</label>
              <input
                type="email"
                required
                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mot de passe</label>
              <input
                type="text"
                required
                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                value={newClientPassword}
                placeholder="Ex: Client2024!"
                onChange={(e) => setNewClientPassword(e.target.value)}
              />
            </div>
            <div className="md:col-span-3 flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-6 py-3 text-slate-400 font-black text-xs uppercase"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-10 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all"
              >
                Créer & Synchroniser
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {clients.map(client => (
          <div key={client.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm hover:border-blue-300 transition-all p-8 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all">
                <button 
                  onClick={() => handleDeleteClient(client.id, client.name)}
                  className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
               <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black text-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                 {client.name.charAt(0)}
               </div>
               <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase italic">{client.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{client.email}</p>
               </div>
            </div>
            
            <div className="space-y-3 pt-6 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comptes Pubs</span>
                <span className="px-3 py-1 bg-slate-50 rounded-lg text-xs font-black text-slate-900">{client.adAccounts.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Campagnes</span>
                <span className="px-3 py-1 bg-slate-50 rounded-lg text-xs font-black text-slate-900">{client.campaignIds.length}</span>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => openLinkingModal(client)}
                className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200"
              >
                Configuration
              </button>
              <button 
                onClick={() => navigate(`/client/dashboard/${client.id}`)}
                className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                title="Aperçu Dashboard"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL DE CONFIGURATION (Linker) */}
      {linkingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-[85vh] border border-white/20">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Lier Assets Marketing</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Audit en temps réel pour {linkingClient.name}</p>
              </div>
              <button onClick={() => setLinkingClient(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex bg-slate-50/30">
              <div className="w-1/3 border-r border-slate-200 flex flex-col p-8 overflow-hidden">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Comptes Publicitaires</h4>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {isLoadingAccounts ? <div className="animate-pulse text-xs font-bold text-blue-500">Scan...</div> : (
                    availableAccounts.map(account => (
                      <div 
                        key={account.id}
                        onClick={() => setSelectedAccountIds(prev => prev.includes(account.id) ? prev.filter(id => id !== account.id) : [...prev, account.id])}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedAccountIds.includes(account.id) ? 'border-blue-600 bg-blue-50 shadow-lg shadow-blue-50' : 'border-white bg-white hover:border-slate-200'}`}
                      >
                        <p className="text-xs font-black text-slate-900 uppercase truncate">{account.name}</p>
                        <p className="text-[8px] text-slate-400 font-bold tracking-widest mt-1">{account.id}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col p-8 overflow-hidden">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Campagnes Disponibles</h4>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {availableCampaigns.map(cp => (
                    <div 
                      key={cp.id}
                      onClick={() => setSelectedCampaignIds(prev => prev.includes(cp.id) ? prev.filter(id => id !== cp.id) : [...prev, cp.id])}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${selectedCampaignIds.includes(cp.id) ? 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-50' : 'border-white bg-white hover:border-slate-200'}`}
                    >
                       <div>
                          <p className="text-xs font-black text-slate-900 uppercase">{cp.name}</p>
                          <p className="text-[8px] text-slate-400 font-bold tracking-widest">{cp.status} • {cp.id}</p>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 flex justify-between items-center bg-white">
              <div className="flex gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>Accounts: <span className="text-blue-600">{selectedAccountIds.length}</span></span>
                <span>Campaigns: <span className="text-emerald-500">{selectedCampaignIds.length}</span></span>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setLinkingClient(null)} className="px-6 py-3 text-slate-400 font-black text-xs uppercase">Fermer</button>
                <button onClick={saveLinking} className="px-10 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">Sauvegarder</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClients;
