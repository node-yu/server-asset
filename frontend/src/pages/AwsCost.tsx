import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, Pencil, X, Cloud, ChevronLeft, ChevronRight, Calendar, Eye, Key, Download, Upload, ChevronUp, ChevronDown, Copy, GripVertical, Search } from 'lucide-react';
import { api, type AwsCost, type AwsAccount, type CreateAwsCostDto, type CreateAwsAccountDto, type AwsDailyCostResponse, type AwsDailyCostJobLog } from '../api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { inputClass, labelClass } from '../utils/styles';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const COST_QUERY_STATUS_OPTIONS = [
  { value: '', label: '未设置' },
  { value: 'full', label: '需全量操作' },
  { value: 'cost_only', label: '仅查询费用' },
  { value: 'preparing_stop', label: '准备停止使用' },
  { value: 'stopped', label: '停止使用' },
];

const emptyAccountForm: CreateAwsAccountDto = {
  name: '',
  awsAccountId: '',
  loginAccount: '',
  password: '',
  supplier: '',
  loginMethod: '',
  accountType: '',
  accessKeyId: '',
  secretAccessKey: '',
  proxy: '',
  mfa: '',
  notes: '',
};

function Copyable({ text, children, onCopied, className = '' }: { text: string; children: React.ReactNode; onCopied?: () => void; className?: string }) {
  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => onCopied?.()).catch(() => {});
  };
  return (
    <span className={`inline-flex items-center gap-1 group ${className}`}>
      {children}
      {text && (
        <button type="button" onClick={handleCopy} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 text-slate-500" title="复制">
          <Copy size={14} />
        </button>
      )}
    </span>
  );
}

