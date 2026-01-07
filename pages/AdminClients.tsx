
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
      alert(`SUCCÈS : Le client "${newClientName}" a été créé.\n\nIdentifiants de connexion :\nEmail : ${newClientEmail}\nPassword : ${newClientPassword}`);
    } catch (err: any) {
      alert(`ERREUR CLOUD : ${err.message || "Problème de synchronisation Supabase"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (window.confirm(`Supprimer définitivement ${clientName} et ses accès login de la base de données Cloud ?`)) {
      setIsSaving(true);
      try {
        // 1. Suppression physique dans Supabase (Client + User associé via service DB)
        await DB.deleteClient(clientId);
        
        // 2. Mise à jour de l'état local uniquement après succès cloud
        setClients(prev => prev.filter(c => c.id !== clientId));
        setUsers(prev => prev.filter(u => u.clientId !== clientId));
        
        alert(`Supprimé : ${clientName} a été retiré de la plateforme et du Cloud.`);
      } catch (err: any) {
        alert(`Erreur lors de la suppression Cloud : ${err.message}`);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const openLinkingModal = async (client: Client) => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      alert("Configurez d'abord votre Token Meta dans 'Settings'.");
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
      <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Dashboard Clients</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">SaaS Cloud Sync : ONLINE</p>
          </div>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 uppercase tracking-widest flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
          Ajouter un Client
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-10 rounded-[2.5rem] border-2 border-blue-100 shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-2xl font-black text-slate-900 uppercase italic">Nouveau Compte Client</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">L'accès login sera créé automatiquement</p>
            </div>
            <button onClick={() => setIsAdding(false)} className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic">Nom Entreprise</label>
              <input 
                required 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                placeholder="Ex: Nike France" 
                value={newClientName} 
                onChange={(e) => handleNameChange(e.target.value)} 
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic">Email (Identifiant Login)</label>
              <input 
                type="email" 
                required 
                className="w-full px-6 py-4 bg-blue-50/50 border border-blue-100 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none text-blue-700" 
                placeholder="nom@ivison.com" 
                value={newClientEmail} 
                onChange={(e) => setNewClientEmail(e.target.value)} 
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic">Mot de Passe Client</label>
              <input 
                type="text" 
                required 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                value={newClientPassword} 
                onChange={(e) => setNewClientPassword(e.target.value)} 
              />
            </div>
            <div className="md:col-span-3 flex justify-end gap-4 mt-6">
              <button type="button" onClick={() => setIsAdding(false)} className="px-8 py-4 text-slate-400 font-black text-xs uppercase hover:text-slate-600">Annuler</button>
              <button type="submit" disabled={isSaving} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase shadow-2xl hover:bg-black transition-all flex items-center gap-3">
                {isSaving ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'VALIDER & CRÉER LES ACCÈS'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {clients.map(client => {
          const hasUserAccount = users.some(u => u.clientId === client.id);
          return (
            <div key={client.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-2xl transition-all p-10 group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-all z-10">
                  <button 
                    onClick={() => handleDeleteClient(client.id, client.name)} 
                    disabled={isSaving}
                    className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
              </div>
              <div className="flex items-center gap-6 mb-8">
                 <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 font-black text-3xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">{client.name.charAt(0)}</div>
                 <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">{client.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${hasUserAccount ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {hasUserAccount ? 'Login Activé' : 'Pas de compte login'}
                      </p>
                    </div>
                 </div>
              </div>
              <div className="space-y-4 pt-8 border-t border-slate-50">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Email Login</span>
                  <span className="text-[11px] font-bold text-slate-600">{client.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Assets Liés</span>
                  <span className="px-4 py-1.5 bg-blue-50 rounded-xl text-xs font-black text-blue-600">{client.adAccounts?.length || 0}</span>
                </div>
              </div>
              <div className="mt-10 flex gap-4">
                <button onClick={() => openLinkingModal(client)} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-100">Lier Meta Ads</button>
                <button onClick={() => navigate(`/client/dashboard/${client.id}`)} className="p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {linkingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xl p-6">
          <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-[90vh] border border-white/20">
            <div className="p-12 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Meta Graph Sync</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Association de comptes pour {linkingClient.name}</p>
              </div>
              <button onClick={() => setLinkingClient(null)} className="p-4 hover:bg-slate-100 rounded-3xl transition-all">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex bg-slate-50/20">
              <div className="w-1/3 border-r border-slate-100 flex flex-col p-10 overflow-hidden">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  Accounts Disponibles
                </h4>
                <div className="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar">
                  {isLoadingAccounts ? (
                    <div className="space-y-4">
                      {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-2xl"></div>)}
                    </div>
                  ) : (
                    availableAccounts.map(account => (
                      <div key={account.id} onClick={() => setSelectedAccountIds(prev => prev.includes(account.id) ? prev.filter(id => id !== account.id) : [...prev, account.id])} className={`p-5 rounded-[1.5rem] border-2 transition-all ${selectedAccountIds.includes(account.id) ? 'border-blue-600 bg-blue-50' : 'border-transparent bg-white hover:border-slate-200'}`}>
                        <p className="text-sm font-black text-slate-900 uppercase truncate">{account.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold tracking-widest mt-1">ID: {account.id}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex-1 flex flex-col p-10 overflow-hidden">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                   Campagnes Associées
                </h4>
                <div className="flex-1 overflow-y-auto space-y-3 pr-3 custom-scrollbar">
                  {isLoadingCampaigns ? (
                    <div className="space-y-4">
                      {[1,2,3,4].map(i => <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-2xl"></div>)}
                    </div>
                  ) : availableCampaigns.length > 0 ? (
                    availableCampaigns.map(cp => (
                      <div key={cp.id} onClick={() => setSelectedCampaignIds(prev => prev.includes(cp.id) ? prev.filter(id => id !== cp.id) : [...prev, cp.id])} className={`p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all flex items-center justify-between ${selectedCampaignIds.includes(cp.id) ? 'border-emerald-500 bg-emerald-50' : 'border-transparent bg-white hover:border-slate-200'}`}>
                         <div>
                            <p className="text-sm font-black text-slate-900 uppercase">{cp.name}</p>
                            <p className="text-[9px] text-slate-400 font-bold tracking-widest">{cp.status}</p>
                         </div>
                         {selectedCampaignIds.includes(cp.id) && <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 italic uppercase font-black text-xs tracking-widest">Sélectionnez un compte</div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-10 border-t border-slate-100 flex justify-end gap-4 bg-white">
                <button onClick={() => setLinkingClient(null)} className="px-8 py-4 text-slate-400 font-black text-xs uppercase hover:text-slate-600">Annuler</button>
                <button onClick={saveLinking} disabled={isSaving} className="px-14 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase shadow-2xl hover:bg-black transition-all flex items-center gap-4">
                  {isSaving ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'SAUVEGARDER LIAISON'}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClients;
