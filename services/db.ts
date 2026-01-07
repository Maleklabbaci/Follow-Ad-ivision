
import { Client, CampaignStats, IntegrationSecret, User, AuditLog, AiReport } from '../types';
import { supabase } from './supabase';

const STORAGE_KEY = 'adpulse_master_db';

class DatabaseEngine {
  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat(currency === 'EUR' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0
    }).format(amount);
  }

  async fetchAll() {
    try {
      const [clientsRes, campaignsRes, secretsRes, usersRes, logsRes, aiRes] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('campaigns').select('*'),
        supabase.from('secrets').select('*'),
        supabase.from('users').select('*'),
        supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(100),
        supabase.from('ai_reports').select('*').order('createdAt', { ascending: false })
      ]);

      return {
        clients: clientsRes.data || [],
        campaigns: campaignsRes.data || [],
        secrets: secretsRes.data || [],
        users: usersRes.data || [],
        auditLogs: logsRes.data || [],
        aiReports: aiRes.data || []
      };
    } catch (error) {
      console.error("Cloud Sync Error:", error);
      return null;
    }
  }

  getData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { clients: [], campaigns: [], secrets: [], users: [], auditLogs: [], aiReports: [] };
  }

  async saveClients(clients: Client[]) {
    await supabase.from('clients').upsert(clients);
  }

  async saveCampaigns(campaigns: CampaignStats[]) {
    await supabase.from('campaigns').upsert(campaigns);
  }

  async saveSecrets(secrets: IntegrationSecret[]) {
    await supabase.from('secrets').upsert(secrets);
  }

  async saveUsers(users: User[]) {
    await supabase.from('users').upsert(users);
  }

  async addAuditLog(log: AuditLog) {
    await supabase.from('audit_logs').insert([log]);
  }

  async addAiReport(report: AiReport) {
    await supabase.from('ai_reports').insert([report]);
  }

  reset() {
    localStorage.clear();
    window.location.reload();
  }
}

export const DB = new DatabaseEngine();