function DailyCostQueryPanel({ accounts, onReorder, load, toast }: {
  accounts: AwsAccount[];
  onReorder: (ids: number[]) => Promise<unknown>;
  load: () => void;
  toast: { success: (m: string) => void; error: (m: string) => void };
}) {
  const [queryStart, setQueryStart] = useState('');
  const [queryEnd, setQueryEnd] = useState('');
  const [queryAccountId, setQueryAccountId] = useState<number | 'all'>('all');
  const [querying, setQuerying] = useState(false);
  const [queryProgress, setQueryProgress] = useState<{ current: number; total: number; accountName?: string } | null>(null);
  const [dailyData, setDailyData] = useState<AwsDailyCostResponse | null>(null);
  const [monthTotalData, setMonthTotalData] = useState<{ year: number; month: number; byAccount: { accountId: number; accountName: string; total: number }[] } | null>(null);
  const [jobLogs, setJobLogs] = useState<AwsDailyCostJobLog[]>([]);
  const [jobLogsTotal, setJobLogsTotal] = useState(0);
  const [jobLogsPage, setJobLogsPage] = useState(1);
  const jobLogsPageSize = 5;
  const [listCollapsed, setListCollapsed] = useState(false);

  const queryAccounts = accounts.filter((a) => a.costQueryEnabled).sort((a, b) => (a.costQuerySortOrder ?? 0) - (b.costQuerySortOrder ?? 0));
  const accountIds = queryAccountId === 'all' ? queryAccounts.map((a) => a.id) : [queryAccountId];

  const doQuery = async () => {
    const start = queryStart || queryEnd;
    const end = queryEnd || queryStart;
    if (!start || !end) {
      toast.error('请选择日期');
      return;
    }
    if (start > end) {
      toast.error('开始日期不能晚于结束日期');
      return;
    }
    if (accountIds.length === 0) {
      toast.error('请先在下方添加查询账号');
      return;
    }
    setQuerying(true);
    setQueryProgress({ current: 0, total: accountIds.length });
    try {
      for (let i = 0; i < accountIds.length; i++) {
        const id = accountIds[i];
        const acc = queryAccounts.find((a) => a.id === id) ?? accounts.find((a) => a.id === id);
        setQueryProgress({ current: i + 1, total: accountIds.length, accountName: acc?.name });
        await api.queryAwsDailyCostOne({ startDate: start, endDate: end, accountId: id });
      }
      toast.success('查询完成，已保存');
      loadDailyRows();
      loadMonthTotal();
    } catch (e) {
      const msg = (e as Error).message;
      const acc = queryProgress?.accountName ? ` 当前账号：${queryProgress.accountName}` : '';
      toast.error(msg + acc);
    } finally {
      setQuerying(false);
      setQueryProgress(null);
    }
  };

  /** 展示范围：固定为最近 7 天 */
  const getDisplayRange = () => {
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  };

  const loadDailyRows = () => {
    const { start, end } = getDisplayRange();
    api
      .getAwsDailyCosts({
        accountIds: accountIds.length > 0 ? accountIds : undefined,
        startDate: start,
        endDate: end,
      })
      .then(setDailyData)
      .catch(() => setDailyData(null));
  };

  const getMonthForTotal = () => {
    const now = new Date();
    const day = now.getDate();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    if (day === 1) {
      month -= 1;
      if (month < 1) {
        month = 12;
        year -= 1;
      }
    }
    return { year, month };
  };

  const loadMonthTotal = () => {
    const { year, month } = getMonthForTotal();
    api
      .getAwsMonthTotal({
        year,
        month,
        accountIds: accountIds.length > 0 ? accountIds : undefined,
      })
      .then(setMonthTotalData)
      .catch(() => setMonthTotalData(null));
  };

  const loadJobLogs = (page = 1) => {
    api
      .getAwsDailyCostJobLogs({ page, pageSize: jobLogsPageSize })
      .then((r) => {
        setJobLogs(r.items);
        setJobLogsTotal(r.total);
        setJobLogsPage(r.page);
      })
      .catch(() => {
        setJobLogs([]);
        setJobLogsTotal(0);
      });
  };

  useEffect(() => {
    loadJobLogs(1);
  }, []);

  useEffect(() => {
    if (accountIds.length > 0) {
      loadDailyRows();
      loadMonthTotal();
    }
  }, [queryAccountId, queryAccounts.length]);

  /** 快捷范围：仅用于设置「查询并保存」的日期 */
  const setQueryRange = (days: number) => {
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    setQueryStart(start.toISOString().slice(0, 10));
    setQueryEnd(end.toISOString().slice(0, 10));
  };

  const maxDateStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Search size={18} />
            费用查询
          </h3>
          <p className="text-sm text-slate-500 mt-1">通过账号的代理和 Access Key 从 AWS Cost Explorer 拉取每日费用并保存。当日费用需次日才能查到。</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-700">查询范围（快捷）：</span>
            <button type="button" onClick={() => setQueryRange(1)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium">
              昨天
            </button>
            <button type="button" onClick={() => setQueryRange(3)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium">
              前3天
            </button>
            <button type="button" onClick={() => setQueryRange(7)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium">
              前7天
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">开始日期</label>
              <input type="date" value={queryStart} onChange={(e) => setQueryStart(e.target.value)} max={maxDateStr} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">结束日期</label>
              <input type="date" value={queryEnd} onChange={(e) => setQueryEnd(e.target.value)} max={maxDateStr} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">账号</label>
              <select value={queryAccountId} onChange={(e) => setQueryAccountId(e.target.value === 'all' ? 'all' : Number(e.target.value))} className={inputClass}>
                <option value="all">全部查询账号 ({queryAccounts.length})</option>
                {queryAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <button onClick={doQuery} disabled={querying || accountIds.length === 0} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              {querying && queryProgress ? (
                <span className="animate-pulse">
                  查询中 {queryProgress.current}/{queryProgress.total} {queryProgress.accountName ? `（${queryProgress.accountName}）` : ''}
                </span>
              ) : (
                <><Search size={16} /> 查询并保存</>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">定时任务执行记录</h3>
          <span className="text-xs text-slate-500">每天 19:30 自动查询昨日费用</span>
        </div>
        <div className="p-4">
          {jobLogs.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">暂无执行记录，定时任务运行后会在此显示</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-4 py-2 text-left font-medium">执行时间</th>
                    <th className="px-4 py-2 text-left font-medium">查询日期</th>
                    <th className="px-4 py-2 text-right font-medium">耗时</th>
                    <th className="px-4 py-2 text-right font-medium">成功/失败</th>
                    <th className="px-4 py-2 text-center font-medium">同步费用登记</th>
                  </tr>
                </thead>
                <tbody>
                  {jobLogs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-700">
                        {new Date(log.startedAt).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-2 text-slate-600">{log.queryDate}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-600">
                        {(log.durationMs / 1000).toFixed(1)} 秒
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className={log.failedCount > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                          {log.successCount}/{log.totalCount}
                          {log.failedCount > 0 && ` (${log.failedCount} 失败)`}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {log.syncCostOk ? (
                          <span className="text-emerald-600">✓</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {jobLogs.length > 0 && (
            <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
              <button type="button" onClick={() => loadJobLogs(1)} className="text-xs text-slate-500 hover:text-indigo-600">
                刷新记录
              </button>
              {jobLogsTotal > jobLogsPageSize && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadJobLogs(jobLogsPage - 1)}
                    disabled={jobLogsPage <= 1}
                    className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-slate-600">
                    第 {jobLogsPage} / {Math.ceil(jobLogsTotal / jobLogsPageSize)} 页，共 {jobLogsTotal} 条
                  </span>
                  <button
                    type="button"
                    onClick={() => loadJobLogs(jobLogsPage + 1)}
                    disabled={jobLogsPage >= Math.ceil(jobLogsTotal / jobLogsPageSize)}
                    className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {dailyData && dailyData.rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-semibold text-slate-800">费用记录（默认最近 7 天，按账号一行）</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/30">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase sticky left-0 bg-slate-50/30 z-10">账号</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                    {(() => {
                      const { year, month } = getMonthForTotal();
                      return `${year}年${month}月总`;
                    })()}
                  </th>
                  {dailyData.dates.map((d) => (
                    <th key={d} className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dailyData.rows.map((r) => {
                  const accTotal = monthTotalData?.byAccount?.find((a) => a.accountId === r.accountId)?.total;
                  return (
                    <tr key={r.accountId} className="group border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10">{r.accountName}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono font-medium text-indigo-600">
                        {accTotal != null ? `$${accTotal.toFixed(2)}` : '-'}
                      </td>
                      {dailyData.dates.map((d) => {
                        const cell = r.byDate[d];
                        if (!cell) return <td key={d} className="px-4 py-3 text-sm text-right text-slate-400">-</td>;
                        return (
                          <td key={d} className="px-4 py-3 text-sm text-right">
                            <span className="font-mono font-medium">${cell.amount.toFixed(2)}</span>
                            {cell.changePct != null && (
                              <span className={`ml-1 text-xs ${
                                cell.changePct === 0 ? 'text-slate-500' :
                                cell.changePct > 0 ? 'text-red-600' : 'text-emerald-600'
                              }`}>
                                {cell.changePct > 0 ? '+' : ''}{cell.changePct.toFixed(2)}%
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button onClick={() => setListCollapsed(!listCollapsed)} className="w-full px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between hover:bg-slate-50">
          <div className="text-left">
            <h3 className="font-semibold text-slate-800">查询账号列表</h3>
            <p className="text-sm text-slate-500 mt-0.5">拖拽调整顺序，添加/移除参与查询的账号</p>
          </div>
          <ChevronDown size={20} className={`text-slate-500 transition-transform ${listCollapsed ? '' : 'rotate-180'}`} />
        </button>
        {!listCollapsed && <DailyCostQueryList accounts={accounts} onReorder={onReorder} load={load} toast={toast} />}
      </div>
    </div>
  );
}

function DailyCostQueryList({ accounts, onReorder, load, toast }: {
  accounts: AwsAccount[];
  onReorder: (ids: number[]) => Promise<unknown>;
  load: () => void;
  toast: { success: (m: string) => void; error: (m: string) => void };
}) {
  const [list, setList] = useState<AwsAccount[]>([]);
  const [dragged, setDragged] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const enabled = accounts.filter((a) => a.costQueryEnabled).sort((a, b) => (a.costQuerySortOrder ?? 0) - (b.costQuerySortOrder ?? 0));
    setList(enabled);
  }, [accounts]);

  const available = accounts.filter((a) => !a.costQueryEnabled && a.costQueryStatus !== 'stopped' && a.costQueryStatus !== 'preparing_stop');

  const handleDragStart = (id: number) => setDragged(id);
  const handleDragEnd = () => setDragged(null);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragged(null);
    if (dragged == null) return;
    const idx = list.findIndex((a) => a.id === dragged);
    if (idx < 0 || idx === dropIndex) return;
    const next = [...list];
    const [removed] = next.splice(idx, 1);
    next.splice(dropIndex, 0, removed);
    setList(next);
  };

  const handleAdd = async (acc: AwsAccount) => {
    setSaving(true);
    try {
      await api.updateAwsAccount(acc.id, { costQueryEnabled: true, costQuerySortOrder: list.length });
      load();
      toast.success('已加入查询列表');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (acc: AwsAccount) => {
    setSaving(true);
    try {
      await api.updateAwsAccount(acc.id, { costQueryEnabled: false });
      load();
      toast.success('已移出查询列表');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOrder = async () => {
    const ids = list.map((a) => a.id);
    if (ids.length === 0) return;
    setSaving(true);
    try {
      await onReorder(ids);
      load();
      toast.success('顺序已保存');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h4 className="text-sm font-medium text-slate-700 mb-2">已加入查询的账号（可拖拽排序）</h4>
        {list.length === 0 ? (
          <div className="py-8 text-center text-slate-500 rounded-lg border-2 border-dashed border-slate-200">暂无账号，从下方添加</div>
        ) : (
          <ul className="space-y-2">
            {list.map((acc, index) => (
              <li
                key={acc.id}
                draggable
                onDragStart={() => handleDragStart(acc.id)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border bg-white cursor-grab active:cursor-grabbing ${dragged === acc.id ? 'opacity-50' : ''}`}
              >
                <GripVertical size={18} className="text-slate-400 shrink-0" />
                <span className="font-medium text-slate-800">{acc.name}</span>
                {acc.awsAccountId && <span className="text-sm text-slate-500 font-mono">({acc.awsAccountId})</span>}
                <span className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${
                  acc.costQueryStatus === 'full' ? 'bg-amber-100 text-amber-800' :
                  acc.costQueryStatus === 'cost_only' ? 'bg-emerald-100 text-emerald-800' :
                  acc.costQueryStatus === 'preparing_stop' ? 'bg-orange-100 text-orange-800' :
                  acc.costQueryStatus === 'stopped' ? 'bg-red-100 text-red-800' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {COST_QUERY_STATUS_OPTIONS.find((o) => o.value === (acc.costQueryStatus ?? ''))?.label ?? '未设置'}
                </span>
                <button type="button" onClick={() => handleRemove(acc)} disabled={saving} className="text-slate-400 hover:text-red-600 p-1 rounded">
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {list.length > 0 && (
          <button type="button" onClick={handleSaveOrder} disabled={saving} className="mt-3 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? '保存中...' : '保存排序'}
          </button>
        )}
      </div>
      {available.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">可添加的账号</h4>
          <div className="flex flex-wrap gap-2">
            {available.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => handleAdd(acc)}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium disabled:opacity-50"
              >
                + {acc.name}
                {acc.awsAccountId && <span className="text-slate-400"> ({acc.awsAccountId})</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AwsCost() {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<'accounts' | 'costs' | 'dailyQuery'>('accounts');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [accounts, setAccounts] = useState<AwsAccount[]>([]);
  const [costs, setCosts] = useState<AwsCost[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accountModal, setAccountModal] = useState<'new' | 'edit' | null>(null);
  const [editingAccount, setEditingAccount] = useState<AwsAccount | null>(null);
  const [accountForm, setAccountForm] = useState<CreateAwsAccountDto & { costQueryStatus?: string }>({ ...emptyAccountForm });
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountDeleteConfirm, setAccountDeleteConfirm] = useState<AwsAccount | null>(null);

  const [costModal, setCostModal] = useState<'new' | 'edit' | null>(null);
  const [editingCost, setEditingCost] = useState<AwsCost | null>(null);
  const editingCostRef = useRef<AwsCost | null>(null); // 用 ref 避免 handleSaveCost 闭包拿到旧值
  const addCostAccountIdRef = useRef<number>(0); // 添加费用时由按钮 data-account-id 传入，ref 保证不丢失
  const [costForm, setCostForm] = useState<CreateAwsCostDto>({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    accountId: 0,
    project: '',
    usage: '',
    amount: 0,
  });
  const [costSaving, setCostSaving] = useState(false);
  const [costSyncLoading, setCostSyncLoading] = useState(false);
  const [costDeleteConfirm, setCostDeleteConfirm] = useState<AwsCost | null>(null);
  const [totpCodes, setTotpCodes] = useState<Record<number, string>>({});
  const [totpRemaining, setTotpRemaining] = useState(0);
  const [importing, setImporting] = useState(false);
  const [sortBy, setSortBy] = useState<keyof AwsAccount | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const updateRemaining = () => {
      setTotpRemaining(30 - (Math.floor(Date.now() / 1000) % 30));
    };
    updateRemaining();
    const t = setInterval(updateRemaining, 1000);
    return () => clearInterval(t);
  }, []);

  const toast = useToast();

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getAwsAccounts(),
      api.getAwsCosts(year, month),
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

  const mfaAccountIds = accounts.filter((a) => (a.mfa ?? '').trim()).map((a) => a.id);
  useEffect(() => {
    if (mfaAccountIds.length === 0) return;
    const fetchTotp = () => {
      api.getAwsAccountTotpBatch(mfaAccountIds).then(setTotpCodes).catch(() => {});
    };
    fetchTotp();
    const t = setInterval(fetchTotp, 25000);
    return () => clearInterval(t);
  }, [mfaAccountIds.join(',')]);

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  };

  const canNext = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);

  const costsByAccount = useMemo(() => {
    const orderRank = (acc: AwsAccount) => (acc.costQueryStatus === 'stopped' ? 2 : acc.costQueryStatus === 'preparing_stop' ? 1 : 0);
    const list = accounts.map((acc) => ({
      account: acc,
      items: costs.filter((c) => c.accountId === acc.id),
    }));
    list.sort((a, b) => orderRank(a.account) - orderRank(b.account));
    return list;
  }, [accounts, costs]);

  const totalAmount = costs.reduce((s, r) => s + r.amount, 0);

  const sortedAccounts = useMemo(() => {
    const orderRank = (a: AwsAccount) => (a.costQueryStatus === 'stopped' ? 2 : a.costQueryStatus === 'preparing_stop' ? 1 : 0);
    let list = [...accounts];
    if (sortBy) {
      list.sort((a, b) => {
        const av = (a[sortBy] ?? '') as string;
        const bv = (b[sortBy] ?? '') as string;
        const cmp = String(av).localeCompare(String(bv), 'zh-CN');
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }
    // 准备停止使用、停止使用的账号排在最下面（停止使用在最后）
    list.sort((a, b) => orderRank(a) - orderRank(b));
    return list;
  }, [accounts, sortBy, sortOrder]);

  const toggleSort = (col: keyof AwsAccount) => {
    if (sortBy === col) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ col }: { col: keyof AwsAccount }) => {
    if (sortBy !== col) return null;
    return sortOrder === 'asc' ? <ChevronUp size={12} className="inline ml-0.5" /> : <ChevronDown size={12} className="inline ml-0.5" />;
  };

  const openAddAccount = () => {
    setAccountForm({ ...emptyAccountForm });
    setEditingAccount(null);
    setAccountModal('new');
  };

  const openEditAccount = (acc: AwsAccount) => {
    setAccountForm({
      name: acc.name ?? '',
      awsAccountId: acc.awsAccountId ?? '',
      loginAccount: acc.loginAccount ?? '',
      password: '',
      supplier: acc.supplier ?? '',
      loginMethod: acc.loginMethod ?? '',
      accountType: acc.accountType ?? '',
      accessKeyId: acc.accessKeyId ?? '',
      secretAccessKey: '',
      proxy: acc.proxy ?? '',
      mfa: acc.mfa ?? '',
      notes: acc.notes ?? '',
      costQueryStatus: acc.costQueryStatus ?? '',
    });
    setEditingAccount(acc);
    setAccountModal('edit');
  };

  const handleSaveAccount = async () => {
    const name = (accountForm.name ?? '').trim();
    if (!name) {
      toast.error('请输入账号名称');
      return;
    }
    setAccountSaving(true);
    try {
      const payload = { ...accountForm };
      if (accountModal === 'edit' && !(payload.password ?? '').trim()) delete payload.password;
      if (accountModal === 'edit' && !(payload.secretAccessKey ?? '').trim()) delete payload.secretAccessKey;
      if (accountModal === 'new') delete (payload as Record<string, unknown>).costQueryStatus; // 新建时不传
      if (accountModal === 'new') {
        await api.createAwsAccount(payload);
        toast.success('账号已添加');
      } else if (editingAccount) {
        await api.updateAwsAccount(editingAccount.id, payload);
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
      await api.deleteAwsAccount(accountDeleteConfirm.id);
      load();
      setAccountDeleteConfirm(null);
      toast.success('账号已删除');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleShowPassword = async (id: number) => {
    try {
      const { password } = await api.getAwsAccountPassword(id);
      if (password) {
        await navigator.clipboard.writeText(password);
        toast.success('密码已复制到剪贴板');
      } else {
        toast.success('该账号未设置密码');
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleCopyTotp = (code: string) => {
    if (code) {
      navigator.clipboard.writeText(code);
      toast.success('验证码已复制');
    }
  };

  const handleShowSecretKey = async (id: number) => {
    try {
      const { secretAccessKey } = await api.getAwsAccountSecretKey(id);
      if (secretAccessKey) {
        await navigator.clipboard.writeText(secretAccessKey);
        toast.success('Secret Key 已复制到剪贴板');
      } else {
        toast.success('该账号未设置 Secret Key');
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleCostQueryReorder = (accountIds: number[]) => api.updateAwsCostQueryOrder(accountIds);

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

  const openEditCost = (row: AwsCost) => {
    editingCostRef.current = row;
    setEditingCost(row);
    setCostForm({
      year: row.year,
      month: row.month,
      accountId: row.accountId,
      project: row.project,
      usage: row.usage ?? '',
      amount: row.amount,
    });
    setCostModal('edit');
  };

  const handleSaveCost = async () => {
    if (costForm.amount < 0) {
      toast.error('费用不能为负数');
      return;
    }
    // 添加时账号由点击的卡片决定，用 ref 读取（避免 state 闭包问题）
    const accountId = costModal === 'new' ? (addCostAccountIdRef.current || costForm.accountId) : costForm.accountId;
    if (costModal === 'new' && (!accountId || accountId < 1)) {
      toast.error('请选择账号');
      return;
    }
    const editing = editingCostRef.current ?? editingCost;
    if (costModal === 'edit' && !editing) {
      toast.error('编辑数据异常，请关闭后重试');
      return;
    }
    setCostSaving(true);
    try {
      if (costModal === 'new') {
        await api.createAwsCost({
          year: costForm.year,
          month: costForm.month,
          accountId: Number(accountId),
          project: (costForm.project ?? '').trim(),
          usage: (costForm.usage ?? '').trim() || undefined,
          amount: costForm.amount ?? 0,
        });
        toast.success('已添加');
      } else if (editing) {
        const amt = costForm.amount ?? 0;
        await api.updateAwsCost(editing.id, {
          project: (costForm.project ?? '').trim(),
          usage: (costForm.usage ?? '').trim() || undefined,
          amount: Number.isFinite(amt) ? amt : 0,
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
      await api.syncAwsDailyToCost({ year, month });
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
      await api.deleteAwsCost(costDeleteConfirm.id);
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
              <Cloud size={24} className="text-amber-500" />
              AWS 费用
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {activeTab === 'accounts' ? '管理 AWS 账号信息，支持十余个账号' : '在各账号下登记每月费用'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              {[
                { id: 'accounts' as const, label: '账号管理' },
                { id: 'costs' as const, label: '费用登记' },
                { id: 'dailyQuery' as const, label: 'AWS每日费用查询' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === t.id ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {activeTab === 'costs' && (
              <>
                <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                  <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors">
                    <ChevronLeft size={20} />
                  </button>
                  <div className="flex items-center gap-2 px-2 min-w-[120px] justify-center">
                    <Calendar size={18} className="text-indigo-500" />
                    <span className="font-semibold text-slate-700">{year} 年 {month} 月</span>
                  </div>
                  <button
                    onClick={nextMonth}
                    disabled={!canNext}
                    className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </>
            )}
            {activeTab === 'accounts' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => api.downloadAwsAccountTemplate().then(() => toast.success('模板已下载')).catch((e) => toast.error((e as Error).message))}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium"
                >
                  <Download size={18} />
                  下载模板
                </button>
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium cursor-pointer">
                  <Upload size={18} />
                  {importing ? '导入中...' : '导入'}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    disabled={importing}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setImporting(true);
                      try {
                        const r = await api.importAwsAccounts(f);
                        load();
                        toast.success(`导入成功 ${r.imported} 条${r.failed > 0 ? `，失败 ${r.failed} 条` : ''}`);
                        if (r.errors.length > 0) r.errors.slice(0, 3).forEach((err) => toast.error(err));
                      } catch (err) {
                        toast.error((err as Error).message);
                      } finally {
                        setImporting(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
                <button
                  onClick={openAddAccount}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm font-medium shadow-md"
                >
                  <Plus size={18} />
                  添加账号
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 px-6 py-4 flex items-center gap-3">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        )}

        {!loading && !error && activeTab === 'accounts' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-80">
                      <button type="button" onClick={() => toggleSort('name')} className="flex items-center hover:text-slate-700">
                        账号名称 <SortIcon col="name" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                      <button type="button" onClick={() => toggleSort('awsAccountId')} className="flex items-center hover:text-slate-700">
                        账号ID <SortIcon col="awsAccountId" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-28">状态</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                      <button type="button" onClick={() => toggleSort('supplier')} className="flex items-center hover:text-slate-700">
                        供应商 <SortIcon col="supplier" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                      <button type="button" onClick={() => toggleSort('accountType')} className="flex items-center hover:text-slate-700">
                        账号性质 <SortIcon col="accountType" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                      <button type="button" onClick={() => toggleSort('loginMethod')} className="flex items-center hover:text-slate-700">
                        登录方式 <SortIcon col="loginMethod" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-44">
                      <button type="button" onClick={() => toggleSort('mfa')} className="flex items-center hover:text-slate-700">
                        MFA <SortIcon col="mfa" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                        暂无账号，点击「添加账号」开始
                      </td>
                    </tr>
                  ) : (
                    sortedAccounts.map((a) => (
                      <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-800 w-80">
                          <Copyable text={a.name} onCopied={() => toast.success('已复制')}>
                            {a.name}
                          </Copyable>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                          <Copyable text={a.awsAccountId ?? ''} onCopied={() => toast.success('已复制')}>
                            {a.awsAccountId || '-'}
                          </Copyable>
                        </td>
                        <td className="px-4 py-3 text-sm w-28">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            a.costQueryStatus === 'full' ? 'bg-amber-100 text-amber-800' :
                            a.costQueryStatus === 'cost_only' ? 'bg-emerald-100 text-emerald-800' :
                            a.costQueryStatus === 'preparing_stop' ? 'bg-orange-100 text-orange-800' :
                            a.costQueryStatus === 'stopped' ? 'bg-red-100 text-red-800' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {COST_QUERY_STATUS_OPTIONS.find((o) => o.value === (a.costQueryStatus ?? ''))?.label ?? '未设置'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{a.supplier || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{a.accountType || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{a.loginMethod || '-'}</td>
                        <td className="px-4 py-3 text-sm w-44">
                          {totpCodes[a.id] ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleCopyTotp(totpCodes[a.id])}
                                className="shrink-0 px-2 py-1 rounded bg-amber-100 text-amber-800 font-mono text-sm hover:bg-amber-200 transition-colors"
                                title="点击复制验证码"
                              >
                                {totpCodes[a.id]}
                              </button>
                              <span className="shrink-0 text-xs text-slate-500 tabular-nums w-14 text-right">剩余 {String(totpRemaining).padStart(2, '0')}s</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleShowPassword(a.id)}
                              className="p-2 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                              title="复制密码"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handleShowSecretKey(a.id)}
                              className="p-2 rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                              title="复制 Secret Key"
                            >
                              <Key size={14} />
                            </button>
                            <button
                              onClick={() => openEditAccount(a)}
                              className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                              title="编辑"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setAccountDeleteConfirm(a)}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="删除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
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
                <button onClick={() => setActiveTab('accounts')} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium">
                  去添加账号
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-600">本月 {costs.length} 条记录</span>
                    <span className="text-sm font-semibold text-indigo-600">合计 ${totalAmount.toFixed(2)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncDailyToCost}
                    disabled={costSyncLoading}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium disabled:opacity-50"
                  >
                    {costSyncLoading ? '同步中...' : '从每日查询同步本月费用'}
                  </button>
                </div>
                {costsByAccount.map(({ account, items }) => (
                  <div key={account.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Copyable text={account.name} onCopied={() => toast.success('已复制')}>
                          <span className="font-semibold text-slate-800">{account.name}</span>
                        </Copyable>
                        {account.awsAccountId && (
                          <Copyable text={account.awsAccountId} onCopied={() => toast.success('已复制')}>
                            <span className="text-xs text-slate-500 font-mono">({account.awsAccountId})</span>
                          </Copyable>
                        )}
                        <span className="text-xs text-slate-500">({items.length} 条)</span>
                      </div>
                      <button
                        type="button"
                        data-account-id={account.id}
                        onClick={(e) => {
                          const id = Number((e.currentTarget as HTMLButtonElement).dataset.accountId);
                          if (id) openAddCost(id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                      >
                        <Plus size={14} />
                        添加 {year}年{month}月 费用
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      {items.length === 0 ? (
                        <div className="px-6 py-8 text-center text-slate-400 text-sm">
                          该账号本月暂无费用记录，点击「添加费用」登记
                        </div>
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
                                  <button onClick={() => openEditCost(row)} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="编辑">
                                    <Pencil size={16} />
                                  </button>
                                  <button onClick={() => setCostDeleteConfirm(row)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 ml-1" title="删除">
                                    <Trash2 size={16} />
                                  </button>
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
          <DailyCostQueryPanel accounts={accounts} onReorder={handleCostQueryReorder} load={load} toast={toast} />
        )}
      </div>

      {/* 账号表单弹窗 - 分组布局 */}
      {accountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto" onClick={() => setAccountModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-900">{accountModal === 'new' ? '添加 AWS 账号' : '编辑账号'}</h2>
              <button onClick={() => setAccountModal(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <section>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-200">基本信息</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>账号名称 *</label>
                    <input type="text" value={accountForm.name ?? ''} onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))} placeholder="用于显示的标识" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>账号ID</label>
                    <input type="text" value={accountForm.awsAccountId ?? ''} onChange={(e) => setAccountForm((f) => ({ ...f, awsAccountId: e.target.value }))} placeholder="AWS 12位账号ID" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>供应商</label>
                    <input type="text" value={accountForm.supplier ?? ''} onChange={(e) => setAccountForm((f) => ({ ...f, supplier: e.target.value }))} placeholder="如：AWS 官方" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>登录方式</label>
                    <input type="text" value={accountForm.loginMethod ?? ''} onChange={(e) => setAccountForm((f) => ({ ...f, loginMethod: e.target.value }))} placeholder="如：控制台、CLI、SSO" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>账号性质</label>
                    <input type="text" value={accountForm.accountType ?? ''} onChange={(e) => setAccountForm((f) => ({ ...f, accountType: e.target.value }))} placeholder="如：生产、测试、开发" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>操作状态</label>
                    <select value={(accountForm as { costQueryStatus?: string }).costQueryStatus ?? ''} onChange={(e) => setAccountForm((f) => ({ ...f, costQueryStatus: e.target.value }))} className={inputClass}>
                      {COST_QUERY_STATUS_OPTIONS.map((o) => (
                        <option key={o.value || '_'} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">需全量操作=代理+KEY 可执行完整操作；仅查询费用=仅用于每日费用拉取；准备停止使用=即将停用；停止使用=不再使用，排列表最下</p>
                  </div>
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-200">登录凭证</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>账号（登录用）</label>
                    <input type="text" value={accountForm.loginAccount ?? ''} onChange={(e) => setAccountForm((f) => ({ ...f, loginAccount: e.target.value }))} placeholder="邮箱/用户名" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>密码 {accountModal === 'edit' && '(留空不修改)'}</label>
                    <input type="password" value={accountForm.password ?? ''} onChange={(e) => setAccountForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Access Key ID</label>
                    <input type="text" value={accountForm.accessKeyId ?? ''} onChange={(e) => setAccountForm((f) => ({ ...f, accessKeyId: e.target.value }))} placeholder="AKIA..." className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Secret Access Key {accountModal === 'edit' && '(留空不修改)'}</label>
                    <input type="password" value={accountForm.secretAccessKey ?? ''} onChange={(e) => setAccountForm((f) => ({ ...f, secretAccessKey: e.target.value }))} placeholder="••••••••" className={inputClass} />
                  </div>
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-200">其他</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>代理</label>
                    <input type="text" value={accountForm.proxy ?? ''} onChange={(e) => setAccountForm((f) => ({ ...f, proxy: e.target.value }))} placeholder="代理地址" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>MFA</label>
                    <input type="text" value={accountForm.mfa ?? ''} onChange={(e) => setAccountForm((f) => ({ ...f, mfa: e.target.value }))} placeholder="MFA 设备/说明" className={inputClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>备注</label>
                    <textarea value={accountForm.notes ?? ''} onChange={(e) => setAccountForm((f) => ({ ...f, notes: e.target.value }))} placeholder="其他说明" rows={2} className={inputClass} />
                  </div>
                </div>
              </section>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-2">
              <button type="button" onClick={() => setAccountModal(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                取消
              </button>
              <button onClick={handleSaveAccount} disabled={accountSaving} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                {accountSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 费用弹窗：遮罩与内容改为兄弟节点，避免点击保存时事件冒泡到遮罩导致弹窗被关闭 */}
      {(costModal === 'new' || costModal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeCostModal} aria-hidden="true" />
          <div className="relative z-10 bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">{costModal === 'new' ? '添加费用' : '编辑费用'}</h2>
              <button onClick={closeCostModal} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={18} />
              </button>
            </div>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSaveCost(); }} noValidate>
              {costModal === 'new' && (
                <>
                  <div>
                    <label className={labelClass}>年月</label>
                    <div className="flex gap-2 mt-1">
                      <select value={costForm.year} onChange={(e) => setCostForm((f) => ({ ...f, year: parseInt(e.target.value, 10) }))} className={inputClass}>
                        {[year - 2, year - 1, year, year + 1].map((y) => (
                          <option key={y} value={y}>{y} 年</option>
                        ))}
                      </select>
                      <select value={costForm.month} onChange={(e) => setCostForm((f) => ({ ...f, month: parseInt(e.target.value, 10) }))} className={inputClass}>
                        {MONTHS.map((m) => (
                          <option key={m} value={m}>{m} 月</option>
                        ))}
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
                <label className={labelClass}>归属项目 <span className="text-slate-400 font-normal">（可选）</span></label>
                <select value={costForm.project ?? ''} onChange={(e) => setCostForm((f) => ({ ...f, project: e.target.value }))} className={inputClass}>
                  <option value="">选择项目（可选）</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                  {/* 当前值不在项目列表中时（如 AWS每日汇总）也显示为可选项 */}
                  {(costForm.project ?? '') && !projects.some((p) => p.name === (costForm.project ?? '')) && (
                    <option value={costForm.project ?? ''}>{costForm.project}</option>
                  )}
                </select>
              </div>
              <div>
                <label className={labelClass}>用途 <span className="text-slate-400 font-normal">（可选）</span></label>
                <input type="text" value={costForm.usage ?? ''} onChange={(e) => setCostForm((f) => ({ ...f, usage: e.target.value }))} placeholder="如：EC2、S3、RDS" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>费用 ($)</label>
                <input type="number" step="0.01" min="0" value={costForm.amount || ''} onChange={(e) => setCostForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} placeholder="0" className={inputClass} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeCostModal} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                  取消
                </button>
                <button
                  type="button"
                  disabled={costSaving}
                  onClick={handleSaveCost}
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {costSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal open={!!accountDeleteConfirm} title="确认删除账号" message={accountDeleteConfirm ? `确定删除账号「${accountDeleteConfirm.name}」？删除后该账号下的所有费用记录也会被删除。` : ''} onConfirm={doDeleteAccount} onCancel={() => setAccountDeleteConfirm(null)} />
      <ConfirmModal open={!!costDeleteConfirm} title="确认删除" message={costDeleteConfirm ? `确定删除该条费用记录？` : ''} onConfirm={doDeleteCost} onCancel={() => setCostDeleteConfirm(null)} />
    </div>
  );
}
