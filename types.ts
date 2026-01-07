
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
  auditLogs?: string[];
}

export interface IntegrationSecret {
  type: 'FACEBOOK' | 'DATABASE' | 'AI';
  value: string;
  updatedAt: string;
  status: 'VALID' | 'INVALID' | 'UNTESTED';
  lastTested?: string;
}

export interface AppState {
  user: User | null;
  clients: Client[];
  secrets: IntegrationSecret[];
  campaigns: CampaignStats[];
  users: User[];
  auditLogs: AuditLog[];
  aiReports: AiReport[];
}
