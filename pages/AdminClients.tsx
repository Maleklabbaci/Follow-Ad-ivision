
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

  // Fonction pour mettre à jour le nom et suggérer l'email
  const handleNameChange = (val: string) => {
    setNewClientName(val);
    if (val.trim()) {
      // Nettoyage du nom pour l'email (minuscule, sans espaces ni caractères spéciaux simples)
      const emailPrefix = val.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlever les accents
        .replace(/[^a-z0-9]/g, ''); // Garder seulement lettres et chiffres
      setNewClientEmail(`${emailPrefix}@ivison.com`);
      
      // Suggestion de mot de passe par défaut si vide
      if (!newClientPassword) {
        setNewClientPassword(`${emailPrefix}2024!`);
      }
    } else {
      setNewClientEmail('');
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
      password: newClientPassword || 'client123'
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
      alert("Succès : Les données sont enregistrées dans votre base Supabase !");
    } catch (err: any) {
      console.error("Save error:", err);
      alert(`ERREUR DE SAUVEGARDE : ${err.message || JSON.stringify(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (window.confirm(`Voulez-vous supprimer définitivement ${clientName} de la base de données Cloud ?`)) {
      try {
        const updatedClients = clients.filter(c => c.id !== clientId);
        const updatedUsers = users.filter(u => u.clientId !== clientId);
        
        await DB.saveClients(updatedClients);
        await DB.saveUsers(updatedUsers);
        
        setClients(updatedClients);
        setUsers(updatedUsers);
      } catch (err: any) {
        alert(`Erreur de suppression : ${err.message}`);
      }
    }
  };

  const openLinkingModal = async (client: Client) => {
    const fbSecret = secrets.find(s => s.type === 'FACEBOOK');
    if (!fbSecret || fbSecret.status !== 'VALID') {
      alert("Erreur : Aucun Token Facebook valide n'est configuré dans les Paramètres.");
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
      if (data.error) throw new Error(data.error.message);
      setAvailableAccounts(data.data || []);
    } catch (err: any) {
      alert(`Erreur API Meta : ${err.message}`);
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
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingCampaigns(false);
    }
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
      alert("Liaison sauvegardée dans Supabase !");
      setLinkingClient(null);
    } catch (err: any) {
      alert(`Erreur de liaison : ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Portfolio Clients</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">Connexion Supabase : Etablie</p>
          </div>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 uppercase tracking-widest"
        >
          Nouveau Client SaaS
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-10 rounded-[2.5rem] border-2 border-blue-100 shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-2xl font-black text-slate-900 uppercase italic">Création de Compte Cloud</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Génération automatique des accès activée</p>
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic">Email Client (Automatique)</label>
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic">Mot de passe</label>
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
                {isSaving ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'VALIDER & ENREGISTRER CLOUD'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {clients.map(client => (
          <div key={client.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-2xl transition-all p-10 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => handleDeleteClient(client.id, client.name)} className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div className="flex items-center gap-6 mb-8">
               <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 font-black text-3xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">{client.name.charAt(0)}</div>
               <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">{client.name}</h3>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{client.email}</p>
               </div>
            </div>
            <div className="space-y-4 pt-8 border-t border-slate-50">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accounts Liés</span>
                <span className="px-4 py-1.5 bg-blue-50 rounded-xl text-xs font-black text-blue-600">{client.adAccounts?.length || 0}</span>
              </div>
            </div>
            <div className="mt-10 flex gap-4">
              <button onClick={() => openLinkingModal(client)} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-100">Audit Assets</button>
              <button onClick={() => navigate(`/client/dashboard/${client.id}`)} className="p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {linkingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xl p-6">
          <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col h-[90vh] border border-white/20">
            <div className="p-12 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Configuration Meta Graph</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Association de comptes publicitaires pour {linkingClient.name}</p>
              </div>
              <button onClick={() => setLinkingClient(null)} className="p-4 hover:bg-slate-100 rounded-3xl transition-all">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex bg-slate-50/20">
              <div className="w-1/3 border-r border-slate-100 flex flex-col p-10 overflow-hidden">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  Comptes Publicitaires
                </h4>
                <div className="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar">
                  {isLoadingAccounts ? (
                    <div className="space-y-4">
                      {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-2xl"></div>)}
                    </div>
                  ) : (
                    availableAccounts.map(account => (
                      <div key={account.id} onClick={() => setSelectedAccountIds(prev => prev.includes(account.id) ? prev.filter(id => id !== account.id) : [...prev, account.id])} className={`p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all ${selectedAccountIds.includes(account.id) ? 'border-blue-600 bg-blue-50 shadow-xl shadow-blue-50' : 'border-transparent bg-white hover:border-slate-200'}`}>
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
                   Campagnes Identifiées
                </h4>
                <div className="flex-1 overflow-y-auto space-y-3 pr-3 custom-scrollbar">
                  {isLoadingCampaigns ? (
                    <div className="space-y-4">
                      {[1,2,3,4].map(i => <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-2xl"></div>)}
                    </div>
                  ) : availableCampaigns.length > 0 ? (
                    availableCampaigns.map(cp => (
                      <div key={cp.id} onClick={() => setSelectedCampaignIds(prev => prev.includes(cp.id) ? prev.filter(id => id !== cp.id) : [...prev, cp.id])} className={`p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all flex items-center justify-between ${selectedCampaignIds.includes(cp.id) ? 'border-emerald-500 bg-emerald-50 shadow-xl shadow-emerald-50' : 'border-transparent bg-white hover:border-slate-200'}`}>
                         <div>
                            <p className="text-sm font-black text-slate-900 uppercase">{cp.name}</p>
                            <p className="text-[9px] text-slate-400 font-bold tracking-widest">{cp.status} • {cp.id}</p>
                         </div>
                         {selectedCampaignIds.includes(cp.id) && <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 italic uppercase font-black text-xs tracking-widest">Sélectionnez un compte pour voir les campagnes</div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-10 border-t border-slate-100 flex justify-between items-center bg-white">
                <div className="flex gap-10">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accounts</span>
                      <span className="text-2xl font-black text-blue-600">{selectedAccountIds.length}</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Campagnes</span>
                      <span className="text-2xl font-black text-emerald-500">{selectedCampaignIds.length}</span>
                   </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setLinkingClient(null)} className="px-8 py-4 text-slate-400 font-black text-xs uppercase hover:text-slate-600">Annuler</button>
                  <button onClick={saveLinking} disabled={isSaving} className="px-14 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase shadow-2xl hover:bg-black transition-all flex items-center gap-4">
                    {isSaving ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'SYNC CLOUD & SAVE'}
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
