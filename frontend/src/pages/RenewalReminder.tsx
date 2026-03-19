import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Plus,
  RefreshCw,
  Server,
  Globe,
  FileText,
  ExternalLink,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  Filter,
  Settings,
  LayoutGrid,
  List,
  CheckSquare,
} from 'lucide-react';
import { api, type ReminderItem } from '../api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';

const TYPE_LABELS: Record<string, string> = {
  server: '服务器',
  domain: '域名',
  custom: '自定义',
};

const TYPE_ICONS = { server: Server, domain: Globe, custom: FileText };

function getUrgencyStyle(urgency: ReminderItem['urgency']) {
  switch (urgency) {
    case 'expired':
      return 'bg-slate-200 text-slate-600 border-slate-300';
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'urgent':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'warning':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    default:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
}

/** 行/卡片背景色：大于7天绿色、7天内黄色、3天内橙色、1天内红色 */
function getUrgencyRowBg(urgency: ReminderItem['urgency']) {
  switch (urgency) {
    case 'expired':
      return 'bg-slate-100';
    case 'critical':
      return 'bg-red-50';
    case 'urgent':
      return 'bg-orange-100';
    case 'warning':
      return 'bg-yellow-50';
    default:
      return 'bg-emerald-50';
  }
}

function getUrgencyLabel(urgency: ReminderItem['urgency'], daysLeft: number) {
  if (urgency === 'expired') return '已过期';
  if (daysLeft === 0) return '今天到期';
  if (daysLeft === 1) return '明天到期';
  if (daysLeft < 0) return `${Math.abs(daysLeft)} 天前已过期`;
  return `剩余 ${daysLeft} 天`;
}

export default function RenewalReminder() {
  const [items, setItems] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withinDays, setWithinDays] = useState(30);
  const [filterType, setFilterType] = useState<string>('');
  const [filterProvider, setFilterProvider] = useState<string>('');
  const [addModal, setAddModal] = useState(false);
  const [editItem, setEditItem] = useState<ReminderItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', expireAt: '', category: '', notes: '', linkUrl: '' });
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [excludedProviders, setExcludedProviders] = useState<string[]>([]);
  const [excludeInput, setExcludeInput] = useState('');
  const [excludeAdding, setExcludeAdding] = useState(false);
  const [renewalConfigs, setRenewalConfigs] = useState<{ id: number; provider: string; renewalType: string; dayOfMonth: number | null }[]>([]);
  const [renewalForm, setRenewalForm] = useState({ provider: '', renewalType: 'day_of_month' as string, dayOfMonth: 22 });
  const [renewalSaving, setRenewalSaving] = useState(false);
  const [platforms, setPlatforms] = useState<{ id: number; name: string }[]>([]);
  const [platformsNeedingConfig, setPlatformsNeedingConfig] = useState<string[]>([]);
  const [, setDefaultRenewalConfig] = useState<{ renewalType: string; dayOfMonth: number | null } | null>(null);
  const [defaultRenewalForm, setDefaultRenewalForm] = useState({ renewalType: 'calendar_month' as string, dayOfMonth: 1 });
  const [defaultRenewalSaving, setDefaultRenewalSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'detail'>('summary');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [markingRenewed, setMarkingRenewed] = useState(false);
  const toast = useToast();

  const loadExcluded = () => {
    api.getExcludedProviders().then(setExcludedProviders).catch(() => setExcludedProviders([]));
  };

  const load = () => {
    setLoading(true);
    setError(null);
    return api
      .getReminders(withinDays)
      .then(setItems)
      .catch((e) => {
        setError(e.message);
        setItems([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [withinDays]);
  useEffect(() => {
    if (settingsOpen) {
      loadExcluded();
      api.getRenewalConfigs().then(setRenewalConfigs).catch(() => setRenewalConfigs([]));
      api.getPlatforms().then(setPlatforms).catch(() => setPlatforms([]));
      api.getPlatformsNeedingRenewalConfig().then(setPlatformsNeedingConfig).catch(() => setPlatformsNeedingConfig([]));
      api.getDefaultRenewalConfig().then((c) => {
        if (c) {
          setDefaultRenewalConfig({ renewalType: c.renewalType, dayOfMonth: c.dayOfMonth });
          setDefaultRenewalForm({ renewalType: c.renewalType, dayOfMonth: c.dayOfMonth ?? 1 });
        } else {
          setDefaultRenewalConfig(null);
          setDefaultRenewalForm({ renewalType: 'calendar_month', dayOfMonth: 1 });
        }
      }).catch(() => { setDefaultRenewalConfig(null); setDefaultRenewalForm({ renewalType: 'calendar_month', dayOfMonth: 1 }); });
    }
  }, [settingsOpen]);

  const handleAddExcluded = async () => {
    const p = excludeInput.trim();
    if (!p) {
      toast.error('请输入供应商名称');
      return;
    }
    if (excludedProviders.includes(p)) {
      toast.error('该供应商已在排除列表中');
      return;
    }
    setExcludeAdding(true);
    try {
      await api.addExcludedProvider(p);
      setExcludeInput('');
      loadExcluded();
      load();
      toast.success('已添加');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExcludeAdding(false);
    }
  };

  const handleRemoveExcluded = async (provider: string) => {
    try {
      await api.removeExcludedProvider(provider);
      loadExcluded();
      load();
      toast.success('已移除');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleAddRenewalConfig = async (provider?: string) => {
    const p = (provider ?? renewalForm.provider).trim();
    if (!p) {
      toast.error('请选择或输入供应商名称');
      return;
    }
    const useQuickAdd = !!provider;
    const renewalType = useQuickAdd ? 'day_of_month' : renewalForm.renewalType;
    const dayOfMonth = useQuickAdd ? 22 : (renewalForm.renewalType === 'day_of_month' ? renewalForm.dayOfMonth : undefined);
    if (renewalType === 'day_of_month' && dayOfMonth != null && (dayOfMonth < 1 || dayOfMonth > 31)) {
      toast.error('每月续费日请填写 1-31');
      return;
    }
    setRenewalSaving(true);
    try {
      await api.upsertRenewalConfig({
        provider: p,
        renewalType,
        dayOfMonth: renewalType === 'day_of_month' ? (dayOfMonth ?? 22) : undefined,
      });
      api.getRenewalConfigs().then(setRenewalConfigs);
      api.getPlatformsNeedingRenewalConfig().then(setPlatformsNeedingConfig);
      load();
      toast.success('已保存');
      setRenewalForm((f) => ({ ...f, provider: '' }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRenewalSaving(false);
    }
  };

  const handleSaveDefaultRenewalConfig = async () => {
    if (defaultRenewalForm.renewalType === 'day_of_month' && (defaultRenewalForm.dayOfMonth < 1 || defaultRenewalForm.dayOfMonth > 31)) {
      toast.error('每月续费日请填写 1-31');
      return;
    }
    setDefaultRenewalSaving(true);
    try {
      await api.upsertDefaultRenewalConfig({
        renewalType: defaultRenewalForm.renewalType,
        dayOfMonth: defaultRenewalForm.renewalType === 'day_of_month' ? defaultRenewalForm.dayOfMonth : undefined,
      });
      api.getDefaultRenewalConfig().then((c) => {
        if (c) {
          setDefaultRenewalConfig({ renewalType: c.renewalType, dayOfMonth: c.dayOfMonth });
          setDefaultRenewalForm({ renewalType: c.renewalType, dayOfMonth: c.dayOfMonth ?? 1 });
        }
      });
      load();
      toast.success('默认续费方式已保存');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDefaultRenewalSaving(false);
    }
  };

  const handleDeleteRenewalConfig = async (provider: string) => {
    try {
      await api.deleteRenewalConfig(provider);
      api.getRenewalConfigs().then(setRenewalConfigs);
      load();
      toast.success('已删除');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const providerOptions = Array.from(
    new Set(items.map((i) => (i.type === 'server' ? i.extra?.platform : i.type === 'domain' ? i.extra?.provider : i.extra?.category)).filter(Boolean) as string[]),
  ).sort();

  const filteredItems = items.filter((item) => {
    if (filterType && item.type !== filterType) return false;
    const prov = item.type === 'server' ? item.extra?.platform : item.type === 'domain' ? item.extra?.provider : item.extra?.category;
    if (filterProvider && prov !== filterProvider) return false;
    return true;
  });

  const summaryGroups = (() => {
    const byProvider = new Map<string, { provider: string; expireAt: string; servers: number; domains: number; custom: number }>();
    const toLocalDateKey = (iso: string) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    for (const item of filteredItems) {
      const provider = item.type === 'server' ? (item.extra?.platform ?? '未知') : item.type === 'domain' ? (item.extra?.provider ?? '未知') : (item.extra?.category ?? '自定义');
      const expireKey = toLocalDateKey(item.expireAt);
      const existing = byProvider.get(provider);
      if (!existing || expireKey < existing.expireAt) {
        byProvider.set(provider, { provider, expireAt: expireKey, servers: 0, domains: 0, custom: 0 });
      }
      const g = byProvider.get(provider)!;
      if (expireKey === g.expireAt) {
        if (item.type === 'server') g.servers++;
        else if (item.type === 'domain') g.domains++;
        else g.custom++;
      }
    }
    return Array.from(byProvider.values()).sort((a, b) => a.expireAt.localeCompare(b.expireAt) || a.provider.localeCompare(b.provider));
  })();

  const getRefId = (item: ReminderItem): number => {
    if (item.type === 'server') return item.extra?.serverId ?? 0;
    if (item.type === 'domain') return item.extra?.domainId ?? 0;
    return parseInt(item.id.replace('custom-', ''), 10) || 0;
  };

  const handleMarkRenewed = async () => {
    const toMark = filteredItems.filter((i) => selectedIds.has(i.id));
    if (toMark.length === 0) {
      toast.error('请先勾选要标记的项');
      return;
    }
    setMarkingRenewed(true);
    try {
      const records = toMark.map((i) => ({
        type: i.type,
        refId: getRefId(i),
        expireAt: i.expireAt,
      }));
      const { count } = await api.markAsRenewed(records);
      setSelectedIds(new Set());
      await load();
      toast.success(`已标记 ${count} 项为已续费`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMarkingRenewed(false);
    }
  };

  const openAdd = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setForm({
      name: '',
      expireAt: d.toISOString().slice(0, 16),
      category: '',
      notes: '',
      linkUrl: '',
    });
    setAddModal(true);
  };

  const openEdit = (item: ReminderItem) => {
    if (item.type !== 'custom') return;
    setEditItem(item);
    setForm({
      name: item.name,
      expireAt: item.expireAt.slice(0, 16),
      category: item.extra?.category ?? '',
      notes: item.extra?.notes ?? '',
      linkUrl: item.extra?.linkUrl ?? '',
    });
  };

  const handleAdd = async () => {
    if (!form.name.trim()) {
      toast.error('请输入名称');
      return;
    }
    if (!form.expireAt) {
      toast.error('请选择到期日');
      return;
    }
    setSaving(true);
    try {
      await api.createCustomReminder({
        name: form.name.trim(),
        expireAt: form.expireAt,
        category: form.category.trim() || undefined,
        notes: form.notes.trim() || undefined,
        linkUrl: form.linkUrl.trim() || undefined,
      });
      setAddModal(false);
      load();
      toast.success('已添加');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editItem || editItem.type !== 'custom') return;
    const id = parseInt(editItem.id.replace('custom-', ''), 10);
    if (!form.name.trim()) {
      toast.error('请输入名称');
      return;
    }
    if (!form.expireAt) {
      toast.error('请选择到期日');
      return;
    }
    setSaving(true);
    try {
      await api.updateCustomReminder(id, {
        name: form.name.trim(),
        expireAt: form.expireAt,
        category: form.category.trim() || undefined,
        notes: form.notes.trim() || undefined,
        linkUrl: form.linkUrl.trim() || undefined,
      });
      setEditItem(null);
      load();
      toast.success('已保存');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId || !deleteId.startsWith('custom-')) return;
    const id = parseInt(deleteId.replace('custom-', ''), 10);
    try {
      await api.deleteCustomReminder(id);
      setDeleteId(null);
      load();
      toast.success('已删除');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">续费提醒</h1>
          <p className="text-slate-500 text-sm">服务器、域名及自定义项到期提醒，7 天内黄色、3 天内橙色、1 天内红色</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            title="提醒设置"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            <Plus size={18} />
            添加自定义提醒
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 px-6 py-4 mb-6 flex items-center gap-3">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-500 gap-4">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm font-medium">加载中...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <div className="inline-flex p-4 rounded-full bg-slate-100 text-slate-400 mb-4">
            <Bell size={40} />
          </div>
          <h3 className="text-slate-900 font-semibold mb-2">暂无即将到期的项目</h3>
          <p className="text-slate-500 text-sm mb-6">
            {withinDays} 天内没有服务器、域名或自定义提醒到期。可点击「添加自定义提醒」手动添加。
          </p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            <Plus size={18} />
            添加自定义提醒
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex flex-wrap gap-4 items-center shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
              <Filter size={16} />
              <span>筛选</span>
            </div>
            <select
              value={withinDays}
              onChange={(e) => setWithinDays(Number(e.target.value))}
              className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
            >
              <option value={7}>7 天内</option>
              <option value={14}>14 天内</option>
              <option value={30}>30 天内</option>
              <option value={60}>60 天内</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
            >
              <option value="">全部类型</option>
              <option value="server">服务器</option>
              <option value="domain">域名</option>
              <option value="custom">自定义</option>
            </select>
            <select
              value={filterProvider}
              onChange={(e) => setFilterProvider(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none min-w-[140px]"
            >
              <option value="">全部供应商</option>
              {providerOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {(filterType || filterProvider) && (
              <button
                onClick={() => { setFilterType(''); setFilterProvider(''); }}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                清除筛选
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-slate-500">共 {filteredItems.length} 条</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setViewMode('summary')}
                  className={`px-3 py-1.5 text-sm ${viewMode === 'summary' ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  title="汇总"
                >
                  <LayoutGrid size={16} className="inline mr-1 align-middle" />
                  汇总
                </button>
                <button
                  onClick={() => setViewMode('detail')}
                  className={`px-3 py-1.5 text-sm border-l border-slate-200 ${viewMode === 'detail' ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  title="明细"
                >
                  <List size={16} className="inline mr-1 align-middle" />
                  明细
                </button>
              </div>
            </div>
          </div>
          {viewMode === 'summary' ? (
            <div className="space-y-3">
              {summaryGroups.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">当前筛选条件下暂无数据</div>
              ) : summaryGroups.map((g) => {
                const parts: string[] = [];
                if (g.servers) parts.push(`${g.servers} 台服务器`);
                if (g.domains) parts.push(`${g.domains} 个域名`);
                if (g.custom) parts.push(`${g.custom} 项自定义`);
                const today = new Date();
                const [y, m, d] = g.expireAt.split('-').map(Number);
                const expDate = new Date(y, m - 1, d);
                const fromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const toDate = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
                const daysLeft = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
                const urgency: ReminderItem['urgency'] = daysLeft < 0 ? 'expired' : daysLeft <= 1 ? 'critical' : daysLeft <= 3 ? 'urgent' : daysLeft <= 7 ? 'warning' : 'safe';
                const rowBg = getUrgencyRowBg(urgency);
                return (
                  <div
                    key={`${g.provider}-${g.expireAt}`}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 shadow-sm ${rowBg}`}
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{g.provider}</span>
                      <span className="text-slate-500 ml-2">
                        {g.expireAt.replace(/-/g, '/')} 到期
                      </span>
                    </div>
                    <span className="text-sm text-slate-600">{parts.join('、')}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
          {viewMode === 'detail' ? (
          <>
          {selectedIds.size > 0 && (
            <div className="mb-4 flex items-center gap-3 px-4 py-2 rounded-lg bg-indigo-50 border border-indigo-100">
              <span className="text-sm text-indigo-700">已选 {selectedIds.size} 项</span>
              <button
                onClick={handleMarkRenewed}
                disabled={markingRenewed}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                <CheckSquare size={16} />
                {markingRenewed ? '处理中...' : '标记为已续费'}
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-sm text-slate-500 hover:text-slate-700">
                取消选择
              </button>
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="px-4 py-4 w-12">
                  {filteredItems.length > 0 && (
                    <input
                      type="checkbox"
                      checked={filteredItems.length > 0 && filteredItems.every((i) => selectedIds.has(i.id))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set(filteredItems.map((i) => i.id)));
                        else setSelectedIds(new Set());
                      }}
                      className="rounded border-slate-300 text-indigo-600"
                    />
                  )}
                </th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-28">类型</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">名称</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-36">到期日</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-28 min-w-[5.5rem]">剩余</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-32">状态</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-28">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredItems.map((item) => {
                const Icon = TYPE_ICONS[item.type];
                const style = getUrgencyStyle(item.urgency);
                const rowBg = getUrgencyRowBg(item.urgency);
                return (
                  <tr key={item.id} className={`${rowBg} hover:opacity-90`}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds((s) => new Set([...s, item.id]));
                          else setSelectedIds((s) => { const n = new Set(s); n.delete(item.id); return n; });
                        }}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 whitespace-nowrap">
                        <Icon size={16} className="text-slate-400 shrink-0" />
                        {TYPE_LABELS[item.type]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-slate-900">{item.name}</span>
                        {(item.extra?.platform || item.extra?.provider || item.extra?.category) && (
                          <span className="text-xs text-slate-500">
                            {[item.extra.platform, item.extra.provider, item.extra.category].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(item.expireAt).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${style}`}>
                        {getUrgencyLabel(item.urgency, item.daysLeft)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-500">
                        {item.urgency === 'expired' && '已过期'}
                        {item.urgency === 'critical' && '1 天内'}
                        {item.urgency === 'urgent' && '3 天内'}
                        {item.urgency === 'warning' && '7 天内'}
                        {item.urgency === 'safe' && '还有时间'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.type === 'server' && item.extra?.serverId && (
                          <Link
                            to="/servers"
                            className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                            title="查看服务器"
                          >
                            <ExternalLink size={16} />
                          </Link>
                        )}
                        {item.type === 'domain' && item.extra?.domainId && (
                          <Link
                            to="/domains"
                            className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                            title="查看域名"
                          >
                            <ExternalLink size={16} />
                          </Link>
                        )}
                        {item.extra?.linkUrl && (
                          <a
                            href={item.extra.linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                            title="续费链接"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                        {item.type === 'custom' && (
                          <>
                            <button
                              onClick={() => openEdit(item)}
                              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                              title="编辑"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => setDeleteId(item.id)}
                              className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="删除"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          </>
          ) : null}
          {filteredItems.length === 0 && items.length > 0 && (
            <div className="mt-4 text-center text-slate-500 text-sm py-8 bg-white rounded-xl border border-slate-200">
              当前筛选条件下暂无数据，请调整筛选条件
            </div>
          )}
        </>
      )}

      {/* 添加自定义提醒弹窗 */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">添加自定义提醒</h3>
              <button onClick={() => setAddModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：SSL 证书、订阅服务"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">到期日 *</label>
                <input
                  type="datetime-local"
                  value={form.expireAt}
                  onChange={(e) => setForm({ ...form, expireAt: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">分类（可选）</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="如：SSL、订阅、许可证"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">续费链接（可选）</label>
                <input
                  type="url"
                  value={form.linkUrl}
                  onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">备注（可选）</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setAddModal(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">
                取消
              </button>
              <button onClick={handleAdd} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑自定义提醒弹窗 */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditItem(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">编辑自定义提醒</h3>
              <button onClick={() => setEditItem(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">到期日 *</label>
                <input
                  type="datetime-local"
                  value={form.expireAt}
                  onChange={(e) => setForm({ ...form, expireAt: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">分类（可选）</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">续费链接（可选）</label>
                <input
                  type="url"
                  value={form.linkUrl}
                  onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">备注（可选）</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditItem(null)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">
                取消
              </button>
              <button onClick={handleEdit} disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        title="删除提醒"
        message="确定要删除该自定义提醒吗？"
        confirmLabel="删除"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* 提醒设置：不提醒的供应商 + 续费方式配置 */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSettingsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">提醒设置</h3>
              <button onClick={() => setSettingsOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* 不提醒的供应商 */}
            <section className="mb-8">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">不提醒的供应商</h4>
              <p className="text-sm text-slate-500 mb-3">以下供应商的到期项将不会出现在续费提醒列表中</p>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={excludeInput}
                  onChange={(e) => setExcludeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddExcluded()}
                  placeholder="输入供应商名称"
                  list="exclude-provider-suggestions"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
                />
                <datalist id="exclude-provider-suggestions">
                  {providerOptions.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <button
                  onClick={handleAddExcluded}
                  disabled={excludeAdding || !excludeInput.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  添加
                </button>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {excludedProviders.length === 0 ? (
                  <p className="text-sm text-slate-400 py-3 text-center">暂无排除的供应商</p>
                ) : (
                  excludedProviders.map((p) => (
                    <div key={p} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-sm font-medium text-slate-700">{p}</span>
                      <button onClick={() => handleRemoveExcluded(p)} className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600" title="移除">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* 续费方式配置 */}
            <section>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">续费方式配置</h4>
              <p className="text-sm text-slate-500 mb-4">
                续费方式在供应商级别设置，该供应商下的所有服务器共用。当服务器未填写「取消时间」时，系统会根据创建时间自动推算下次续费日。
              </p>

              {/* 默认续费方式：未单独配置的供应商使用 */}
              <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h5 className="text-sm font-semibold text-slate-700 mb-2">默认续费方式</h5>
                <p className="text-xs text-slate-500 mb-3">未单独配置的供应商将使用此默认方式，确保所有服务器都会出现在续费提醒中</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={defaultRenewalForm.renewalType}
                    onChange={(e) => setDefaultRenewalForm((f) => ({ ...f, renewalType: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
                  >
                    <option value="calendar_month">按自然月（创建日）</option>
                    <option value="day_of_month">每月 X 号</option>
                    <option value="cycle_30">每 30 天</option>
                    <option value="cycle_31">每 31 天</option>
                  </select>
                  {defaultRenewalForm.renewalType === 'day_of_month' && (
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={defaultRenewalForm.dayOfMonth}
                      onChange={(e) => setDefaultRenewalForm((f) => ({ ...f, dayOfMonth: parseInt(e.target.value, 10) || 1 }))}
                      className="w-16 px-2 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
                    />
                  )}
                  <button
                    onClick={handleSaveDefaultRenewalConfig}
                    disabled={defaultRenewalSaving}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {defaultRenewalSaving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>

              {/* 供应商专属续费方式 */}
              <h5 className="text-sm font-semibold text-slate-700 mb-2">供应商专属续费方式</h5>
              {platformsNeedingConfig.length > 0 && (
                <p className="text-xs text-slate-500 mb-2">以下供应商当前使用默认方式，如需不同规则可点击快速添加：</p>
              )}
              {platformsNeedingConfig.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {platformsNeedingConfig.map((p) => (
                    <button
                      key={p}
                      onClick={() => handleAddRenewalConfig(p)}
                      disabled={renewalSaving}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200 disabled:opacity-50"
                    >
                      {p}（单独配置，默认每月 22 号）
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mb-3">
                <input
                  type="text"
                  value={renewalForm.provider}
                  onChange={(e) => setRenewalForm((f) => ({ ...f, provider: e.target.value }))}
                  placeholder="供应商/平台名称"
                  list="renewal-provider-suggestions"
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none min-w-[120px]"
                />
                <datalist id="renewal-provider-suggestions">
                  {platforms.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                  {providerOptions.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <select
                  value={renewalForm.renewalType}
                  onChange={(e) => setRenewalForm((f) => ({ ...f, renewalType: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
                >
                  <option value="day_of_month">每月 X 号</option>
                  <option value="calendar_month">按自然月（创建日）</option>
                  <option value="cycle_30">每 30 天</option>
                  <option value="cycle_31">每 31 天</option>
                </select>
                {renewalForm.renewalType === 'day_of_month' && (
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={renewalForm.dayOfMonth}
                    onChange={(e) => setRenewalForm((f) => ({ ...f, dayOfMonth: parseInt(e.target.value, 10) || 1 }))}
                    className="w-16 px-2 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
                    placeholder="日"
                  />
                )}
                <button
                  onClick={() => handleAddRenewalConfig()}
                  disabled={renewalSaving || !renewalForm.provider.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {renewalSaving ? '保存中...' : '添加'}
                </button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {renewalConfigs.length === 0 ? (
                  <p className="text-sm text-slate-400 py-3 text-center">暂无配置，添加后系统将自动推算续费日</p>
                ) : (
                  renewalConfigs.map((c) => (
                    <div key={c.provider} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">{c.provider}</span>
                        <span className="text-xs text-slate-500">
                          {c.renewalType === 'day_of_month' && c.dayOfMonth ? `每月 ${c.dayOfMonth} 号` : null}
                          {c.renewalType === 'calendar_month' ? '按自然月' : null}
                          {c.renewalType === 'cycle_30' ? '每 30 天' : null}
                          {c.renewalType === 'cycle_31' ? '每 31 天' : null}
                        </span>
                      </div>
                      <button onClick={() => handleDeleteRenewalConfig(c.provider)} className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600" title="删除">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <p className="text-xs text-slate-400 mt-4">服务器按平台、域名按域名商匹配。供应商名称需与列表中显示的完全一致。</p>
          </div>
        </div>
      )}
    </div>
  );
}
