const BASE = '/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('server_asset_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function clearAuthToken() {
  localStorage.removeItem('server_asset_token');
}

export interface IdcRegistration {
  id: number;
  platformAccountId: number;
  platformAccount: { id: number; accountName: string; platform: { name: string } };
  region: string;
  config: string;
  serverCount: number;
  bandwidth: number;
  configCost: number;
  bandwidthCost: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IdcRegistrationDetail extends IdcRegistration {
  adjustments: { id: number; adjustmentDate: string; serverCountDelta: number; bandwidthDelta: number; note?: string | null }[];
}

export interface CreateIdcDto {
  platformAccountId: number;
  region: string;
  config: string;
  serverCount: number;
  bandwidth: number;
  configCost: number;
  bandwidthCost: number;
  notes?: string;
}

export interface UpdateIdcDto {
  serverCount?: number;
  bandwidth?: number;
  configCost?: number;
  bandwidthCost?: number;
  notes?: string;
}

export interface AddAdjustmentDto {
  adjustmentDate: string;
  serverCountDelta: number;
  bandwidthDelta: number;
  note?: string;
}

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    clearAuthToken();
    window.location.href = '/login';
    throw new Error('登录已过期，请重新登录');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err && typeof err.message === 'string') ? err.message : res.statusText || '请求失败';
    throw new Error(msg);
  }
  const text = await res.text();
  if (!text || text.trim() === '') return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  getStats: (year: number, month: number) =>
    fetchApi<{
      total: number;
      serverTotal?: number;
      idcTotal?: number;
      awsTotal?: number;
      idcRegionCosts?: { platform: string; region: string; project: string; cost: number }[];
      platformOptions?: string[];
      regionOptionsByPlatform?: Record<string, string[]>;
      totalSingle?: number;
      totalShared?: number;
      totalByProject: { name: string; amount: number }[];
      totalByPlatform: { name: string; amount: number }[];
      totalByGroup?: { name: string; amount: number }[];
      byGroupAndProject?: { groupName: string; total: number; projects: { name: string; amount: number }[] }[];
    }>(`/stats/monthly?year=${year}&month=${month}`),
  saveIdcRegionCost: (year: number, month: number, platform: string, region: string, project: string, cost: number) =>
    fetchApi<{ saved: boolean }>('/stats/idc-region-cost', {
      method: 'POST',
      body: JSON.stringify({ year, month, platform, region, project, cost }),
    }),
  deleteIdcRegionCost: (year: number, month: number, platform: string, region: string, project: string) =>
    fetchApi<{ deleted: boolean }>('/stats/idc-region-cost/delete', {
      method: 'POST',
      body: JSON.stringify({ year, month, platform, region, project }),
    }),
  getCostBreakdown: (year: number, month: number, groupIds?: number[]) =>
    fetchApi<{
      rows: { project: string; type: string; platform: string; usage: string; note: string; quantity: number; currentCost: number; lastCost: number | null; change: number | null }[];
      totalCurrent: number;
      totalLast: number;
      totalChange: number | null;
      hasManualLast: boolean;
      filterProjectNames?: string[] | null;
    }>(`/stats/cost-breakdown?year=${year}&month=${month}${groupIds?.length ? `&groupIds=${groupIds.join(',')}` : ''}`),
  saveCostSnapshot: (year: number, month: number, items: { project: string; platform: string; usage: string; quantity: number; cost: number }[]) =>
    fetchApi<unknown>('/stats/save-snapshot', { method: 'POST', body: JSON.stringify({ year, month, items }) }),
  getMultiMonthStats: (year: number, month: number, count?: number) =>
    fetchApi<{
      label: string;
      year: number;
      month: number;
      total: number;
      byProject: Record<string, number>;
      byPlatform: Record<string, number>;
      byGroup?: Record<string, number>;
    }[]>(`/stats/multi-month?year=${year}&month=${month}${count ? `&count=${count}` : ''}`),
  downloadTemplate: async () => {
    const res = await fetch('/api/servers/template', { headers: getAuthHeaders() });
    if (res.status === 401) {
      clearAuthToken();
      window.location.href = '/login';
      throw new Error('登录已过期');
    }
    if (!res.ok) throw new Error('下载失败');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'server_template.xlsx';
    a.click();
    URL.revokeObjectURL(a.href);
  },
  exportServers: async () => {
    const res = await fetch('/api/servers/export', { headers: getAuthHeaders() });
    if (res.status === 401) {
      clearAuthToken();
      window.location.href = '/login';
      throw new Error('登录已过期');
    }
    if (!res.ok) throw new Error('导出失败');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `servers_export_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
  importServers: async (file: File, options?: { overwrite?: boolean }): Promise<{ imported: number; failed: number; errors: string[] }> => {
    const fd = new FormData();
    fd.append('file', file);
    if (options?.overwrite) fd.append('overwrite', 'true');
    const res = await fetch('/api/servers/import', { method: 'POST', body: fd, headers: getAuthHeaders() });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearAuthToken();
      window.location.href = '/login';
      throw new Error('登录已过期');
    }
    if (!res.ok) throw new Error((data && typeof data.message === 'string') ? data.message : '导入失败');
    return data;
  },
  getDuplicateIps: () =>
    fetchApi<{ ip: string; count: number }[]>('/servers/duplicate-ips'),

  getServers: (params?: { project?: string; platform?: string; usage?: string; search?: string; platformAccountId?: number }) => {
    const filtered = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')) : {};
    const q = new URLSearchParams(filtered as Record<string, string>).toString();
    return fetchApi<import('./types').Server[]>(`/servers${q ? '?' + q : ''}`);
  },
  getServer: (id: number) => fetchApi<import('./types').Server>(`/servers/${id}`),
  getPassword: (id: number) => fetchApi<{ password: string }>(`/servers/${id}/password`),
  createServer: (data: import('./types').ServerFormData) =>
    fetchApi<import('./types').Server>('/servers', { method: 'POST', body: JSON.stringify(data) }),
  updateServer: (id: number, data: Partial<import('./types').ServerFormData>) =>
    fetchApi<import('./types').Server>(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  batchUpdateServers: (ids: number[], data: Partial<import('./types').ServerFormData>) =>
    fetchApi<import('./types').Server[]>('/servers/batch', { method: 'PUT', body: JSON.stringify({ ids, ...data }) }),
  deleteServer: (id: number) => fetchApi<unknown>(`/servers/${id}`, { method: 'DELETE' }),

  getTransfers: (serverId: number) =>
    fetchApi<{ id: number; fromProject: string; toProject: string; transferDate: string }[]>(`/servers/${serverId}/transfers`),
  addTransfer: (serverId: number, data: { fromProject: string; toProject: string; transferDate: string }) =>
    fetchApi<{ id: number }>(`/servers/${serverId}/transfers`, { method: 'POST', body: JSON.stringify(data) }),
  removeTransfer: (serverId: number, transferId: number) =>
    fetchApi<{ deleted: boolean }>(`/servers/${serverId}/transfers/${transferId}`, { method: 'DELETE' }),

  getGroups: () =>
    fetchApi<{ id: number; name: string; projects: { id: number; name: string; color?: string | null }[] }[]>('/groups'),
  createGroup: (name: string) => fetchApi<{ id: number; name: string }>('/groups', { method: 'POST', body: JSON.stringify({ name }) }),
  updateGroup: (id: number, name: string) => fetchApi<{ id: number; name: string }>(`/groups/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteGroup: (id: number) => fetchApi<unknown>(`/groups/${id}`, { method: 'DELETE' }),

  getProjects: () =>
    fetchApi<{ id: number; name: string; color?: string | null; group: { id: number; name: string } }[]>('/projects'),
  createProject: (groupId: number, name: string, color?: string) =>
    fetchApi<{ id: number; name: string }>('/projects', { method: 'POST', body: JSON.stringify({ groupId, name, color }) }),
  updateProject: (id: number, name: string, color?: string) =>
    fetchApi<{ id: number; name: string }>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify({ name, color }) }),
  moveProject: (id: number, groupId: number) =>
    fetchApi<{ id: number; name: string }>(`/projects/${id}/move`, { method: 'PUT', body: JSON.stringify({ groupId }) }),
  deleteProject: (id: number) => fetchApi<unknown>(`/projects/${id}`, { method: 'DELETE' }),

  getPlatforms: () => fetchApi<{ id: number; name: string; isIdcSupplier?: boolean }[]>('/platforms'),
  createPlatform: (name: string, isIdcSupplier?: boolean) =>
    fetchApi<{ id: number; name: string }>('/platforms', { method: 'POST', body: JSON.stringify({ name, isIdcSupplier }) }),
  updatePlatform: (id: number, name: string, isIdcSupplier?: boolean) =>
    fetchApi<{ id: number; name: string }>(`/platforms/${id}`, { method: 'PUT', body: JSON.stringify({ name, isIdcSupplier }) }),
  deletePlatform: (id: number) => fetchApi<unknown>(`/platforms/${id}`, { method: 'DELETE' }),

  getPlatformAccounts: (platformId?: number, idcOnly?: boolean) => {
    const params = new URLSearchParams();
    if (platformId) params.set('platformId', String(platformId));
    if (idcOnly) params.set('idcOnly', 'true');
    return fetchApi<{ id: number; platformId: number; platform: { name: string }; accountName: string; password: string; notes?: string }[]>(
      `/platform-accounts${params.toString() ? '?' + params.toString() : ''}`
    );
  },
  getPlatformAccountStats: () =>
    fetchApi<{ platformId: number; platformName: string; count: number }[]>('/platform-accounts/stats'),
  createPlatformAccount: (data: { platformId: number; accountName: string; password: string; notes?: string }) =>
    fetchApi<unknown>('/platform-accounts', { method: 'POST', body: JSON.stringify(data) }),
  getPlatformAccountPassword: (id: number) => fetchApi<{ password: string }>(`/platform-accounts/${id}/password`),

  getIdcRegistrations: () => fetchApi<IdcRegistration[]>('/idc'),
  getIdcRegistration: (id: number) => fetchApi<IdcRegistrationDetail>(`/idc/${id}`),
  createIdcRegistration: (data: CreateIdcDto) => fetchApi<IdcRegistration>('/idc', { method: 'POST', body: JSON.stringify(data) }),
  updateIdcRegistration: (id: number, data: UpdateIdcDto) => fetchApi<IdcRegistration>(`/idc/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIdcRegistration: (id: number) => fetchApi<unknown>(`/idc/${id}`, { method: 'DELETE' }),
  addIdcAdjustment: (id: number, data: AddAdjustmentDto) => fetchApi<IdcRegistrationDetail>(`/idc/${id}/adjustments`, { method: 'POST', body: JSON.stringify(data) }),
  updatePlatformAccount: (id: number, data: { accountName?: string; password?: string; notes?: string }) =>
    fetchApi<unknown>(`/platform-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlatformAccount: (id: number) => fetchApi<unknown>(`/platform-accounts/${id}`, { method: 'DELETE' }),

  getAwsAccounts: () => fetchApi<AwsAccount[]>('/aws-costs/accounts'),
  downloadAwsAccountTemplate: async () => {
    const res = await fetch('/api/aws-costs/accounts/template', { headers: getAuthHeaders() });
    if (res.status === 401) {
      clearAuthToken();
      window.location.href = '/login';
      throw new Error('登录已过期');
    }
    if (!res.ok) throw new Error('下载失败');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'aws_account_template.xlsx';
    a.click();
    URL.revokeObjectURL(a.href);
  },
  importAwsAccounts: async (file: File): Promise<{ imported: number; failed: number; errors: string[] }> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/aws-costs/accounts/import', { method: 'POST', body: fd, headers: getAuthHeaders() });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearAuthToken();
      window.location.href = '/login';
      throw new Error('登录已过期');
    }
    if (!res.ok) throw new Error((data && typeof data.message === 'string') ? data.message : '导入失败');
    return data;
  },
  getAwsAccountTotpBatch: (ids: number[]) =>
    fetchApi<Record<number, string>>(`/aws-costs/accounts/totp-batch?ids=${ids.join(',')}`),
  createAwsAccount: (data: CreateAwsAccountDto) =>
    fetchApi<AwsAccount>('/aws-costs/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAwsAccount: (id: number, data: UpdateAwsAccountDto) =>
    fetchApi<AwsAccount>(`/aws-costs/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAwsAccount: (id: number) => fetchApi<{ deleted: boolean }>(`/aws-costs/accounts/${id}`, { method: 'DELETE' }),
  getAwsAccountPassword: (id: number) => fetchApi<{ password: string }>(`/aws-costs/accounts/${id}/password`),
  getAwsAccountSecretKey: (id: number) => fetchApi<{ secretAccessKey: string }>(`/aws-costs/accounts/${id}/secret-key`),
  updateAwsCostQueryOrder: (accountIds: number[]) =>
    fetchApi<{ updated: number }>('/aws-costs/accounts/cost-query-order', { method: 'PUT', body: JSON.stringify({ accountIds }) }),

  queryAwsDailyCosts: (params: { startDate: string; endDate: string; accountIds: number[] }) =>
    fetchApi<{ results: { accountId: number; accountName: string; date: string; amount: number; saved: boolean }[] }>(
      '/aws-costs/daily/query',
      { method: 'POST', body: JSON.stringify(params) }
    ),
  queryAwsDailyCostOne: (params: { startDate: string; endDate: string; accountId: number }) =>
    fetchApi<{ results: { accountId: number; accountName: string; date: string; amount: number; saved: boolean }[] }>(
      '/aws-costs/daily/query-one',
      { method: 'POST', body: JSON.stringify(params) }
    ),
  getAwsMonthTotal: (params?: { year?: number; month?: number; accountIds?: number[] }) => {
    const search = new URLSearchParams();
    if (params?.year != null) search.set('year', String(params.year));
    if (params?.month != null) search.set('month', String(params.month));
    if (params?.accountIds?.length) search.set('accountIds', params.accountIds.join(','));
    return fetchApi<{ year: number; month: number; byAccount: { accountId: number; accountName: string; total: number }[] }>(`/aws-costs/daily/month-total${search.toString() ? '?' + search : ''}`);
  },
  getAwsDailyCosts: (params?: { accountIds?: number[]; startDate?: string; endDate?: string }) => {
    const search = new URLSearchParams();
    if (params?.accountIds?.length) search.set('accountIds', params.accountIds.join(','));
    if (params?.startDate) search.set('startDate', params.startDate);
    if (params?.endDate) search.set('endDate', params.endDate);
    return fetchApi<AwsDailyCostResponse>(`/aws-costs/daily${search.toString() ? '?' + search : ''}`);
  },

  syncAwsDailyToCost: (params?: { year?: number; month?: number; accountIds?: number[] }) =>
    fetchApi<void>('/aws-costs/daily/sync-to-cost', { method: 'POST', body: JSON.stringify(params ?? {}) }),
  getAwsDailyCostJobLogs: (params?: { page?: number; pageSize?: number }) => {
    const search = new URLSearchParams();
    if (params?.page != null) search.set('page', String(params.page));
    if (params?.pageSize != null) search.set('pageSize', String(params.pageSize));
    return fetchApi<{ items: AwsDailyCostJobLog[]; total: number; page: number; pageSize: number }>(
      `/aws-costs/daily/job-logs${search.toString() ? '?' + search : ''}`,
    );
  },
  getAwsCosts: (year?: number, month?: number, accountId?: number) => {
    const params = new URLSearchParams();
    if (year != null) params.set('year', String(year));
    if (month != null) params.set('month', String(month));
    if (accountId != null) params.set('accountId', String(accountId));
    return fetchApi<AwsCost[]>(`/aws-costs${params.toString() ? '?' + params.toString() : ''}`);
  },
  createAwsCost: (data: CreateAwsCostDto) =>
    fetchApi<AwsCost>(`/aws-costs?accountId=${data.accountId}`, { method: 'POST', body: JSON.stringify(data) }),
  updateAwsCost: (id: number, data: UpdateAwsCostDto) =>
    fetchApi<AwsCost>(`/aws-costs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAwsCost: (id: number) => fetchApi<{ deleted: boolean }>(`/aws-costs/${id}`, { method: 'DELETE' }),

  getDomains: (forceSync?: boolean) =>
    fetchApi<UnifiedDomain[]>(`/domains${forceSync ? '?forceSync=true' : ''}`),
  getDomainConfig: () => fetchApi<{ syncIntervalDays: number; lastSyncAt: string | null }>('/domains/config'),
  updateDomainConfig: (syncIntervalDays: number) =>
    fetchApi<{ syncIntervalDays: number }>('/domains/config', {
      method: 'PUT',
      body: JSON.stringify({ syncIntervalDays }),
    }),
  syncDomains: (platform?: 'all' | 'porkbun' | 'namecheap' | 'godaddy') =>
    fetchApi<{ synced: number }>(`/domains/sync${platform && platform !== 'all' ? `?platform=${platform}` : ''}`, { method: 'POST' }),
  fillMissingDomainPrices: () =>
    fetchApi<{ updated: number }>('/domains/fill-missing-prices', { method: 'POST' }),
  getDomainSummary: (params?: { provider?: string; status?: string; domain?: string }) => {
    const q = params ? new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))).toString() : '';
    return fetchApi<{
      total: number;
      inUseTotal: number;
      filteredTotal: number;
      byPlatform: { provider: string; label: string; total: number; inUse: number; autoRenew: number; expired: number; cancelled: number }[];
      autoRenewTotal: number;
      expiredTotal: number;
      cancelledTotal: number;
    }>(`/domains/summary${q ? '?' + q : ''}`);
  },
  getGoDaddyDebug: () =>
    fetchApi<{
      configured: boolean;
      status: string;
      error: string | null;
      domainCount: number;
      rawPreview: string;
      hint: string;
      apiBase: string;
    }>('/domains/godaddy-debug'),
  getNamecheapDebug: () =>
    fetchApi<{
      configured: boolean;
      status: string;
      error: string | null;
      domainCount: number;
      rawPreview: string;
      hint: string;
    }>('/domains/namecheap-debug'),
  setDomainAutoRenew: (domain: string, provider: string, enabled: boolean) =>
    fetchApi<{ success: boolean; message?: string }>('/domains/auto-renew', {
      method: 'PUT',
      body: JSON.stringify({ domain, provider, enabled }),
    }),
  updateDomain: (id: number, project?: string, usage?: string) =>
    fetchApi<UnifiedDomain>(`/domains/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ project, usage }),
    }),
  getDomainHistory: (id: number) =>
    fetchApi<{ project: string | null; usage: string | null; changedAt: string }[]>(`/domains/${id}/history`),

  // 续费提醒
  getReminders: (withinDays?: number) =>
    fetchApi<ReminderItem[]>(`/reminders${withinDays != null ? `?withinDays=${withinDays}` : ''}`),
  createCustomReminder: (data: { name: string; expireAt: string; category?: string; notes?: string; linkUrl?: string }) =>
    fetchApi<CustomReminder>('/reminders/custom', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomReminder: (id: number, data: { name?: string; expireAt?: string; category?: string; notes?: string; linkUrl?: string }) =>
    fetchApi<CustomReminder>(`/reminders/custom/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomReminder: (id: number) => fetchApi<{ id: number }>(`/reminders/custom/${id}`, { method: 'DELETE' }),
  getExcludedProviders: () => fetchApi<string[]>('/reminders/excluded-providers'),
  addExcludedProvider: (provider: string) =>
    fetchApi<{ id: number; provider: string }>('/reminders/excluded-providers', { method: 'POST', body: JSON.stringify({ provider }) }),
  removeExcludedProvider: (provider: string) =>
    fetchApi<void>(`/reminders/excluded-providers/${encodeURIComponent(provider)}`, { method: 'DELETE' }),
  getRenewalConfigs: () => fetchApi<{ id: number; provider: string; renewalType: string; dayOfMonth: number | null }[]>('/reminders/renewal-configs'),
  getPlatformsNeedingRenewalConfig: () => fetchApi<string[]>('/reminders/platforms-needing-config'),
  getDefaultRenewalConfig: () => fetchApi<{ id: number; provider: string; renewalType: string; dayOfMonth: number | null } | null>('/reminders/default-renewal-config'),
  upsertDefaultRenewalConfig: (data: { renewalType: string; dayOfMonth?: number }) =>
    fetchApi<{ id: number; provider: string; renewalType: string; dayOfMonth: number | null }>('/reminders/default-renewal-config', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  upsertRenewalConfig: (data: { provider: string; renewalType: string; dayOfMonth?: number }) =>
    fetchApi<{ id: number; provider: string; renewalType: string; dayOfMonth: number | null }>('/reminders/renewal-configs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteRenewalConfig: (provider: string) =>
    fetchApi<void>(`/reminders/renewal-configs/${encodeURIComponent(provider)}`, { method: 'DELETE' }),
  markAsRenewed: (records: { type: string; refId: number; expireAt: string }[]) =>
    fetchApi<{ count: number }>('/reminders/mark-renewed', { method: 'POST', body: JSON.stringify({ records }) }),

  // DO 费用
  getDoAccounts: () => fetchApi<DoAccount[]>('/do-costs/accounts'),
  createDoAccount: (data: { name: string; token: string; notes?: string }) =>
    fetchApi<DoAccount>('/do-costs/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateDoAccount: (id: number, data: { name?: string; token?: string; notes?: string; costQueryEnabled?: boolean; costQuerySortOrder?: number }) =>
    fetchApi<DoAccount>(`/do-costs/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDoAccount: (id: number) => fetchApi<{ deleted: boolean }>(`/do-costs/accounts/${id}`, { method: 'DELETE' }),
  updateDoCostQueryOrder: (accountIds: number[]) =>
    fetchApi<{ updated: number }>('/do-costs/accounts/cost-query-order', { method: 'PUT', body: JSON.stringify({ accountIds }) }),
  queryDoDailyCosts: (params: { startDate: string; endDate: string; accountIds: number[] }) =>
    fetchApi<unknown[]>('/do-costs/daily/query', { method: 'POST', body: JSON.stringify(params) }),
  getDoMonthTotal: (params?: { year?: number; month?: number; accountIds?: number[] }) => {
    const search = new URLSearchParams();
    if (params?.year != null) search.set('year', String(params.year));
    if (params?.month != null) search.set('month', String(params.month));
    if (params?.accountIds?.length) search.set('accountIds', params.accountIds.join(','));
    return fetchApi<{ year: number; month: number; byAccount: { accountId: number; accountName: string; total: number }[] }>(`/do-costs/daily/month-total${search.toString() ? '?' + search : ''}`);
  },
  syncDoDailyToCost: (params?: { year?: number; month?: number; accountIds?: number[] }) =>
    fetchApi<void>('/do-costs/daily/sync-to-cost', { method: 'POST', body: JSON.stringify(params ?? {}) }),
  getDoCosts: (year?: number, month?: number, accountId?: number) => {
    const params = new URLSearchParams();
    if (year != null) params.set('year', String(year));
    if (month != null) params.set('month', String(month));
    if (accountId != null) params.set('accountId', String(accountId));
    return fetchApi<DoCost[]>(`/do-costs${params.toString() ? '?' + params.toString() : ''}`);
  },
  createDoCost: (data: { year: number; month: number; accountId: number; project?: string; usage?: string; amount: number }) =>
    fetchApi<DoCost>('/do-costs', { method: 'POST', body: JSON.stringify(data) }),
  updateDoCost: (id: number, data: { project?: string; usage?: string; amount?: number }) =>
    fetchApi<DoCost>(`/do-costs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDoCost: (id: number) => fetchApi<{ deleted: boolean }>(`/do-costs/${id}`, { method: 'DELETE' }),

  // Linode 费用
  getLinodeAccounts: () => fetchApi<LinodeAccount[]>('/linode-costs/accounts'),
  createLinodeAccount: (data: { name: string; token: string; notes?: string }) =>
    fetchApi<LinodeAccount>('/linode-costs/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateLinodeAccount: (id: number, data: { name?: string; token?: string; notes?: string; costQueryEnabled?: boolean; costQuerySortOrder?: number }) =>
    fetchApi<LinodeAccount>(`/linode-costs/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLinodeAccount: (id: number) => fetchApi<{ deleted: boolean }>(`/linode-costs/accounts/${id}`, { method: 'DELETE' }),
  updateLinodeCostQueryOrder: (accountIds: number[]) =>
    fetchApi<{ updated: number }>('/linode-costs/accounts/cost-query-order', { method: 'PUT', body: JSON.stringify({ accountIds }) }),
  queryLinodeDailyCosts: (params: { startDate: string; endDate: string; accountIds: number[] }) =>
    fetchApi<unknown[]>('/linode-costs/daily/query', { method: 'POST', body: JSON.stringify(params) }),
  getLinodeMonthTotal: (params?: { year?: number; month?: number; accountIds?: number[] }) => {
    const search = new URLSearchParams();
    if (params?.year != null) search.set('year', String(params.year));
    if (params?.month != null) search.set('month', String(params.month));
    if (params?.accountIds?.length) search.set('accountIds', params.accountIds.join(','));
    return fetchApi<{ year: number; month: number; byAccount: { accountId: number; accountName: string; total: number }[] }>(`/linode-costs/daily/month-total${search.toString() ? '?' + search : ''}`);
  },
  syncLinodeDailyToCost: (params?: { year?: number; month?: number; accountIds?: number[] }) =>
    fetchApi<void>('/linode-costs/daily/sync-to-cost', { method: 'POST', body: JSON.stringify(params ?? {}) }),
  getLinodeCosts: (year?: number, month?: number, accountId?: number) => {
    const params = new URLSearchParams();
    if (year != null) params.set('year', String(year));
    if (month != null) params.set('month', String(month));
    if (accountId != null) params.set('accountId', String(accountId));
    return fetchApi<LinodeCost[]>(`/linode-costs${params.toString() ? '?' + params.toString() : ''}`);
  },
  createLinodeCost: (data: { year: number; month: number; accountId: number; project?: string; usage?: string; amount: number }) =>
    fetchApi<LinodeCost>('/linode-costs', { method: 'POST', body: JSON.stringify(data) }),
  updateLinodeCost: (id: number, data: { project?: string; usage?: string; amount?: number }) =>
    fetchApi<LinodeCost>(`/linode-costs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLinodeCost: (id: number) => fetchApi<{ deleted: boolean }>(`/linode-costs/${id}`, { method: 'DELETE' }),
};

export type ReminderUrgency = 'safe' | 'warning' | 'urgent' | 'critical' | 'expired';

export interface ReminderItem {
  id: string;
  type: 'server' | 'domain' | 'custom';
  name: string;
  expireAt: string;
  daysLeft: number;
  urgency: ReminderUrgency;
  extra?: {
    serverId?: number;
    domainId?: number;
    platform?: string;
    provider?: string;
    project?: string;
    category?: string;
    linkUrl?: string;
    notes?: string;
  };
}

export interface CustomReminder {
  id: number;
  name: string;
  expireAt: string;
  category?: string | null;
  notes?: string | null;
  linkUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UnifiedDomain {
  id: number;
  domain: string;
  provider: 'porkbun' | 'namecheap' | 'godaddy';
  createDate: string;
  expireDate: string;
  autoRenew: boolean;
  isExpired: boolean;
  status?: string;
  renewalPrice?: string;
  project?: string;
  usage?: string;
}

export interface AwsAccount {
  id: number;
  name: string;
  awsAccountId?: string | null;
  loginAccount?: string | null;
  password?: string | null;
  supplier?: string | null;
  loginMethod?: string | null;
  accountType?: string | null;
  accessKeyId?: string | null;
  secretAccessKey?: string | null;
  proxy?: string | null;
  mfa?: string | null;
  notes?: string | null;
  costQueryStatus?: string | null;
  costQueryEnabled?: boolean;
  costQuerySortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAwsAccountDto {
  name: string;
  awsAccountId?: string;
  loginAccount?: string;
  password?: string;
  supplier?: string;
  loginMethod?: string;
  accountType?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  proxy?: string;
  mfa?: string;
  notes?: string;
}

export interface UpdateAwsAccountDto {
  name?: string;
  awsAccountId?: string;
  loginAccount?: string;
  password?: string;
  supplier?: string;
  loginMethod?: string;
  accountType?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  proxy?: string;
  mfa?: string;
  notes?: string;
  costQueryStatus?: string;
  costQueryEnabled?: boolean;
  costQuerySortOrder?: number;
}

export interface AwsCost {
  id: number;
  accountId: number;
  account: { id: number; name: string };
  year: number;
  month: number;
  project: string;
  usage: string | null;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAwsCostDto {
  year: number;
  month: number;
  accountId: number;
  project: string;
  usage?: string;
  amount: number;
}

export interface UpdateAwsCostDto {
  project?: string;
  usage?: string;
  amount?: number;
}

/** 每日费用按账号一行：每行一个账号，列为查询日期范围内的各天 */
export interface AwsDailyCostResponse {
  dates: string[];
  rows: {
    accountId: number;
    accountName: string;
    byDate: Record<string, { amount: number; changePct: number | null }>;
  }[];
}

/** 每日费用定时任务执行记录 */
export interface DoAccount {
  id: number;
  name: string;
  token?: string | null;
  notes?: string | null;
  costQueryEnabled?: boolean;
  costQuerySortOrder?: number;
  createdAt?: string;
}

export interface DoCost {
  id: number;
  accountId: number;
  account: { id: number; name: string };
  year: number;
  month: number;
  project: string;
  usage: string | null;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LinodeAccount {
  id: number;
  name: string;
  token?: string | null;
  notes?: string | null;
  costQueryEnabled?: boolean;
  costQuerySortOrder?: number;
  createdAt?: string;
}

export interface LinodeCost {
  id: number;
  accountId: number;
  account: { id: number; name: string };
  year: number;
  month: number;
  project: string;
  usage: string | null;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AwsDailyCostJobLog {
  id: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  queryDate: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  syncCostOk: boolean;
}
