
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
    console.log("--- Syncing with Supabase Cloud ---");
    try {
      const [clientsRes, campaignsRes, secretsRes, usersRes, logsRes, aiRes, creativeRes, marketRes, forecastRes] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('campaigns').select('*'),
        supabase.from('secrets').select('*'),
        supabase.from('users').select('*'),
        supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(100),
        supabase.from('ai_reports').select('*').order('createdAt', { ascending: false }),
        supabase.from('creative_performance').select('*'),
        supabase.from('market_benchmarks').select('*'),
        supabase.from('predictive_forecasts').select('*')
      ]);

      // Vérification des erreurs pour le debugging
      if (usersRes.error) {
        console.error("Supabase User Fetch Error:", usersRes.error);
      } else {
        console.log(`Successfully loaded ${usersRes.data?.length || 0} users.`);
      }

      const mappedUsers = (usersRes.data || []).map((u: any) => ({
        ...u,
        password: u.password_hash || u.password
      }));

      return {
        clients: clientsRes.data || [],
        campaigns: campaignsRes.data || [],
        secrets: secretsRes.data || [],
        users: mappedUsers,
        auditLogs: logsRes.data || [],
        aiReports: aiRes.data || [],
        creativePerformance: creativeRes.data || [],
        marketBenchmarks: marketRes.data || [],
        predictiveForecasts: forecastRes.data || []
      };
    } catch (error) {
      console.error("Critical Cloud Sync Error:", error);
      return null;
    }
  }

  async addAuditLog(log: AuditLog) {
    await supabase.from('audit_logs').insert([log]);
  }

  async saveSecrets(secrets: IntegrationSecret[]) {
    await supabase.from('secrets').upsert(secrets);
  }

  async saveCreativeStats(stats: CreativePerformance[]) {
    await supabase.from('creative_performance').upsert(stats);
  }

  async saveClients(clients: Client[]) {
    await supabase.from('clients').upsert(clients);
  }

  async saveUsers(users: User[]) {
    const dbUsers = users.map(u => {
      const { password, ...rest } = u;
      return { ...rest, password_hash: password };
    });
    await supabase.from('users').upsert(dbUsers);
  }

  async saveCampaigns(campaigns: CampaignStats[]) {
    await supabase.from('campaigns').upsert(campaigns);
  }
}

export const DB = new DatabaseEngine();
