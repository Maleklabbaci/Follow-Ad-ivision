
import { Client, CampaignStats, IntegrationSecret, User, AuditLog, AiReport } from '../types';
import { supabase } from './supabase';

class DatabaseEngine {
  private LOCAL_STORAGE_KEY = 'adpulse_local_db';

  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat(currency === 'EUR' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0
    }).format(amount);
  }

  private getLocalData() {
    const saved = localStorage.getItem(this.LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  }

  private saveLocalData(data: any) {
    localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(data));
  }

  async fetchAll() {
    console.log("--- Syncing from Cloud (Supabase) ---");
    
    // Initial data structure
    let data = {
      clients: [] as Client[],
      campaigns: [] as CampaignStats[],
      secrets: [] as IntegrationSecret[],
      users: [] as User[],
      auditLogs: [] as AuditLog[],
      aiReports: [] as AiReport[]
    };

    try {
      const [clientsRes, campaignsRes, secretsRes, usersRes, logsRes] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('campaigns').select('*'),
        supabase.from('secrets').select('*'),
        supabase.from('users').select('*'),
        supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(50)
      ]);

      if (clientsRes.error) throw clientsRes.error;

      data = {
        clients: clientsRes.data || [],
        campaigns: campaignsRes.data || [],
        secrets: secretsRes.data || [],
        users: (usersRes.data || []).map((u: any) => ({
          ...u,
          password: u.password_hash || u.password
        })),
        auditLogs: logsRes.data || [],
        aiReports: []
      };

      // Update cache on successful fetch
      this.saveLocalData(data);
      console.log("--- Cloud Sync Success ---");
      return data;
    } catch (error: any) {
      console.error("Supabase Connection Error (Falling back to local):", error.message);
      
      // Fallback to local storage if network fails
      const cached = this.getLocalData();
      if (cached) {
        console.log("--- Using Cached Local Data ---");
        return cached;
      }
      
      // If no cache, return empty but valid structure
      return data;
    }
  }

  async addAuditLog(log: AuditLog) {
    try {
      await supabase.from('audit_logs').upsert(log, { onConflict: 'id' });
    } catch (e) {
      console.warn("Audit log not synced to cloud");
    }
  }

  async saveSecrets(secrets: IntegrationSecret[]) {
    try {
      const { error } = await supabase.from('secrets').upsert(secrets, { onConflict: 'type' });
      if (error) throw error;
    } finally {
      const current = this.getLocalData() || {};
      this.saveLocalData({ ...current, secrets });
    }
  }

  async saveClients(clients: Client[]) {
    try {
      const { error } = await supabase.from('clients').upsert(clients, { onConflict: 'id' });
      if (error) throw error;
    } finally {
      const current = this.getLocalData() || {};
      this.saveLocalData({ ...current, clients });
    }
  }

  async deleteClient(clientId: string) {
    try {
      await supabase.from('users').delete().eq('clientId', clientId);
      await supabase.from('clients').delete().eq('id', clientId);
    } finally {
      const current = this.getLocalData();
      if (current) {
        const updatedClients = (current.clients || []).filter((c: any) => c.id !== clientId);
        const updatedUsers = (current.users || []).filter((u: any) => u.clientId !== clientId);
        this.saveLocalData({ ...current, clients: updatedClients, users: updatedUsers });
      }
    }
  }

  async saveUsers(users: User[]) {
    const dbUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      clientId: u.clientId || null,
      password_hash: u.password || u.password_hash
    }));
    try {
      const { error } = await supabase.from('users').upsert(dbUsers, { onConflict: 'id' });
      if (error) throw error;
    } finally {
      const current = this.getLocalData() || {};
      this.saveLocalData({ ...current, users });
    }
  }

  async saveCampaigns(campaigns: CampaignStats[]) {
    try {
      const { error } = await supabase.from('campaigns').upsert(campaigns, { onConflict: 'id' });
      if (error) throw error;
    } finally {
      const current = this.getLocalData() || {};
      this.saveLocalData({ ...current, campaigns });
    }
  }
}

export const DB = new DatabaseEngine();
