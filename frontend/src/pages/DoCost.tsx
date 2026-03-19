import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Pencil, X, Droplet, ChevronLeft, ChevronRight, Calendar, Search } from 'lucide-react';
import { api, type DoAccount, type DoCost } from '../api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { inputClass, labelClass } from '../utils/styles';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function DailyCostQueryPanel({ accounts, load, toast }: {
  accounts: DoAccount[];
  load: () => void;
  toast: { success: (m: string) => void; error: (m: string) => void };
}) {
  const [queryAccountId, setQueryAccountId] = useState<number | 'all'>('all');
  const [querying, setQuerying] = useState(false);
  const [queryProgress, setQueryProgress] = useState<{ current: number; total: number; accountName?: string } | null>(null);
  const [monthTotalData, setMonthTotalData] = useState<{ year: number; month: number; byAccount: { accountId: number; accountName: string; total: number }[] } | null>(null);

  const queryAccounts = accounts.filter((a) => a.costQueryEnabled).sort((a, b) => (a.costQuerySortOrder ?? 0) - (b.costQuerySortOrder ?? 0));
  const accountIds = queryAccountId === 'all' ? queryAccounts.map((a) => a.id) : [queryAccountId];

  const doQuery = async () => {
    if (accountIds.length === 0) {
      toast.error('请先在账号管理中添加并启用费用查询');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    setQuerying(true);
    setQueryProgress({ current: 0, total: accountIds.length });
    try {
      for (let i = 0; i < accountIds.length; i++) {
        const id = accountIds[i];
        const acc = queryAccounts.find((a) => a.id === id) ?? accounts.find((a) => a.id === id);
        setQueryProgress({ current: i + 1, total: accountIds.length, accountName: acc?.name });
        await api.queryDoDailyCosts({ startDate: today, endDate: today, accountIds: [id] });
      }
      toast.success('查询完成，已保存今日 MTD 费用');
      loadMonthTotal();
      load();
    } catch (e) {
      const msg = (e as Error).message;
      const acc = queryProgress?.accountName ? ` 当前账号：${queryProgress.accountName}` : '';
      toast.error(msg + acc);
    } finally {
      setQuerying(false);
      setQueryProgress(null);
    }
  };

  const getMonthForTotal = () => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  };

  const loadMonthTotal = () => {
    const { year, month } = getMonthForTotal();
    api
      .getDoMonthTotal({ year, month, accountIds: accountIds.length > 0 ? accountIds : undefined })
      .then(setMonthTotalData)
      .catch(() => setMonthTotalData(null));
  };

  useEffect(() => {
    if (accountIds.length > 0) loadMonthTotal();
  }, [queryAccountId, queryAccounts.length]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Search size={18} />
            费用查询
          </h3>
          <p className="text-sm text-slate-500 mt-1">DO API 仅提供当月至今（MTD）累计费用，每天查询一次并记录当日增量。点击查询将拉取今日 MTD 并计算今日费用保存。每天 19:35 自动执行。</p>
        </div>
        <div className="p-6 flex flex-wrap items-end gap-4">
          <div>
            <label className={labelClass}>账号</label>
            <select value={queryAccountId} onChange={(e) => setQueryAccountId(e.target.value === 'all' ? 'all' : Number(e.target.value))} className={inputClass}>
              <option value="all">全部 ({queryAccounts.length})</option>
              {queryAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <button onClick={doQuery} disabled={querying || accountIds.length === 0} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            {querying && queryProgress ? (
              <span className="animate-pulse">查询中 {queryProgress.current}/{queryProgress.total} {queryProgress.accountName ? `（${queryProgress.accountName}）` : ''}</span>
            ) : (
              <><Search size={16} /> 查询并保存今日</>
            )}
          </button>
        </div>
      </div>

      {monthTotalData && monthTotalData.byAccount.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-semibold text-slate-800">{monthTotalData.year}年{monthTotalData.month}月 每日汇总</h3>
          </div>
          <div className="p-6">
            <div className="space-y-2">
              {monthTotalData.byAccount.map((a) => (
                <div key={a.accountId} className="flex justify-between py-2">
                  <span className="text-slate-700">{a.accountName}</span>
                  <span className="font-mono font-medium text-indigo-600">${a.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DoCost() {
  const now = new Date();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'accounts' | 'costs' | 'dailyQuery'>('accounts');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [accounts, setAccounts] = useState<DoAccount[]>([]);
  const [costs, setCosts] = useState<DoCost[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accountModal, setAccountModal] = useState<'new' | 'edit' | null>(null);
  const [editingAccount, setEditingAccount] = useState<DoAccount | null>(null);
  const [accountForm, setAccountForm] = useState({ name: '', token: '', notes: '' });
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountDeleteConfirm, setAccountDeleteConfirm] = useState<DoAccount | null>(null);

  const [costModal, setCostModal] = useState<'new' | 'edit' | null>(null);
  const [editingCost, setEditingCost] = useState<DoCost | null>(null);
  const editingCostRef = useRef<DoCost | null>(null);
  const addCostAccountIdRef = useRef<number>(0);
  const [costForm, setCostForm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1, accountId: 0, project: '', usage: '', amount: 0 });
  const [costSaving, setCostSaving] = useState(false);
  const [costSyncLoading, setCostSyncLoading] = useState(false);
  const [costDeleteConfirm, setCostDeleteConfirm] = useState<DoCost | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getDoAccounts(),
      api.getDoCosts(year, month),
      api.getProjects(),
    ])
      .then(([accs, csts, projs]) => {
        setAccounts(accs);
        setCosts(csts);
        setProjects(projs.map((p) => ({ id: p.id, name: p.name })));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), [year, month]);

  const prevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); } else setMonth((m) => m + 1);
  };
  const canNext = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);

  const costsByAccount = accounts.map((acc) => ({
    account: acc,
    items: costs.filter((c) => c.accountId === acc.id),
  }));

  const totalAmount = costs.reduce((s, r) => s + r.amount, 0);

  const openAddAccount = () => {
    setAccountForm({ name: '', token: '', notes: '' });
    setEditingAccount(null);
    setAccountModal('new');
  };

  const openEditAccount = (acc: DoAccount) => {
    setAccountForm({ name: acc.name ?? '', token: '', notes: acc.notes ?? '' });
    setEditingAccount(acc);
    setAccountModal('edit');
  };

  const handleSaveAccount = async () => {
    const name = (accountForm.name ?? '').trim();
    if (!name) { toast.error('请输入账号名称'); return; }
    if (accountModal === 'new' && !(accountForm.token ?? '').trim()) { toast.error('请输入 Token'); return; }
    setAccountSaving(true);
    try {
      if (accountModal === 'new') {
        await api.createDoAccount({ name, token: accountForm.token.trim(), notes: accountForm.notes?.trim() || undefined });
        toast.success('账号已添加');
      } else if (editingAccount) {
        await api.updateDoAccount(editingAccount.id, {
          name,
          ...(accountForm.token.trim() ? { token: accountForm.token.trim() } : {}),
          notes: accountForm.notes?.trim() || undefined,
        });
        toast.success('账号已更新');
      }
      load();
      setAccountModal(null);
      setEditingAccount(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAccountSaving(false);
    }
  };

  const doDeleteAccount = async () => {
    if (!accountDeleteConfirm) return;
    try {
      await api.deleteDoAccount(accountDeleteConfirm.id);
      load();
      setAccountDeleteConfirm(null);
      toast.success('账号已删除');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggleCostQuery = async (acc: DoAccount) => {
    try {
      await api.updateDoAccount(acc.id, { costQueryEnabled: !acc.costQueryEnabled });
      load();
      toast.success(acc.costQueryEnabled ? '已移出查询' : '已加入查询');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const openAddCost = (accountId: number) => {
    addCostAccountIdRef.current = accountId;
    setCostForm({ year, month, accountId, project: '', usage: '', amount: 0 });
    setEditingCost(null);
    setCostModal('new');
  };

  const closeCostModal = () => {
    editingCostRef.current = null;
    setCostModal(null);
    setEditingCost(null);
  };

  const openEditCost = (row: DoCost) => {
    editingCostRef.current = row;
    setEditingCost(row);
    setCostForm({ year: row.year, month: row.month, accountId: row.accountId, project: row.project ?? '', usage: row.usage ?? '', amount: row.amount });
    setCostModal('edit');
  };

  const handleSaveCost = async () => {
    if (costForm.amount < 0) { toast.error('费用不能为负数'); return; }
    const accountId = costModal === 'new' ? (addCostAccountIdRef.current || costForm.accountId) : costForm.accountId;
    if (costModal === 'new' && (!accountId || accountId < 1)) { toast.error('请选择账号'); return; }
    const editing = editingCostRef.current ?? editingCost;
    if (costModal === 'edit' && !editing) { toast.error('编辑数据异常'); return; }
    setCostSaving(true);
    try {
      if (costModal === 'new') {
        await api.createDoCost({
          year: costForm.year,
          month: costForm.month,
          accountId: Number(accountId),
          project: (costForm.project ?? '').trim(),
          usage: (costForm.usage ?? '').trim() || undefined,
          amount: costForm.amount ?? 0,
        });
        toast.success('已添加');
      } else if (editing) {
        await api.updateDoCost(editing.id, {
          project: (costForm.project ?? '').trim(),
          usage: (costForm.usage ?? '').trim() || undefined,
          amount: Number.isFinite(costForm.amount) ? costForm.amount : 0,
        });
        toast.success('已更新');
      }
      editingCostRef.current = null;
      load();
      closeCostModal();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCostSaving(false);
    }
  };

  const handleSyncDailyToCost = async () => {
    setCostSyncLoading(true);
    try {
      await api.syncDoDailyToCost({ year, month });
      toast.success('已同步本月每日费用到费用登记');
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCostSyncLoading(false);
    }
  };

  const doDeleteCost = async () => {
    if (!costDeleteConfirm) return;
    try {
      await api.deleteDoCost(costDeleteConfirm.id);
      load();
      setCostDeleteConfirm(null);
      toast.success('已删除');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Droplet size={24} className="text-blue-500" />
              DigitalOcean 费用
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {activeTab === 'accounts' ? '管理 DO 账号，配置 Token 用于费用查询' : activeTab === 'costs' ? '在各账号下登记每月费用' : '查询 MTD 费用并同步到费用登记'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              {[
                { id: 'accounts' as const, label: '账号管理' },
                { id: 'costs' as const, label: '费用登记' },
                { id: 'dailyQuery' as const, label: 'DO每日费用查询' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === t.id ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {activeTab === 'costs' && (
              <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors">
                  <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-2 px-2 min-w-[120px] justify-center">
                  <Calendar size={18} className="text-indigo-500" />
                  <span className="font-semibold text-slate-700">{year} 年 {month} 月</span>
                </div>
                <button onClick={nextMonth} disabled={!canNext} className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
            {activeTab === 'accounts' && (
              <button onClick={openAddAccount} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm font-medium shadow-md">
                <Plus size={18} /> 添加账号
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 px-6 py-4 flex items-center gap-3">{error}</div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        )}

        {!loading && !error && activeTab === 'accounts' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">账号名称</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">备注</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-28">参与查询</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500">暂无账号，点击「添加账号」开始</td></tr>
                  ) : (
                    accounts.map((a) => (
                      <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-800">{a.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{a.notes || '-'}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleCostQuery(a)}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${a.costQueryEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}
                          >
                            {a.costQueryEnabled ? '是' : '否'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openEditAccount(a)} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="编辑"><Pencil size={14} /></button>
                          <button onClick={() => setAccountDeleteConfirm(a)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 ml-1" title="删除"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !error && activeTab === 'costs' && (
          <>
            {accounts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                <p className="text-slate-500 mb-4">请先在「账号管理」添加账号</p>
                <button onClick={() => setActiveTab('accounts')} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium">去添加账号</button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-600">本月 {costs.length} 条记录</span>
                    <span className="text-sm font-semibold text-indigo-600">合计 ${totalAmount.toFixed(2)}</span>
                  </div>
                  <button type="button" onClick={handleSyncDailyToCost} disabled={costSyncLoading} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium disabled:opacity-50">
                    {costSyncLoading ? '同步中...' : '从每日查询同步本月费用'}
                  </button>
                </div>
                {costsByAccount.map(({ account, items }) => (
                  <div key={account.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{account.name}</span>
                      <span className="text-xs text-slate-500">({items.length} 条)</span>
                      <button type="button" data-account-id={account.id} onClick={(e) => openAddCost(Number((e.currentTarget as HTMLButtonElement).dataset.accountId))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700">
                        <Plus size={14} /> 添加 {year}年{month}月 费用
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      {items.length === 0 ? (
                        <div className="px-6 py-8 text-center text-slate-400 text-sm">该账号本月暂无费用记录</div>
                      ) : (
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/30">
                              <th className="px-6 py-2 text-left text-xs font-semibold text-slate-500 uppercase">归属项目</th>
                              <th className="px-6 py-2 text-left text-xs font-semibold text-slate-500 uppercase">用途</th>
                              <th className="px-6 py-2 text-right text-xs font-semibold text-slate-500 uppercase">费用 ($)</th>
                              <th className="px-6 py-2 text-right text-xs font-semibold text-slate-500 uppercase">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((row) => (
                              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                <td className="px-6 py-3 text-sm text-slate-700">{row.project || '-'}</td>
                                <td className="px-6 py-3 text-sm text-slate-500">{row.usage || '-'}</td>
                                <td className="px-6 py-3 text-sm text-right font-mono font-medium text-slate-800">${row.amount.toFixed(2)}</td>
                                <td className="px-6 py-3 text-right">
                                  <button onClick={() => openEditCost(row)} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="编辑"><Pencil size={16} /></button>
                                  <button onClick={() => setCostDeleteConfirm(row)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 ml-1" title="删除"><Trash2 size={16} /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && !error && activeTab === 'dailyQuery' && (
          <DailyCostQueryPanel accounts={accounts} load={load} toast={toast} />
        )}
      </div>

      {accountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto" onClick={() => setAccountModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md my-8" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">{accountModal === 'new' ? '添加 DO 账号' : '编辑账号'}</h2>
              <button onClick={() => setAccountModal(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelClass}>账号名称 *</label>
                <input type="text" value={accountForm.name} onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))} placeholder="如 idc@nodelink.it" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>API Token {accountModal === 'edit' && '(留空不修改)'}</label>
                <input type="password" value={accountForm.token} onChange={(e) => setAccountForm((f) => ({ ...f, token: e.target.value }))} placeholder="dop_v1_..." className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>备注</label>
                <input type="text" value={accountForm.notes} onChange={(e) => setAccountForm((f) => ({ ...f, notes: e.target.value }))} className={inputClass} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-2">
              <button type="button" onClick={() => setAccountModal(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleSaveAccount} disabled={accountSaving} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">{accountSaving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      {(costModal === 'new' || costModal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeCostModal} aria-hidden="true" />
          <div className="relative z-10 bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">{costModal === 'new' ? '添加费用' : '编辑费用'}</h2>
              <button onClick={closeCostModal} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
            </div>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSaveCost(); }} noValidate>
              {costModal === 'new' && (
                <>
                  <div>
                    <label className={labelClass}>年月</label>
                    <div className="flex gap-2 mt-1">
                      <select value={costForm.year} onChange={(e) => setCostForm((f) => ({ ...f, year: parseInt(e.target.value, 10) }))} className={inputClass}>
                        {[year - 2, year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y} 年</option>)}
                      </select>
                      <select value={costForm.month} onChange={(e) => setCostForm((f) => ({ ...f, month: parseInt(e.target.value, 10) }))} className={inputClass}>
                        {MONTHS.map((m) => <option key={m} value={m}>{m} 月</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>账号</label>
                    <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
                      {accounts.find((a) => a.id === (addCostAccountIdRef.current || costForm.accountId))?.name ?? '未知'}
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className={labelClass}>归属项目</label>
                <select value={costForm.project} onChange={(e) => setCostForm((f) => ({ ...f, project: e.target.value }))} className={inputClass}>
                  <option value="">选择项目（可选）</option>
                  {projects.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                  {(costForm.project ?? '') && !projects.some((p) => p.name === costForm.project) && <option value={costForm.project}>{costForm.project}</option>}
                </select>
              </div>
              <div>
                <label className={labelClass}>用途（可选）</label>
                <input type="text" value={costForm.usage} onChange={(e) => setCostForm((f) => ({ ...f, usage: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>费用 ($)</label>
                <input type="number" step="0.01" min="0" value={costForm.amount || ''} onChange={(e) => setCostForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} placeholder="0" className={inputClass} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeCostModal} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">取消</button>
                <button type="button" disabled={costSaving} onClick={handleSaveCost} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">{costSaving ? '保存中...' : '保存'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal open={!!accountDeleteConfirm} title="确认删除账号" message={accountDeleteConfirm ? `确定删除账号「${accountDeleteConfirm.name}」？` : ''} onConfirm={doDeleteAccount} onCancel={() => setAccountDeleteConfirm(null)} />
      <ConfirmModal open={!!costDeleteConfirm} title="确认删除" message={costDeleteConfirm ? '确定删除该条费用记录？' : ''} onConfirm={doDeleteCost} onCancel={() => setCostDeleteConfirm(null)} />
    </div>
  );
}
