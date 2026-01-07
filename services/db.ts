
import { Client, CampaignStats, IntegrationSecret, User, AuditLog, AiReport, CreativePerformance, MarketBenchmark, PredictiveForecast } from '../types';
import { supabase } from './supabase';

class DatabaseEngine {
  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat(currency === 'EUR' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0
    }).format(amount);
  }

  async fetchAll() {
    console.log("--- Syncing from Cloud (Supabase) ---");
    try {
      const [clientsRes, campaignsRes, secretsRes, usersRes, logsRes] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('campaigns').select('*'),
        supabase.from('secrets').select('*'),
        supabase.from('users').select('*'),
        supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(50)
      ]);

      if (clientsRes.error) throw clientsRes.error;

      return {
        clients: clientsRes.data || [],
        campaigns: campaignsRes.data || [],
        secrets: secretsRes.data || [],
        users: (usersRes.data || []).map((u: any) => ({
          ...u,
          password: u.password_hash || u.password
        })),
        auditLogs: logsRes.data || [],
        aiReports: [],
        creativePerformance: [],
        marketBenchmarks: [],
        predictiveForecasts: []
      };
    } catch (error: any) {
      console.error("Supabase Connection Error:", error.message);
      return null;
    }
  }

  async addAuditLog(log: AuditLog) {
    await supabase.from('audit_logs').upsert(log, { onConflict: 'id' });
  }

  async saveSecrets(secrets: IntegrationSecret[]) {
    const { error } = await supabase.from('secrets').upsert(secrets, { onConflict: 'type' });
    if (error) throw error;
  }

  async saveClients(clients: Client[]) {
    // On s'assure que les données sont propres pour l'upsert
    const { error } = await supabase.from('clients').upsert(clients, { onConflict: 'id' });
    if (error) {
      console.error("Client Save Failed:", error.message);
      throw error;
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
    const { error } = await supabase.from('users').upsert(dbUsers, { onConflict: 'id' });
    if (error) {
      console.error("User Save Failed:", error.message);
      throw error;
    }
  }

  async saveCampaigns(campaigns: CampaignStats[]) {
    const { error } = await supabase.from('campaigns').upsert(campaigns, { onConflict: 'id' });
    if (error) {
      console.error("Campaign Save Failed:", error.message);
      throw error;
    }
  }
}

export const DB = new DatabaseEngine();
