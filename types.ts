
export enum UserRole {
  ADMIN = 'ADMIN',
  CLIENT = 'CLIENT'
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  clientId?: string;
  name: string;
  password?: string;
  password_hash?: string; // Ajouté pour compatibilité DB directe
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  ipAddress: string;
}

export interface AiReport {
  id: string;
  clientId: string;
  clientName: string;
  content: string;
  model: string;
  createdAt: string;
}

export interface CreativePerformance {
  id: string;
  name: string;
  type: 'VIDEO' | 'IMAGE' | 'CAROUSEL';
  spend: number;
  conversions: number;
  hook_rate: number; // % de gens qui regardent les 3 premières secondes
  hold_rate: number; // % de gens qui regardent 50%+
  roas: number;
}

export interface MarketBenchmark {
  id: string;
  industry: string;
  avg_cpc: number;
  avg_cpm: number;
  avg_ctr: number;
  region: string;
}

export interface PredictiveForecast {
  id: string;
  clientId: string;
  predicted_spend: number;
  predicted_conversions: number;
  confidence_score: number;
  month: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  adAccounts: string[]; 
  campaignIds: string[]; 
}

export interface CampaignStats {
  id: string;
  campaignId: string;
  name: string;
  date: string;
  spend: number;
  currency: string; 
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  lastSync?: string;
  dataSource: 'MOCK' | 'REAL_API';
  isValidated?: boolean;
  // Fix: Added auditLogs to fix type error in AdminCampaigns.tsx
  auditLogs?: string[];
}

export interface IntegrationSecret {
  type: 'FACEBOOK' | 'DATABASE' | 'AI';
  value: string;
  updatedAt: string;
  status: 'VALID' | 'INVALID' | 'UNTESTED';
}

export interface AdAccount {
  id: string;
  name: string;
  currency: string;
}

export interface FacebookCampaign {
  id: string;
  name: string;
  status: string;
  account_id: string;
}