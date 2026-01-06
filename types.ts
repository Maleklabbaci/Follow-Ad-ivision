
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
  adAccounts: string[]; // Stores adAccount IDs
  campaignIds: string[]; // Stores specific linked campaign IDs
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
}

export interface IntegrationSecret {
  type: 'FACEBOOK' | 'AI';
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
