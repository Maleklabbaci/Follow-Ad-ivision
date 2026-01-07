
import { Client, CampaignStats, IntegrationSecret, User, UserRole } from '../types';
import { supabase } from './supabase';

const STORAGE_KEY = 'adpulse_master_db';

class DatabaseEngine {
  // --- UTILS ---
  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat(currency === 'EUR' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0
    }).format(amount);
  }

  // --- CLOUD SYNC METHODS ---
  async fetchAll() {
    try {
      const [clientsRes, campaignsRes, secretsRes] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('campaigns').select('*'),
        supabase.from('secrets').select('*')
      ]);

      return {
        clients: clientsRes.data || [],
        campaigns: campaignsRes.data || [],
        secrets: secretsRes.data || []
      };
    } catch (error) {
      console.error("Cloud Sync Error:", error);
      return null;
    }
  }

  // Initialisation synchronisée avec localstorage en fallback
  getClients(): Client[] {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).clients : [];
  }

  getCampaigns(): CampaignStats[] {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).campaigns : [];
  }

  getSecrets(): IntegrationSecret[] {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).secrets : [];
  }

  // Sauvegarde Cloud + Locale
  async saveClients(clients: Client[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...this.getData(), clients }));
    await supabase.from('clients').upsert(clients);
  }

  async saveCampaigns(campaigns: CampaignStats[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...this.getData(), campaigns }));
    await supabase.from('campaigns').upsert(campaigns);
  }

  async saveSecrets(secrets: IntegrationSecret[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...this.getData(), secrets }));
    await supabase.from('secrets').upsert(secrets);
  }

  private getData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { clients: [], campaigns: [], secrets: [] };
  }

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }
}

export const DB = new DatabaseEngine();
