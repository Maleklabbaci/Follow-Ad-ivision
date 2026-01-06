
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
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  roas: number;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  lastSync?: string;
  dataSource: 'MOCK' | 'REAL_API';
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
}
