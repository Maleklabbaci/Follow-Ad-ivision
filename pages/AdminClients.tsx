
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
      alert(`SUCCÈS : Le client "${newClientName}" a été créé.`);
    } catch (err: any) {
      alert(`ERREUR CLOUD : ${err.message || "Problème de synchronisation Supabase"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (window.confirm(`Supprimer définitivement ${clientName} ?`)) {
      setIsSaving(true);
      try {
        await DB.deleteClient(clientId);
        setClients(prev => prev.filter(c => c.id !== clientId));
        setUsers(prev => prev.filter(u => u.clientId !== clientId));
      } catch (err: any) {
        alert(`Erreur : ${err.message}`);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const openLinkingModal = async (client: Client) => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      alert("Configurez d'abord votre Token Meta.");
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
    } catch (err: any) {
      alert(`Meta API Error: ${err.message}`);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 md:p-10 rounded-2xl md:rounded-[3rem] border border-slate-100 shadow-sm gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight uppercase italic leading-none">Clients</h2>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">Cloud Infrastructure Active</p>
          </div>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="w-full sm:w-auto px-8 py-5 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-700 transition-all shadow-2xl shadow-blue-100 uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
          NOUVEAU CLIENT
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-8 md:p-12 rounded-2xl md:rounded-[3.5rem] border-2 border-blue-100 shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-start mb-10">
            <h3 className="text-2xl md:text-3xl font-black text-slate-900 uppercase italic">Onboarding Client</h3>
            <button onClick={() => setIsAdding(false)} className="p-3 text-slate-300 hover:text-slate-900 transition-colors bg-slate-50 rounded-full">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 italic">Entreprise</label>
              <input required className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" placeholder="Nom du Client" value={newClientName} onChange={(e) => handleNameChange(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 italic">Login Automatique</label>
              <input type="email" required className="w-full px-6 py-5 bg-blue-50/50 border border-blue-100 rounded-2xl font-bold text-blue-700 outline-none" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3 italic">Mot de Passe Provisoire</label>
              <input type="text" required className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" value={newClientPassword} onChange={(e) => setNewClientPassword(e.target.value)} />
            </div>
            <div className="md:col-span-3 flex flex-col sm:flex-row justify-end gap-4 mt-6">
              <button type="button" onClick={() => setIsAdding(false)} className="px-8 py-5 text-slate-400 font-black text-[11px] uppercase tracking-widest order-2 sm:order-1">ANNULER</button>
              <button type="submit" disabled={isSaving} className="px-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-4 order-1 sm:order-2 active:scale-95">
                {isSaving ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'CRÉER LE COMPTE'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-10">
        {clients.map(client => {
          const hasUserAccount = users.some(u => u.clientId === client.id);
          return (
            <div key={client.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:border-blue-400 transition-all p-8 md:p-10 group flex flex-col">
              <div className="flex justify-between items-start mb-8">
                 <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 font-black text-2xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">{client.name.charAt(0)}</div>
                 <button onClick={() => handleDeleteClient(client.id, client.name)} className="p-3 text-slate-300 hover:text-red-500 transition-colors bg-slate-50 rounded-xl">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                 </button>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-black text-slate-900 uppercase italic truncate mb-1">{client.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-8 truncate">{client.email}</p>
                <div className="space-y-3 border-t border-slate-50 pt-6">
                  <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                    <span className="text-slate-400">Statut Accès</span>
                    <span className={hasUserAccount ? 'text-emerald-500' : 'text-slate-300'}>{hasUserAccount ? 'ACTIVÉ' : 'DÉSACTIVÉ'}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                    <span className="text-slate-400">Flux Meta</span>
                    <span className="text-blue-600">{client.adAccounts?.length || 0} COMPTES</span>
                  </div>
                </div>
              </div>
              <div className="mt-10 flex gap-4">
                <button onClick={() => openLinkingModal(client)} className="flex-1 py-5 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95">LINK META</button>
                <button onClick={() => navigate(`/client/dashboard/${client.id}`)} className="px-6 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center shadow-lg active:scale-95">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {linkingClient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-2xl p-4 md:p-8">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-6xl md:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 md:p-12 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 uppercase italic tracking-tight">Configuration Miroir Meta</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ciblage Data pour {linkingClient.name}</p>
              </div>
              <button onClick={() => setLinkingClient(null)} className="p-4 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl transition-all">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row custom-scrollbar">
              <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-slate-100 p-8 md:p-12 space-y-6 bg-slate-50/30">
                <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 italic">
                  <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                  Comptes Publicitaires
                </h4>
                <div className="space-y-3">
                  {isLoadingAccounts ? (
                    <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-2xl"></div>)}</div>
                  ) : (
                    availableAccounts.map(account => (
                      <button key={account.id} onClick={() => setSelectedAccountIds(prev => prev.includes(account.id) ? prev.filter(id => id !== account.id) : [...prev, account.id])} className={`w-full p-5 rounded-2xl border-2 text-left transition-all ${selectedAccountIds.includes(account.id) ? 'border-blue-600 bg-blue-600 text-white shadow-xl shadow-blue-100' : 'border-white bg-white hover:border-blue-100 shadow-sm'}`}>
                        <p className={`text-[11px] font-black uppercase tracking-tight truncate ${selectedAccountIds.includes(account.id) ? 'text-white' : 'text-slate-900'}`}>{account.name}</p>
                        <p className={`text-[9px] font-bold tracking-widest mt-1 ${selectedAccountIds.includes(account.id) ? 'text-blue-100' : 'text-slate-400'}`}>ID: {account.id}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="w-full lg:flex-1 p-8 md:p-12 space-y-6">
                <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 italic">
                   <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                   Sélection des Campagnes
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {isLoadingCampaigns ? (
                    <div className="col-span-full space-y-3">{[1,2,3,4,5,6].map(i => <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-2xl"></div>)}</div>
                  ) : availableCampaigns.length > 0 ? (
                    availableCampaigns.map(cp => (
                      <button key={cp.id} onClick={() => setSelectedCampaignIds(prev => prev.includes(cp.id) ? prev.filter(id => id !== cp.id) : [...prev, cp.id])} className={`p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${selectedCampaignIds.includes(cp.id) ? 'border-emerald-500 bg-emerald-500 text-white shadow-xl shadow-emerald-100' : 'border-slate-50 bg-slate-50 hover:border-emerald-200 shadow-sm'}`}>
                         <div className="flex-1 pr-3">
                           <span className={`text-[10px] font-black uppercase truncate block ${selectedCampaignIds.includes(cp.id) ? 'text-white' : 'text-slate-900'}`}>{cp.name}</span>
                           <span className={`text-[8px] font-bold uppercase tracking-widest ${selectedCampaignIds.includes(cp.id) ? 'text-emerald-100' : 'text-slate-400'}`}>{cp.status}</span>
                         </div>
                         {selectedCampaignIds.includes(cp.id) && <svg className="w-6 h-6 text-white shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                      </button>
                    ))
                  ) : (
                    <div className="col-span-full py-32 text-center">
                        <div className="text-4xl mb-4">🔍</div>
                        <p className="text-[12px] font-black text-slate-300 uppercase tracking-[0.2em] italic">Sélectionnez un compte pour voir les flux</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-8 md:p-12 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-5 shrink-0 bg-white shadow-inner">
                <button onClick={() => setLinkingClient(null)} className="px-8 py-5 text-slate-400 font-black text-[12px] uppercase tracking-widest order-2 sm:order-1">ABANDONNER</button>
                <button onClick={saveLinking} disabled={isSaving} className="px-16 py-6 bg-slate-900 text-white rounded-[1.5rem] font-black text-sm uppercase shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-5 order-1 sm:order-2 active:scale-95">
                  {isSaving ? <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'VALIDER LA SYNCHRO'}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClients;
