export interface Server {
  id: number;
  platform: string;
  platformAccountId?: number;
  platformAccount?: { id: number; accountName: string; platform?: { name: string } };
  hostname: string;
  ip: string;
  password: string;
  project: string;
  status: string;
  config?: string;
  region?: string;
  bandwidthType?: string;
  serverType?: string;
  manager?: string;
  usage?: string;
  createdAt: string;
  cancelAt?: string;
  monthlyCost: number;
  notes?: string;
}

export interface ServerFormData {
  platform: string;
  platformAccountId?: number;
  hostname: string;
  ip: string;
  password: string;
  project: string;
  status: string;
  config?: string;
  region?: string;
  bandwidthType?: string;
  serverType?: string;
  manager?: string;
  usage?: string;
  createdAt?: string;
  cancelAt?: string;
  monthlyCost: number;
  notes?: string;
}

export interface MonthlyStats {
  year: number;
  month: number;
  total: number;
  totalByProject: { name: string; amount: number }[];
  totalByPlatform: { name: string; amount: number }[];
  totalByGroup?: { name: string; amount: number }[];
  byGroupAndProject?: { groupName: string; total: number; projects: { name: string; amount: number }[] }[];
}
