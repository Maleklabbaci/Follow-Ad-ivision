
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, AdAccount, IntegrationSecret, FacebookCampaign, User, UserRole } from '../types';
import { decryptSecret } from '../services/cryptoService';
import { DB } from '../services/db';

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
  const [isSaving, setIsSaving] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPassword, setNewClientPassword] = useState('');

  const [linkingClient, setLinkingClient] = useState<Client | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<AdAccount[]>([]);
  const [availableCampaigns, setAvailableCampaigns] = useState<FacebookCampaign[]>([]);
  
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);

  const handleNameChange = (val: string) => {
    setNewClientName(val);
    if (val.trim()) {
      const emailPrefix = val.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, '');
      setNewClientEmail(`${emailPrefix}@ivison.com`);
      
      if (!newClientPassword) {
        setNewClientPassword(`${emailPrefix}2025!`);
      }
    } else {
      setNewClientEmail('');
      setNewClientPassword('');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const clientId = Math.random().toString(36).substr(2, 9);
    const newClient: Client = {
      id: clientId,
      name: newClientName,
      email: newClientEmail,
      createdAt: new Date().toISOString().split('T')[0],
      adAccounts: [],
      campaignIds: []
    };
    const newUser: User = {
      id: `u_${clientId}`,
      email: newClientEmail,
      name: newClientName,
      role: UserRole.CLIENT,
      clientId: clientId,
      password: newClientPassword
    };

    try {
      await DB.saveClients([...clients, newClient]);
      await DB.saveUsers([...users, newUser]);
      setClients(prev => [...prev, newClient]);
      setUsers(prev => [...prev, newUser]);
      setIsAdding(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPassword('');
    } catch (err: any) { alert(err.message); } 
    finally { setIsSaving(false); }
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (window.confirm(`Supprimer définitivement ${clientName} ?`)) {
      setIsSaving(true);
      try {
        await DB.deleteClient(clientId);
        setClients(prev => prev.filter(c => c.id !== clientId));
        setUsers(prev => prev.filter(u => u.clientId !== clientId));
      } catch (err: any) { alert(err.message); } 
      finally { setIsSaving(false); }
    }
  };

  const openLinkingModal = async (client: Client) => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      alert("Configurez Meta Ads dans Settings.");
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
    } catch (err: any) { alert(err.message); } 
    finally { setIsLoadingAccounts(false); }
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
    } catch (err: any) { console.error(err); } 
    finally { setIsLoadingCampaigns(false); }
  }, [secrets]);

  useEffect(() => {
    if (linkingClient) fetchCampaigns(selectedAccountIds);
  }, [selectedAccountIds, linkingClient, fetchCampaigns]);

  const saveLinking = async () => {
    if (!linkingClient) return;
    setIsSaving(true);
    const updatedClients = clients.map(c => 
      c.id === linkingClient.id ? { ...c, adAccounts: selectedAccountIds, campaignIds: selectedCampaignIds } : c
    );
    try {
      await DB.saveClients(updatedClients);
      setClients(updatedClients);
      setLinkingClient(null);
    } catch (err: any) { alert(err.message); } 
    finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm gap-4">
        <div>
          <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight uppercase italic">Clients Portfolio</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[8px] md:text-[9px]">SaaS Cloud : Sync Active</p>
          </div>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="w-full sm:w-auto px-6 py-4 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-100 uppercase tracking-widest"
        >
          Nouveau Client
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 md:p-10 rounded-[1.5rem] md:rounded-[2.5rem] border-2 border-blue-100 shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-start mb-6 md:mb-8">
            <div>
              <h3 className="text-lg md:text-2xl font-black text-slate-900 uppercase italic">Nouveau Compte</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Login automatique activé</p>
            </div>
            <button onClick={() => setIsAdding(false)} className="p-2 text-slate-300 hover:text-slate-600 active:scale-90">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Entreprise</label>
              <input required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none text-base" placeholder="Ex: Nike" value={newClientName} onChange={(e) => handleNameChange(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email SaaS</label>
              <input type="email" required className="w-full px-5 py-3.5 bg-blue-50/50 border border-blue-100 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none text-blue-700 text-base" placeholder="nom@ivison.com" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
              <input type="text" required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none text-base" value={newClientPassword} onChange={(e) => setNewClientPassword(e.target.value)} />
            </div>
            <div className="md:col-span-3 flex flex-col sm:flex-row justify-end gap-3 mt-4">
              <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-4 text-slate-400 font-black text-[10px] uppercase active:opacity-60">Annuler</button>
              <button type="submit" disabled={isSaving} className="px-10 py-4 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3">
                {isSaving ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'VALIDER & CRÉER'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8">
        {clients.map(client => {
          const hasUserAccount = users.some(u => u.clientId === client.id);
          return (
            <div key={client.id} className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-xl transition-all p-6 md:p-10 group relative overflow-hidden">
              <div className="absolute top-2 right-2 p-2 opacity-0 group-hover:opacity-100 transition-all z-10 md:top-4 md:right-4">
                  <button onClick={() => handleDeleteClient(client.id, client.name)} disabled={isSaving} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
              </div>
              <div className="flex items-center gap-4 md:gap-6 mb-6 md:mb-8">
                 <div className="w-14 h-14 md:w-20 md:h-20 bg-slate-50 rounded-xl md:rounded-3xl flex items-center justify-center text-slate-300 font-black text-xl md:text-3xl group-hover:bg-blue-600 group-hover:text-white transition-all">{client.name.charAt(0)}</div>
                 <div className="min-w-0">
                    <h3 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight uppercase italic truncate">{client.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${hasUserAccount ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                      <p className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">
                        {hasUserAccount ? 'Compte Prêt' : 'Login manquant'}
                      </p>
                    </div>
                 </div>
              </div>
              <div className="space-y-3 pt-6 border-t border-slate-50">
                <div className="flex justify-between items-center text-[9px] md:text-[11px]">
                  <span className="font-black text-slate-400 uppercase tracking-widest italic">Email</span>
                  <span className="font-bold text-slate-600 truncate ml-4">{client.email}</span>
                </div>
                <div className="flex justify-between items-center text-[9px] md:text-[11px]">
                  <span className="font-black text-slate-400 uppercase tracking-widest italic">Ads Accounts</span>
                  <span className="px-2 py-0.5 bg-blue-50 rounded-lg font-black text-blue-600">{client.adAccounts?.length || 0}</span>
                </div>
              </div>
              <div className="mt-8 flex gap-3">
                <button onClick={() => openLinkingModal(client)} className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl text-[9px] md:text-[11px] font-black uppercase tracking-widest hover:bg-black active:scale-95 transition-all">Lier Meta</button>
                <button onClick={() => navigate(`/client/dashboard/${client.id}`)} className="p-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-50">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {linkingClient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xl md:p-6">
          <div className="bg-white w-full h-full md:h-auto md:max-w-4xl md:rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-6 md:p-10 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight uppercase italic">Meta Sync</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Liaison pour {linkingClient.name}</p>
              </div>
              <button onClick={() => setLinkingClient(null)} className="p-3 hover:bg-slate-50 rounded-2xl transition-all">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50/20">
              <div className="w-full md:w-1/2 border-r border-slate-100 flex flex-col p-6 md:p-8 overflow-hidden">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Accounts
                </h4>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar max-h-[250px] md:max-h-none">
                  {isLoadingAccounts ? <div className="h-20 bg-slate-100 animate-pulse rounded-xl"></div> : availableAccounts.map(account => (
                    <div key={account.id} onClick={() => setSelectedAccountIds(prev => prev.includes(account.id) ? prev.filter(id => id !== account.id) : [...prev, account.id])} className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedAccountIds.includes(account.id) ? 'border-blue-600 bg-blue-50' : 'border-transparent bg-white shadow-sm'}`}>
                      <p className="text-xs font-black text-slate-900 uppercase truncate">{account.name}</p>
                      <p className="text-[8px] text-slate-400 font-bold tracking-widest mt-0.5">ID: {account.id}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-full md:w-1/2 flex flex-col p-6 md:p-8 overflow-hidden">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Campagnes
                </h4>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar max-h-[250px] md:max-h-none">
                  {isLoadingCampaigns ? <div className="h-10 bg-slate-100 animate-pulse rounded-xl"></div> : availableCampaigns.map(cp => (
                    <div key={cp.id} onClick={() => setSelectedCampaignIds(prev => prev.includes(cp.id) ? prev.filter(id => id !== cp.id) : [...prev, cp.id])} className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between ${selectedCampaignIds.includes(cp.id) ? 'border-emerald-500 bg-emerald-50' : 'border-transparent bg-white shadow-sm'}`}>
                       <p className="text-[10px] font-black text-slate-900 uppercase truncate">{cp.name}</p>
                       {selectedCampaignIds.includes(cp.id) && <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 md:p-10 border-t border-slate-100 flex justify-end gap-3 bg-white sticky bottom-0">
                <button onClick={() => setLinkingClient(null)} className="px-6 py-4 text-slate-400 font-black text-[10px] uppercase">Fermer</button>
                <button onClick={saveLinking} disabled={isSaving} className="flex-1 md:flex-none px-10 py-4 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all">
                  {isSaving ? 'Sync...' : 'Sauvegarder'}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClients;
