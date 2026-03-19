import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Globe, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Settings, Pencil } from 'lucide-react';
import { api, type UnifiedDomain } from '../api';
import { useToast } from '../components/Toast';

const PAGE_SIZES = [20, 50, 100, 200, 500, 1000];
type SortKey = keyof UnifiedDomain;

export default function DomainManager() {
  const [domains, setDomains] = useState<UnifiedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filterProvider, setFilterProvider] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDomain, setFilterDomain] = useState('');
  const [config, setConfig] = useState<{ syncIntervalDays: number; lastSyncAt: string | null } | null>(null);
  const [configModal, setConfigModal] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [syncIntervalInput, setSyncIntervalInput] = useState(7);
  const [syncing, setSyncing] = useState(false);
  const [syncPlatform, setSyncPlatform] = useState<'all' | 'porkbun' | 'namecheap' | 'godaddy'>('all');
  const [syncProgress, setSyncProgress] = useState('');
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [editDomain, setEditDomain] = useState<UnifiedDomain | null>(null);
  const [editProject, setEditProject] = useState('');
  const [editUsage, setEditUsage] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [domainHistory, setDomainHistory] = useState<{ project: string | null; usage: string | null; changedAt: string }[]>([]);
  const [namecheapDebug, setNamecheapDebug] = useState<{
    configured: boolean;
    status: string;
    error: string | null;
    domainCount: number;
    rawPreview: string;
    hint: string;
  } | null>(null);
  const [godaddyDebug, setGodaddyDebug] = useState<{
    configured: boolean;
    status: string;
    error: string | null;
    domainCount: number;
    rawPreview: string;
    hint: string;
    apiBase: string;
  } | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    inUseTotal: number;
    filteredTotal: number;
    byPlatform: { provider: string; label: string; total: number; inUse: number; autoRenew: number; expired: number; cancelled: number }[];
    autoRenewTotal: number;
    expiredTotal: number;
    cancelledTotal: number;
  } | null>(null);

  const toast = useToast();

  const load = (forceSync = false) => {
    setLoading(true);
    setError(null);
    api
      .getDomains(forceSync)
      .then((d) => {
        setDomains(d);
        loadSummary();
      })
      .catch((e) => {
        setError(e.message);
        setDomains([]);
      })
      .finally(() => setLoading(false));
  };

  const loadConfig = () => {
    api.getDomainConfig().then((c) => {
      setConfig(c);
      setSyncIntervalInput(c.syncIntervalDays);
    }).catch(() => {});
  };

  const loadSummary = () => {
    const params: { provider?: string; status?: string; domain?: string } = {};
    if (filterProvider) params.provider = filterProvider;
    if (filterStatus) params.status = filterStatus;
    if (filterDomain.trim()) params.domain = filterDomain.trim();
    api.getDomainSummary(Object.keys(params).length ? params : undefined).then(setSummary).catch(() => setSummary(null));
  };

  useEffect(() => {
    load();
    loadConfig();
    api.getProjects().then((p) => setProjects(p.map((x) => ({ id: x.id, name: x.name })))).catch(() => {});
  }, []);

  useEffect(() => {
    loadSummary();
  }, [filterProvider, filterStatus, filterDomain]);

  const openEdit = (d: UnifiedDomain) => {
    setEditDomain(d);
    setEditProject(d.project ?? '');
    setEditUsage(d.usage ?? '');
    api.getDomainHistory(d.id).then(setDomainHistory).catch(() => setDomainHistory([]));
  };

  const handleSaveEdit = async () => {
    if (!editDomain) return;
    setEditSaving(true);
    try {
      const updated = await api.updateDomain(editDomain.id, editProject || undefined, editUsage || undefined);
      setDomains((prev) => prev.map((d) => (d.id === editDomain.id ? updated : d)));
      setEditDomain(null);
      toast.success('已保存');
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setEditSaving(false);
    }
  };

  const filteredDomains = useMemo(() => {
    let list = domains;
    if (filterProvider) list = list.filter((d) => d.provider === filterProvider);
    if (filterStatus === 'expired') list = list.filter((d) => d.isExpired);
    if (filterStatus === 'normal') list = list.filter((d) => !d.isExpired);
    if (filterDomain.trim()) {
      const q = filterDomain.trim().toLowerCase();
      list = list.filter((d) => d.domain.toLowerCase().includes(q));
    }
    return list;
  }, [domains, filterProvider, filterStatus, filterDomain]);

  const sortedDomains = useMemo(() => {
    const list = [...filteredDomains];
    if (sortBy) {
      list.sort((a, b) => {
        const av = a[sortBy];
        const bv = b[sortBy];
        let cmp: number;
        if (typeof av === 'string' && typeof bv === 'string') {
          cmp = av.localeCompare(bv, 'zh-CN');
        } else if (typeof av === 'boolean' && typeof bv === 'boolean') {
          cmp = (av ? 1 : 0) - (bv ? 1 : 0);
        } else {
          cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'zh-CN');
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    } else {
      list.sort((a, b) => {
        if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
        return (a.expireDate || '').localeCompare(b.expireDate || '', 'zh-CN');
      });
    }
    return list;
  }, [filteredDomains, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedDomains.length / pageSize));
  const paginatedDomains = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedDomains.slice(start, start + pageSize);
  }, [sortedDomains, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, filterProvider, filterStatus, filterDomain]);

  const toggleSort = (col: SortKey) => {
    if (sortBy === col) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortBy !== col) return null;
    return sortOrder === 'asc' ? <ChevronUp size={12} className="inline ml-0.5" /> : <ChevronDown size={12} className="inline ml-0.5" />;
  };

  const providerLabel = (p: string) => (p === 'porkbun' ? 'Porkbun' : p === 'namecheap' ? 'Namecheap' : p === 'godaddy' ? 'GoDaddy' : p);

  const handleSync = async () => {
    setSyncing(true);
    setSyncProgress('正在连接...');
    let totalSynced = 0;
    try {
      if (syncPlatform === 'all') {
        setSyncProgress('正在获取 Porkbun 域名...');
        const r1 = await api.syncDomains('porkbun');
        totalSynced += r1.synced;
        setSyncProgress(`Porkbun 完成 (${r1.synced} 个)，正在获取 Namecheap 域名...`);
        const r2 = await api.syncDomains('namecheap');
        totalSynced += r2.synced;
        setSyncProgress(`Namecheap 完成 (${r2.synced} 个)，正在获取 GoDaddy 域名...`);
        const r3 = await api.syncDomains('godaddy');
        totalSynced += r3.synced;
      } else {
        const labels: Record<string, string> = { porkbun: 'Porkbun', namecheap: 'Namecheap', godaddy: 'GoDaddy' };
        setSyncProgress(`正在获取 ${labels[syncPlatform] || syncPlatform} 域名...`);
        const r = await api.syncDomains(syncPlatform);
        totalSynced = r.synced;
      }
      setSyncProgress('正在保存到数据库...');
      toast.success(`已同步 ${totalSynced} 个域名`);
      load();
      loadConfig();
      loadSummary();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
      setSyncProgress('');
    }
  };

  const handleSaveConfig = () => {
    const days = Math.max(1, Math.min(365, syncIntervalInput));
    setConfigSaving(true);
    api
      .updateDomainConfig(days)
      .then(() => {
        toast.success('同步间隔已保存');
        setConfigModal(false);
        loadConfig();
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setConfigSaving(false));
  };

  const handleAutoRenew = async (d: UnifiedDomain, enabled: boolean) => {
    if (d.provider !== 'porkbun') {
      toast.error('仅 Porkbun 支持在此设置自动续费，Namecheap 请前往控制台');
      return;
    }
    try {
      const res = await api.setDomainAutoRenew(d.domain, d.provider, enabled);
      if (res.success) {
        toast.success(enabled ? '已开启自动续费' : '已关闭自动续费');
        setDomains((prev) => prev.map((x) => (x.id === d.id ? { ...x, autoRenew: enabled } : x)));
      } else {
        toast.error(res.message || '操作失败');
      }
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Globe size={24} className="text-indigo-500" />
            域名管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            数据已保存至数据库，按设定间隔自动同步
            {config?.lastSyncAt && ` · 上次同步: ${new Date(config.lastSyncAt).toLocaleString('zh-CN')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={syncPlatform}
            onChange={(e) => setSyncPlatform(e.target.value as 'all' | 'porkbun' | 'namecheap' | 'godaddy')}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500"
            disabled={syncing}
          >
            <option value="all">全部平台</option>
            <option value="porkbun">仅 Porkbun</option>
            <option value="namecheap">仅 Namecheap</option>
            <option value="godaddy">仅 GoDaddy</option>
          </select>
          <button
            onClick={async () => {
              try {
                const d = await api.getGoDaddyDebug();
                setGodaddyDebug(d);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
          >
            GoDaddy 诊断
          </button>
          <button
            onClick={async () => {
              try {
                const d = await api.getNamecheapDebug();
                setNamecheapDebug(d);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
          >
            Namecheap 诊断
          </button>
          <button
            onClick={() => setConfigModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
          >
            <Settings size={16} />
            同步设置
          </button>
          <button
            onClick={async () => {
              try {
                const r = await api.fillMissingDomainPrices();
                toast.success(`已为 ${r.updated} 个域名填充参考价格`);
                load();
                loadSummary();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
          >
            填充缺失价格
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            立即同步
          </button>
        </div>
      </div>

      {/* 统计摘要 - 单行平铺 */}
      {summary && (
        <div className="mb-4 flex flex-nowrap gap-3 overflow-x-auto pb-1">
          <div className="flex-1 min-w-[7rem] rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500 uppercase">总数</p>
            <p className="mt-1 text-xl text-slate-600">{summary.total}</p>
            {summary.filteredTotal !== summary.total && (
              <p className="text-sm text-slate-500 mt-0.5">筛选 {summary.filteredTotal}</p>
            )}
          </div>
          <div className="flex-1 min-w-[7rem] rounded-xl border-2 border-indigo-300 bg-indigo-50 px-4 py-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500 uppercase">正在使用</p>
            <p className="mt-1 text-2xl font-bold text-indigo-700">{summary.inUseTotal}</p>
          </div>
          <div className="flex-1 min-w-[7rem] rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500 uppercase">自动续费</p>
            <p className="mt-1 text-xl font-semibold text-emerald-600">{summary.autoRenewTotal}</p>
          </div>
          <div className="flex-1 min-w-[7rem] rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500 uppercase">已过期</p>
            <p className="mt-1 text-xl font-semibold text-red-600">{summary.expiredTotal}</p>
          </div>
          <div className="flex-1 min-w-[7rem] rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm font-medium text-slate-500 uppercase">已取消</p>
            <p className="mt-1 text-xl font-semibold text-amber-600">{summary.cancelledTotal}</p>
          </div>
          {summary.byPlatform.filter((p) => p.total > 0).map((p) => (
            <div key={p.provider} className="flex-1 min-w-[7rem] rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500 uppercase">{p.label}</p>
              <p className="mt-1 text-xl font-semibold text-slate-800">{p.total}</p>
              <p className="text-sm text-slate-500 mt-0.5">在用 {p.inUse} · 续费 {p.autoRenew} · 过期 {p.expired}</p>
            </div>
          ))}
        </div>
      )}

      {/* 筛选 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="搜索域名..."
          value={filterDomain}
          onChange={(e) => setFilterDomain(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm w-48 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <select
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">全部注册商</option>
          <option value="porkbun">Porkbun</option>
          <option value="namecheap">Namecheap</option>
          <option value="godaddy">GoDaddy</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">全部状态</option>
          <option value="normal">正常</option>
          <option value="expired">已过期</option>
        </select>
        <span className="text-sm text-slate-500 ml-2">
          共 {sortedDomains.length} 条
        </span>
      </div>

      {syncing && syncProgress && (
        <div className="mb-4 p-4 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin shrink-0" />
          <span className="text-indigo-800 text-sm font-medium">{syncProgress}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          {error}
        </div>
      )}

      {loading && domains.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">正在加载域名，首次可能需 10-30 秒...</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-64">
                      <button type="button" onClick={() => toggleSort('domain')} className="flex items-center hover:text-slate-700">
                        域名 <SortIcon col="domain" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                      <button type="button" onClick={() => toggleSort('provider')} className="flex items-center hover:text-slate-700">
                        注册商 <SortIcon col="provider" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                      <button type="button" onClick={() => toggleSort('createDate')} className="flex items-center hover:text-slate-700">
                        购买时间 <SortIcon col="createDate" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                      <button type="button" onClick={() => toggleSort('expireDate')} className="flex items-center hover:text-slate-700">
                        到期日 <SortIcon col="expireDate" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-24">价格</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                      <button type="button" onClick={() => toggleSort('autoRenew')} className="flex items-center hover:text-slate-700">
                        自动续费 <SortIcon col="autoRenew" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                      <button type="button" onClick={() => toggleSort('isExpired')} className="flex items-center hover:text-slate-700">
                        状态 <SortIcon col="isExpired" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">项目组</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">用途</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-20">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDomains.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                        {domains.length === 0
                          ? '暂无域名数据，请点击「立即同步」从 API 拉取'
                          : '无匹配结果'}
                      </td>
                    </tr>
                  ) : (
                    paginatedDomains.map((d) => (
                      <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-800 font-mono">{d.domain}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{providerLabel(d.provider)}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{d.createDate}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{d.expireDate}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{d.renewalPrice ?? '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          {d.provider === 'porkbun' ? (
                            <button
                              type="button"
                              onClick={() => handleAutoRenew(d, !d.autoRenew)}
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                d.autoRenew ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {d.autoRenew ? '已开启' : '已关闭'}
                            </button>
                          ) : (
                            <span className={d.autoRenew ? 'text-emerald-600' : 'text-slate-400'}>
                              {d.autoRenew ? '是' : '否'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={d.isExpired ? 'text-red-600 font-medium' : 'text-slate-600'}>
                            {d.isExpired ? '已过期' : '正常'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{d.project || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{d.usage || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            type="button"
                            onClick={() => openEdit(d)}
                            className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="编辑"
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">每页</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 rounded border border-slate-200 text-sm"
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span className="text-sm text-slate-500">条</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-slate-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 编辑域名弹窗 */}
      {editDomain && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditDomain(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">编辑域名 · {editDomain.domain}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">项目组</label>
                <select
                  value={editProject}
                  onChange={(e) => setEditProject(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">未分配</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">用途</label>
                <input
                  type="text"
                  value={editUsage}
                  onChange={(e) => setEditUsage(e.target.value)}
                  placeholder="如：官网、API、测试等"
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {domainHistory.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">历史记录</label>
                  <div className="rounded-lg border border-slate-200 max-h-40 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs text-slate-500">项目组</th>
                          <th className="px-3 py-2 text-left text-xs text-slate-500">用途</th>
                          <th className="px-3 py-2 text-left text-xs text-slate-500">变更时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {domainHistory.map((h, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-600">{h.project || '-'}</td>
                            <td className="px-3 py-2 text-slate-600">{h.usage || '-'}</td>
                            <td className="px-3 py-2 text-slate-500 text-xs">{new Date(h.changedAt).toLocaleString('zh-CN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setEditDomain(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleSaveEdit} disabled={editSaving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                {editSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GoDaddy 诊断弹窗 */}
      {godaddyDebug && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setGodaddyDebug(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">GoDaddy API 诊断</h3>
            <div className="space-y-3 text-sm">
              <p><span className="font-medium text-slate-600">配置状态：</span>{godaddyDebug.configured ? '已配置' : '未配置'}</p>
              <p><span className="font-medium text-slate-600">API 状态：</span>
                <span className={godaddyDebug.status === 'ok' ? 'text-emerald-600' : 'text-red-600'}>{godaddyDebug.status === 'ok' ? '成功' : '失败'}</span>
              </p>
              {godaddyDebug.apiBase && (
                <p><span className="font-medium text-slate-600">API 地址：</span><code className="text-xs bg-slate-100 px-1 rounded">{godaddyDebug.apiBase}</code></p>
              )}
              {godaddyDebug.error && (
                <p><span className="font-medium text-slate-600">错误信息：</span><span className="text-red-600">{godaddyDebug.error}</span></p>
              )}
              <p><span className="font-medium text-slate-600">返回域名数：</span>{godaddyDebug.domainCount}</p>
              {godaddyDebug.hint && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">{godaddyDebug.hint}</div>
              )}
              {godaddyDebug.rawPreview && (
                <div>
                  <p className="font-medium text-slate-600 mb-1">API 原始响应（前 3000 字符）：</p>
                  <pre className="p-3 rounded-lg bg-slate-100 text-xs overflow-x-auto max-h-64 overflow-y-auto">{godaddyDebug.rawPreview}</pre>
                  <p className="text-xs text-slate-500 mt-1">可在响应中搜索 186.co、256.co、chd.co 确认是否来自 GoDaddy API</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setGodaddyDebug(null)} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* Namecheap 诊断弹窗 */}
      {namecheapDebug && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setNamecheapDebug(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Namecheap API 诊断</h3>
            <div className="space-y-3 text-sm">
              <p><span className="font-medium text-slate-600">配置状态：</span>{namecheapDebug.configured ? '已配置' : '未配置'}</p>
              <p><span className="font-medium text-slate-600">API 状态：</span>
                <span className={namecheapDebug.status === 'ok' ? 'text-emerald-600' : 'text-red-600'}>{namecheapDebug.status === 'ok' ? '成功' : '失败'}</span>
              </p>
              {namecheapDebug.error && (
                <p><span className="font-medium text-slate-600">错误信息：</span><span className="text-red-600">{namecheapDebug.error}</span></p>
              )}
              <p><span className="font-medium text-slate-600">解析域名数：</span>{namecheapDebug.domainCount}</p>
              {namecheapDebug.hint && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">{namecheapDebug.hint}</div>
              )}
              {namecheapDebug.rawPreview && (
                <div>
                  <p className="font-medium text-slate-600 mb-1">API 原始响应（前 1500 字符）：</p>
                  <pre className="p-3 rounded-lg bg-slate-100 text-xs overflow-x-auto max-h-48 overflow-y-auto">{namecheapDebug.rawPreview}</pre>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setNamecheapDebug(null)} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 同步设置弹窗 */}
      {configModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfigModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">同步设置</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">同步间隔（天）</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={syncIntervalInput}
                  onChange={(e) => setSyncIntervalInput(Number(e.target.value) || 7)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-500 mt-1">每隔 N 天自动从 API 拉取最新数据，可填 1-365</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setConfigModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                取消
              </button>
              <button onClick={handleSaveConfig} disabled={configSaving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                {configSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
