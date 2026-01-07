
import { Client, CampaignStats, IntegrationSecret, User, UserRole } from '../types';

/**
 * MOTEUR DE BASE DE DONNÉES VIRTUEL (VDB)
 * Simule un backend SQL/NoSQL persistant avec gestion internationale.
 */

const STORAGE_KEY = 'adpulse_master_db';

interface DBStructure {
  clients: Client[];
  campaigns: CampaignStats[];
  secrets: IntegrationSecret[];
  users: User[];
  lastUpdate: string;
}

const DEFAULT_DB: DBStructure = {
  clients: [
    { id: 'c1', name: 'Elite Fitness Pro', email: 'contact@fitness.com', createdAt: '2024-01-01', adAccounts: ['act_12345678'], campaignIds: ['cp_1', 'cp_2'] },
    { id: 'c2', name: 'Bloom Boutique', email: 'client@bloom.com', createdAt: '2024-02-15', adAccounts: ['act_87654321'], campaignIds: ['cp_3', 'cp_4'] }
  ],
  campaigns: [],
  secrets: [
    { type: 'FACEBOOK', value: '', updatedAt: '', status: 'UNTESTED' },
    { type: 'DATABASE', value: '', updatedAt: '', status: 'UNTESTED' }
  ],
  users: [
    { id: 'u1', email: 'admin@agency.com', name: 'Senior Architect', role: UserRole.ADMIN },
    { id: 'u2', email: 'client@bloom.com', name: 'Bloom Boutique', role: UserRole.CLIENT, clientId: 'c2' }
  ],
  lastUpdate: new Date().toISOString()
};

class DatabaseEngine {
  private data: DBStructure;

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    this.data = saved ? JSON.parse(saved) : DEFAULT_DB;
    this.persist();
  }

  private persist() {
    this.data.lastUpdate = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  // --- UTILS ---
  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat(currency === 'EUR' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0
    }).format(amount);
  }

  // --- CLIENTS ---
  getClients(): Client[] { return this.data.clients; }
  saveClients(clients: Client[]) {
    this.data.clients = clients;
    this.persist();
  }

  // --- CAMPAIGNS ---
  getCampaigns(): CampaignStats[] { return this.data.campaigns; }
  saveCampaigns(campaigns: CampaignStats[]) {
    this.data.campaigns = campaigns;
    this.persist();
  }

  // --- SECRETS ---
  getSecrets(): IntegrationSecret[] { return this.data.secrets; }
  saveSecrets(secrets: IntegrationSecret[]) {
    this.data.secrets = secrets;
    this.persist();
  }

  // --- USERS ---
  getUsers(): User[] { return this.data.users; }
  
  // --- UTILS ---
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }
}

export const DB = new DatabaseEngine();
