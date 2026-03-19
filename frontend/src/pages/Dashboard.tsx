import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ChevronLeft, ChevronRight, PieChart, BarChart3, TrendingUp, TrendingDown, Calendar, Layers, Activity, Download, BarChart2, Server } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import type { MonthlyStats } from '../types';
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  LabelList,
  Text,
} from 'recharts';

type CompareDimension = 'project' | 'group' | 'platform' | 'month';
type ChartType = 'pie' | 'bar' | 'line';

// Light mode chart colors (softer, professional palette)
const CHART_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#84cc16', // Lime
];

function escapeCsvCell(v: unknown): string {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const inputCls = 'px-2 py-1.5 rounded-lg border border-slate-300 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500';

function IdcAddRow({
  platformOptions,
  regionOptionsByPlatform,
  projects,
  onAdd,
  toast,
}: {
  platformOptions: string[];
  regionOptionsByPlatform: Record<string, string[]>;
  projects: { id: number; name: string }[];
  onAdd: (platform: string, region: string, project: string, cost: number) => void;
  toast: { error: (m: string) => void; success: (m: string) => void };
}) {
  const [platform, setPlatform] = useState('');
  const [region, setRegion] = useState('');
  const [project, setProject] = useState('');
  const [cost, setCost] = useState('');
  const [adding, setAdding] = useState(false);
  const regionOptions = regionOptionsByPlatform[platform] || [];
  useEffect(() => {
    if (platform && !regionOptions.includes(region)) setRegion('');
  }, [platform, regionOptions.join(','), region]);
  const handleAdd = async () => {
    if (!platform || !region || !project || parseFloat(cost) <= 0) {
      toast.error('请选择供应商、地区、归属项目并填写费用');
      return;
    }
    setAdding(true);
    try {
      await onAdd(platform, region, project, parseFloat(cost) || 0);
      setPlatform('');
      setRegion('');
      setProject('');
      setCost('');
      toast.success('已添加');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAdding(false);
    }
  };
  return (
    <tr className="bg-slate-50/50">
      <td className="px-6 py-3">
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls}>
          <option value="">选择供应商</option>
          {platformOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </td>
      <td className="px-6 py-3">
        <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls}>
          <option value="">选择地区</option>
          {(regionOptionsByPlatform[platform] || []).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </td>
      <td className="px-6 py-3">
        <select value={project} onChange={(e) => setProject(e.target.value)} className={inputCls}>
          <option value="">选择项目</option>
          {projects.map((p) => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
      </td>
      <td className="px-6 py-3">
        <input
          type="number"
          step="0.01"
          min="0"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="0"
          className={`w-24 ${inputCls} font-mono`}
        />
      </td>
      <td className="px-6 py-3">
        <button
          onClick={handleAdd}
          disabled={adding}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {adding ? '添加中...' : '添加'}
        </button>
      </td>
    </tr>
  );
}

function IdcRegionRow({
  platform,
  region,
  project,
  cost,
  projects,
  platformOptions,
  regionOptionsByPlatform,
  onSave,
  onDelete,
}: {
  platform: string;
  region: string;
  project: string;
  cost: number;
  projects: { id: number; name: string }[];
  platformOptions: string[];
  regionOptionsByPlatform: Record<string, string[]>;
  onSave: (platform: string, region: string, project: string, cost: number, originalKey?: { platform: string; region: string; project: string }) => void;
  onDelete: () => void;
}) {
  const [platformVal, setPlatformVal] = useState(platform || '');
  const [regionVal, setRegionVal] = useState(region || '');
  const [projectVal, setProjectVal] = useState(project || '');
  const [costVal, setCostVal] = useState(String(cost || ''));
  const [saving, setSaving] = useState(false);
  const regionOptions = regionOptionsByPlatform[platformVal] || [];
  useEffect(() => {
    setPlatformVal(platform || '');
    setRegionVal(region || '');
    setProjectVal(project || '');
    setCostVal(String(cost || ''));
  }, [platform, region, project, cost]);
  useEffect(() => {
    if (platformVal && !regionOptions.includes(regionVal)) setRegionVal('');
  }, [platformVal, regionOptions.join(','), regionVal]);
  const handleSave = async () => {
    setSaving(true);
    try {
      const orig = (platformVal !== platform || regionVal !== region || projectVal !== project)
        ? { platform, region, project }
        : undefined;
      await onSave(platformVal, regionVal, projectVal, parseFloat(costVal) || 0, orig);
    } finally {
      setSaving(false);
    }
  };
  return (
    <tr className="hover:bg-slate-50/80 transition-colors">
      <td className="px-6 py-3">
        <select value={platformVal} onChange={(e) => setPlatformVal(e.target.value)} className={inputCls}>
          <option value="">选择供应商</option>
          {platformOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </td>
      <td className="px-6 py-3">
        <select value={regionVal} onChange={(e) => setRegionVal(e.target.value)} className={inputCls}>
          <option value="">选择地区</option>
          {regionOptions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </td>
      <td className="px-6 py-3">
        <select value={projectVal} onChange={(e) => setProjectVal(e.target.value)} className={inputCls}>
          <option value="">选择项目</option>
          {projects.map((p) => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
      </td>
      <td className="px-6 py-3">
        <input
          type="number"
          step="0.01"
          min="0"
          value={costVal}
          onChange={(e) => setCostVal(e.target.value)}
          placeholder="0"
          className={`w-24 ${inputCls} font-mono`}
        />
      </td>
      <td className="px-6 py-3 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200"
        >
          删除
        </button>
      </td>
    </tr>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [multiMonth, setMultiMonth] = useState<{ label: string; total: number; byProject: Record<string, number>; byPlatform: Record<string, number> }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimension, setDimension] = useState<CompareDimension>('project');
  const [chartType, setChartType] = useState<ChartType>('pie');
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const [costBreakdown, setCostBreakdown] = useState<{
    rows: { project: string; type: string; platform: string; usage: string; note: string; quantity: number; currentCost: number; lastCost: number | null; change: number | null }[];
    totalCurrent: number;
    totalLast: number;
    totalChange: number | null;
    hasManualLast: boolean;
  } | null>(null);
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [showIdcSection, setShowIdcSection] = useState(true);
  const hasIdcCosts = (stats as { idcTotal?: number })?.idcTotal != null && (stats as { idcTotal?: number }).idcTotal! > 0;
  const hasIdcSuppliers = ((stats as { platformOptions?: string[] })?.platformOptions?.length ?? 0) > 0;
  useEffect(() => {
    if ((hasIdcCosts || hasIdcSuppliers) && !showIdcSection) setShowIdcSection(true);
  }, [hasIdcCosts, hasIdcSuppliers]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [idcDeleteConfirm, setIdcDeleteConfirm] = useState<{ platform: string; region: string; project: string } | null>(null);
  const toast = useToast();

  useEffect(() => {
    api.getGroups().then((g) => setGroups(g.map((x) => ({ id: x.id, name: x.name })))).catch(() => {});
    api.getProjects().then((p) => setProjects(p.map((x) => ({ id: x.id, name: x.name })))).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const groupIds = selectedGroupIds.length > 0 ? selectedGroupIds : undefined;
    let cancelled = false;
    Promise.all([
      api.getStats(year, month),
      api.getMultiMonthStats(year, month, 6),
      api.getCostBreakdown(year, month, groupIds),
    ])
      .then(([s, m, c]) => {
        if (cancelled) return;
        setStats(s as MonthlyStats);
        setMultiMonth(m);
        setCostBreakdown(c);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [year, month, selectedGroupIds.join(',')]);

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

  const handleExport = () => {
    if (!costBreakdown) return;
    const headers = ['项目', '类型', '供应商', '用途', '数量', '备注', `${month}月费用($)`, `${month === 1 ? 12 : month - 1}月费用($)`, '涨幅%'];
    const rows = costBreakdown.rows.map((r) => [
      r.project,
      r.type,
      r.platform,
      r.usage,
      r.quantity,
      r.note ?? '',
      r.currentCost.toFixed(2),
      (r.lastCost ?? 0).toFixed(2),
      r.change != null ? r.change.toFixed(2) : '',
    ]);
    const csv = [headers.map(escapeCsvCell).join(','), ...rows.map((row) => row.map(escapeCsvCell).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `费用明细_${year}年${month}月${selectedGroupIds.length > 0 ? '_筛选' : ''}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleGoAnalysis = () => {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (selectedGroupIds.length > 0) params.set('groupIds', selectedGroupIds.join(','));
    navigate(`/dashboard/analysis?${params.toString()}`);
  };

  const idcRegionCosts = (stats as { idcRegionCosts?: { platform: string; region: string; project: string; cost: number }[] })?.idcRegionCosts ?? [];
  const platformOptions = (stats as { platformOptions?: string[] })?.platformOptions ?? [];
  const regionOptionsByPlatform = (stats as { regionOptionsByPlatform?: Record<string, string[]> })?.regionOptionsByPlatform ?? {};

  const refreshStats = async () => {
    const [s, m, c] = await Promise.all([
      api.getStats(year, month),
      api.getMultiMonthStats(year, month, 6),
      api.getCostBreakdown(year, month, selectedGroupIds.length > 0 ? selectedGroupIds : undefined),
    ]);
    setStats(s as MonthlyStats);
    setMultiMonth(m);
    setCostBreakdown(c);
  };

  const handleSaveIdcRegionCost = async (
    platform: string,
    region: string,
    project: string,
    cost: number,
    originalKey?: { platform: string; region: string; project: string },
  ) => {
    try {
      if (originalKey && (originalKey.platform !== platform || originalKey.region !== region || originalKey.project !== project)) {
        await api.deleteIdcRegionCost(year, month, originalKey.platform, originalKey.region, originalKey.project);
      }
      await api.saveIdcRegionCost(year, month, platform, region, project, cost);
      await refreshStats();
      toast.success('已保存');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDeleteIdcRegionCost = (platform: string, region: string, project: string) => {
    setIdcDeleteConfirm({ platform, region, project });
  };
  const doDeleteIdcRegionCost = async () => {
    if (!idcDeleteConfirm) return;
    try {
      await api.deleteIdcRegionCost(year, month, idcDeleteConfirm.platform, idcDeleteConfirm.region, idcDeleteConfirm.project);
      await refreshStats();
      setIdcDeleteConfirm(null);
      toast.success('已删除');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const chartData =
    dimension === 'month'
      ? multiMonth.map((m) => ({
          name: m.label,
          总费用: m.total,
          ...m.byProject,
          ...((m as { byGroup?: Record<string, number> }).byGroup || {}),
          ...m.byPlatform,
        }))
      : dimension === 'group'
        ? ((stats as { totalByGroup?: { name: string; amount: number }[] })?.totalByGroup?.map((x, i) => ({
            name: x.name,
            费用: x.amount,
            fill: CHART_COLORS[i % CHART_COLORS.length],
          })) ?? [])
        : dimension === 'project'
          ? (stats?.totalByProject.map((x, i) => ({ name: x.name, 费用: x.amount, fill: CHART_COLORS[i % CHART_COLORS.length] })) ?? [])
          : (stats?.totalByPlatform.map((x, i) => ({ name: x.name, 费用: x.amount, fill: CHART_COLORS[i % CHART_COLORS.length] })) ?? []);

  const monthLineData = multiMonth.map((m) => ({
    name: m.label,
    总费用: m.total,
  }));

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-2xl font-bold text-slate-900 tracking-tight">费用看板</h1>
           <p className="text-slate-500 text-sm mt-1">实时监控每月服务器支出趋势与详细构成</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center">
            <Calendar size={18} className="text-indigo-500" />
            <span className="font-semibold text-slate-700">
              {year} 年 {month} 月
            </span>
          </div>
            <button
              onClick={nextMonth}
              disabled={!canNext}
              className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          {costBreakdown && (
            <>
              <button
                onClick={() => setShowIdcSection((v) => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                  showIdcSection
                    ? 'bg-amber-100 border-amber-300 text-amber-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <Server size={18} />
                {showIdcSection ? '收起 IDC 费用' : '添加 IDC 费用'}
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors text-sm font-medium"
              >
                <Download size={18} />
                导出数据
              </button>
              <button
                onClick={handleGoAnalysis}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm font-medium shadow-md shadow-indigo-100"
              >
                <BarChart2 size={18} />
                智能分析
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-32 text-slate-500 gap-4">
           <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
           <p className="text-sm font-medium">计算费用数据中...</p>
        </div>
      )}
      
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 px-6 py-4 flex items-center gap-3 shadow-sm">
           <Activity size={18} />
           {error}
        </div>
      )}

      {!loading && !error && stats && (
        <>
          {/* Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="col-span-1 md:col-span-3 lg:col-span-1 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                <div className="relative z-10">
                   <div className="flex items-center gap-2 text-indigo-100 mb-1">
                     <DollarSign size={18} />
                     <span className="text-sm font-medium opacity-90">当月总支出</span>
                   </div>
                   <div className="flex items-baseline gap-1 mt-2">
                     <span className="text-4xl font-bold tracking-tight">$</span>
                     <span className="text-5xl font-bold tracking-tight">{stats.total.toFixed(2)}</span>
                   </div>
                   <div className="mt-4 flex items-center gap-2 text-sm text-indigo-100/80 bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      服务器 + IDC + AWS + 域名
                   </div>
                   {(((stats as { totalSingle?: number }).totalSingle != null || (stats as { totalShared?: number }).totalShared != null) || (stats as { serverTotal?: number }).serverTotal != null || (stats as { idcTotal?: number }).idcTotal != null || (stats as { awsTotal?: number }).awsTotal != null || (stats as { domainTotal?: number }).domainTotal != null) && (
                     <div className="mt-3 flex flex-wrap gap-3 text-sm text-indigo-100/90">
                       {(stats as { serverTotal?: number }).serverTotal != null && (
                         <span>服务器: $ {((stats as { serverTotal?: number }).serverTotal ?? 0).toFixed(2)}</span>
                       )}
                       {(stats as { idcTotal?: number }).idcTotal != null && (stats as { idcTotal?: number }).idcTotal! > 0 && (
                         <span>IDC: $ {((stats as { idcTotal?: number }).idcTotal ?? 0).toFixed(2)}</span>
                       )}
                       {(stats as { awsTotal?: number }).awsTotal != null && (stats as { awsTotal?: number }).awsTotal! > 0 && (
                         <span>AWS: $ {((stats as { awsTotal?: number }).awsTotal ?? 0).toFixed(2)}</span>
                       )}
                       {(stats as { domainTotal?: number }).domainTotal != null && (stats as { domainTotal?: number }).domainTotal! > 0 && (
                         <span>域名: $ {((stats as { domainTotal?: number }).domainTotal ?? 0).toFixed(2)}</span>
                       )}
                       {((stats as { totalSingle?: number }).totalSingle != null || (stats as { totalShared?: number }).totalShared != null) && (stats as { serverTotal?: number }).serverTotal == null && (
                         <>
                           <span>单独: $ {((stats as { totalSingle?: number }).totalSingle ?? 0).toFixed(2)}</span>
                           <span>共用: $ {((stats as { totalShared?: number }).totalShared ?? 0).toFixed(2)}</span>
                         </>
                       )}
                     </div>
                   )}
                </div>
             </div>
             
             {/* Chart Card */}
             <div className="col-span-1 md:col-span-3 lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                   <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                        <PieChart size={18} />
                      </div>
                      <h2 className="font-semibold text-slate-800">支出分布</h2>
                   </div>
                   
                   <div className="flex flex-wrap gap-2">
                      <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100">
                        {[
                          { v: 'group' as const, l: '分组' },
                          { v: 'project' as const, l: '项目' },
                          { v: 'platform' as const, l: '平台' },
                          { v: 'month' as const, l: '趋势' },
                        ].map(({ v, l }) => (
                          <button
                            key={v}
                            onClick={() => setDimension(v)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                              dimension === v ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      
                      {dimension !== 'month' && (
                        <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100">
                          {[
                            { v: 'pie' as const, Icon: PieChart },
                            { v: 'bar' as const, Icon: BarChart3 },
                          ].map(({ v, Icon }) => (
                            <button
                              key={v}
                              onClick={() => setChartType(v)}
                              className={`p-1.5 rounded-md text-xs font-medium transition-all ${
                                chartType === v ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              <Icon size={14} />
                            </button>
                          ))}
                        </div>
                      )}
                   </div>
                </div>

                {dimension === 'month' ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthLineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                        <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          itemStyle={{ color: '#6366f1', fontWeight: 600 }}
                          formatter={(v: number) => [`$ ${v.toFixed(2)}`, '总费用']}
                        />
                        <Line type="monotone" dataKey="总费用" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', strokeWidth: 2, r: 4, stroke: '#fff' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : chartType === 'pie' ? (
                  <div className="h-80 flex items-center justify-between px-4">
                    {chartData.length === 0 ? (
                      <div className="text-slate-400 text-sm w-full text-center">暂无分布数据</div>
                    ) : (
                      <>
                        {/* Left: Interactive Donut Chart */}
                        <div className="w-1/2 h-full relative flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsPie>
                              <Pie
                                data={chartData}
                                dataKey="费用"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={2}
                                isAnimationActive={true}
                                animationDuration={800}
                                onMouseEnter={(_, index) => setActiveIndex(index)}
                                onMouseLeave={() => setActiveIndex(undefined)}
                              >
                                {chartData.map((_, i) => (
                                  <Cell 
                                    key={i} 
                                    fill={CHART_COLORS[i % CHART_COLORS.length]} 
                                    stroke="transparent"
                                    opacity={activeIndex === undefined || activeIndex === i ? 1 : 0.3}
                                    className="transition-opacity duration-300"
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number, name: string) => [`$ ${Number(value).toFixed(2)}`, name || '']}
                              />
                            </RechartsPie>
                          </ResponsiveContainer>
                          {/* Center Text */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-slate-400 text-xs font-medium mb-1">
                              {activeIndex !== undefined ? chartData[activeIndex].name : '总支出'}
                            </span>
                            <span className="text-slate-800 text-xl font-bold font-mono">
                              ${activeIndex !== undefined 
                                ? ((chartData[activeIndex] as { 费用?: number; 总费用?: number }).费用 ?? (chartData[activeIndex] as { 总费用?: number }).总费用 ?? 0).toFixed(2)
                                : chartData.reduce((s, d) => s + ((d as { 费用?: number; 总费用?: number }).费用 ?? (d as { 总费用?: number }).总费用 ?? 0), 0).toFixed(2)
                              }
                            </span>
                          </div>
                        </div>

                        {/* Right: Detailed List */}
                        <div className="w-1/2 pl-4 h-64 overflow-y-auto pr-2 custom-scrollbar">
                          <div className="flex flex-col gap-2">
                            {chartData.map((item, i) => {
                              const d = item as { 费用?: number; 总费用?: number };
                              const val = d.费用 ?? d.总费用 ?? 0;
                              const total = chartData.reduce((s, x) => s + ((x as { 费用?: number; 总费用?: number }).费用 ?? (x as { 总费用?: number }).总费用 ?? 0), 0);
                              const percent = total > 0 ? (val / total) * 100 : 0;
                              
                              return (
                                <div 
                                  key={i}
                                  onMouseEnter={() => setActiveIndex(i)}
                                  onMouseLeave={() => setActiveIndex(undefined)}
                                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                                    activeIndex === i 
                                      ? 'bg-slate-50 border-slate-200 shadow-sm scale-[1.02]' 
                                      : 'bg-transparent border-transparent hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div 
                                      className="w-3 h-3 rounded-full flex-shrink-0" 
                                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                                    />
                                    <span className={`text-sm truncate font-medium ${activeIndex === i ? 'text-slate-900' : 'text-slate-600'}`}>
                                      {item.name || '其他'}
                                    </span>
                                  </div>
                                  <div className="flex flex-col items-end flex-shrink-0 ml-2">
                                    <span className="text-sm font-bold text-slate-700 font-mono">
                                      ${val.toFixed(2)}
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium">
                                      {percent.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="min-h-64" style={{ height: Math.max(256, Math.min(480, chartData.length * 32)) }}>
                    {chartData.length === 0 ? (
                      <div className="text-slate-400 text-sm flex items-center justify-center h-full">暂无分布数据</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 80, top: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                          <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={140} tickLine={false} axisLine={false} />
                          <Tooltip
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(v: number) => [`$ ${v.toFixed(2)}`, '']}
                          />
                          <Bar dataKey="费用" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}>
                             <LabelList
                              dataKey="费用"
                              position="right"
                              content={(props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: unknown }) => {
                                const { x = 0, y = 0, width = 0, height = 0, value } = props;
                                const val = typeof value === 'number' ? value : Number(value) || 0;
                                const barEndX = Number(x) + Number(width);
                                return (
                                  <g>
                                    <text x={barEndX + 8} y={Number(y) + Number(height) / 2} fill="#475569" fontSize={11} fontWeight={600} textAnchor="start" dominantBaseline="middle">
                                      {`$${val.toFixed(2)}`}
                                    </text>
                                  </g>
                                );
                              }}
                            />
                             {chartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                             ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
             </div>
          </div>

          {/* IDC 费用：供应商、地区、归属项目、费用 */}
          {showIdcSection && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                    <Server size={18} />
                  </div>
                  <h2 className="font-semibold text-slate-800">IDC 费用</h2>
                  <span className="text-xs text-slate-500">选择供应商和地区，填写归属项目与费用</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">供应商</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">地区</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">归属项目</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[100px]">费用 ($)</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {idcRegionCosts.map((c) => (
                      <IdcRegionRow
                        key={`${c.platform}::${c.region}::${c.project}`}
                        platform={c.platform}
                        region={c.region}
                        project={c.project}
                        cost={c.cost}
                        projects={projects}
                        platformOptions={platformOptions}
                        regionOptionsByPlatform={regionOptionsByPlatform}
                        onSave={(plat, reg, proj, cost, orig) => handleSaveIdcRegionCost(plat, reg, proj, cost, orig)}
                        onDelete={() => handleDeleteIdcRegionCost(c.platform, c.region, c.project)}
                      />
                    ))}
                    <IdcAddRow
                      platformOptions={platformOptions}
                      regionOptionsByPlatform={regionOptionsByPlatform}
                      projects={projects}
                      onAdd={handleSaveIdcRegionCost}
                      toast={toast}
                    />
                  </tbody>
                </table>
              </div>
              {platformOptions.length === 0 && Object.keys(regionOptionsByPlatform).length === 0 && (
                <div className="px-6 py-4 text-center text-slate-500 text-sm">
                  请先在「平台管理」添加供应商，并在「IDC 登记」中添加地区
                </div>
              )}
            </div>
          )}

          {/* Breakdown Table */}
          {costBreakdown && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                <div className="flex flex-wrap items-center gap-3">
                   <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                      <Layers size={18} />
                   </div>
                   <h2 className="font-semibold text-slate-800">
                     {selectedGroupIds.length === 0
                       ? '全部详细费用'
                       : selectedGroupIds.length === 1
                         ? (() => {
                             const n = groups.find((g) => g.id === selectedGroupIds[0])?.name ?? '';
                             return (n.endsWith('组') ? n : n + '组') + '详细费用';
                           })()
                         : selectedGroupIds.map((id) => groups.find((g) => g.id === id)?.name ?? '').filter(Boolean).map((n) => n.endsWith('组') ? n : n + '组').join('+') + ' 详细费用'}
                   </h2>
                   <div className="flex flex-wrap items-center gap-2">
                     <button
                       type="button"
                       onClick={() => setSelectedGroupIds([])}
                       className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                         selectedGroupIds.length === 0
                           ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                           : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                       }`}
                     >
                       全部
                     </button>
                     {groups.map((g) => (
                       <label
                         key={g.id}
                         className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all border ${
                           selectedGroupIds.includes(g.id)
                             ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                             : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                         }`}
                       >
                         <input
                           type="checkbox"
                           checked={selectedGroupIds.includes(g.id)}
                           onChange={(e) => {
                             if (e.target.checked) {
                               setSelectedGroupIds((prev) => [...prev, g.id]);
                             } else {
                               setSelectedGroupIds((prev) => prev.filter((id) => id !== g.id));
                             }
                           }}
                           className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                         />
                         {g.name.endsWith('组') ? g.name : g.name + '组'}
                       </label>
                     ))}
                   </div>
                   {(costBreakdown as unknown as { filterProjectNames?: string[] | null })?.filterProjectNames && selectedGroupIds.length > 0 && (
                     <p className="text-xs text-slate-500 mt-2">
                       当前筛选包含的项目：{((costBreakdown as Record<string, unknown>).filterProjectNames as string[] | undefined)?.join('、') ?? ''}
                       （若项目归属有误，请到「项目管理」中调整项目所属分组）
                     </p>
                   )}
                </div>
                
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24 text-center">项目</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20 whitespace-nowrap">类型</th>
                      <th className="pl-8 pr-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">供应商</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center w-16">数量</th>
                      <th className="pl-8 pr-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">用途</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[120px]">备注</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">{String(month).padStart(2, '0')}月费用</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">{String(month === 1 ? 12 : month - 1).padStart(2, '0')}月费用</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right w-24">涨幅</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const projectGroups = costBreakdown.rows.reduce<Record<string, typeof costBreakdown.rows>>((acc, r) => {
                        if (!acc[r.project]) acc[r.project] = [];
                        acc[r.project].push(r);
                        return acc;
                      }, {});
                      const projectOrder = [...new Set(costBreakdown.rows.map((r) => r.project))];
                      const rows: JSX.Element[] = [];
                      projectOrder.forEach((proj, projIdx) => {
                        const groupRows = projectGroups[proj] || [];
                        const vendorGroups = groupRows.reduce<Record<string, typeof costBreakdown.rows>>((acc, r) => {
                          if (!acc[r.platform]) acc[r.platform] = [];
                          acc[r.platform].push(r);
                          return acc;
                        }, {});
                        const vendorOrder = [...new Set(groupRows.map((r) => r.platform))];
                        const projectRowCount = vendorOrder.reduce((s, v) => s + vendorGroups[v].length + 1, 0);
                        let isFirstInProject = true;
                        vendorOrder.forEach((vendor) => {
                          const vendorRows = vendorGroups[vendor] || [];
                          vendorRows.forEach((r) => {
                            const key = `${r.project}::${r.platform}::${r.usage}`;
                            const lastVal = r.lastCost ?? 0;
                            const change = lastVal > 0
                              ? ((r.currentCost - lastVal) / lastVal) * 100
                              : null;
                            const isProjectBoundary = projIdx > 0 && isFirstInProject;
                            const topBorderClass = isProjectBoundary ? 'border-t-4 border-t-slate-600' : '';
                            rows.push(
                              <tr key={key} className="hover:bg-slate-50/80 transition-colors group">
                                {isFirstInProject && (
                                  <td rowSpan={projectRowCount} className={`px-6 py-4 text-sm font-semibold text-slate-800 text-center align-middle border-r border-slate-100 ${topBorderClass}`}>
                                    {proj}
                                  </td>
                                )}
                                <td className={`px-6 py-4 text-sm text-slate-600 whitespace-nowrap ${topBorderClass}`}>{r.type}</td>
                                <td className={`pl-8 pr-6 py-4 text-sm text-slate-600 ${topBorderClass}`}>{r.platform}</td>
                                <td className={`px-6 py-4 text-sm text-slate-600 text-center ${topBorderClass}`}>
                                  {r.quantity > 0 ? <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">{r.quantity}</span> : '-'}
                                </td>
                                <td className={`pl-8 pr-6 py-4 text-sm text-slate-600 ${topBorderClass}`}>{r.usage}</td>
                                <td className={`px-6 py-4 text-sm text-slate-500 max-w-[180px] truncate ${topBorderClass}`} title={r.note}>{r.note || '-'}</td>
                                <td className={`px-6 py-4 text-sm font-bold text-slate-800 text-right font-mono ${topBorderClass}`}>$ {r.currentCost.toFixed(2)}</td>
                                <td className={`px-6 py-4 text-sm text-slate-500 font-mono text-right ${topBorderClass}`}>$ {lastVal.toFixed(2)}</td>
                                <td className={`px-6 py-4 text-right ${topBorderClass}`}>
                                  {change != null ? (
                                    <span className={`text-sm font-semibold ${
                                      change > 0 ? 'text-red-600' : change < 0 ? 'text-emerald-600' : 'text-slate-600'
                                    }`}>
                                      {change > 0 ? '+' : ''}{change.toFixed(2)}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">/</span>
                                  )}
                                </td>
                              </tr>
                            );
                            isFirstInProject = false;
                          });
                          const subtotalCurrent = vendorRows.reduce((s, r) => s + r.currentCost, 0);
                          const subtotalLast = vendorRows.reduce((s, r) => s + (r.lastCost ?? 0), 0);
                          const subtotalChange = subtotalLast > 0 ? ((subtotalCurrent - subtotalLast) / subtotalLast) * 100 : null;
                          rows.push(
                            <tr key={`sub-${proj}-${vendor}`} className="bg-indigo-50/80 border-t border-indigo-100">
                              <td className="px-6 py-3 text-sm font-semibold text-indigo-700 italic" colSpan={2}>{vendor} 小计</td>
                              <td className="px-6 py-3 bg-indigo-50/80" colSpan={3} />
                              <td className="px-6 py-3 text-sm font-bold text-indigo-700 text-right font-mono bg-indigo-50/80">$ {subtotalCurrent.toFixed(2)}</td>
                              <td className="px-6 py-3 text-sm font-medium text-indigo-600 text-right font-mono bg-indigo-50/80">$ {subtotalLast.toFixed(2)}</td>
                              <td className="px-6 py-3 text-right bg-indigo-50/80">
                                {subtotalChange != null ? (
                                  <span className={`text-sm font-semibold ${subtotalChange > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {subtotalChange > 0 ? '+' : ''}{subtotalChange.toFixed(2)}%
                                  </span>
                                ) : (
                                  <span className="text-slate-400">/</span>
                                )}
                              </td>
                            </tr>
                          );
                          isFirstInProject = false;
                        });
                      });
                      return rows;
                    })()}
                    {/* Total Row */}
                    <tr className="bg-slate-50/80 font-bold border-t-2 border-slate-200">
                      <td colSpan={6} className="px-6 py-4 text-slate-800 text-right">总计</td>
                      <td className="px-6 py-4 text-right text-indigo-700 text-base font-mono">$ {costBreakdown.totalCurrent.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-slate-500 font-mono text-sm">
                        $ {costBreakdown.rows.reduce((s, r) => s + (r.lastCost ?? 0), 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(() => {
                          const totalLast = costBreakdown.rows.reduce((s, r) => s + (r.lastCost ?? 0), 0);
                          const ch = totalLast > 0 ? ((costBreakdown.totalCurrent - totalLast) / totalLast) * 100 : null;
                          return ch != null ? (
                            <span className={`text-sm font-bold ${ch > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {ch > 0 ? '+' : ''}{ch.toFixed(2)}%
                            </span>
                          ) : <span className="text-slate-400">/</span>;
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {costBreakdown.rows.length === 0 && (
                <div className="px-6 py-12 text-center text-slate-400 bg-slate-50/30">
                  暂无数据，请先在服务器列表中添加资源并填写用途
                </div>
              )}
            </div>
          )}

          {/* Grouped Lists (Grid) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GroupedList title="按分组汇总" data={(stats as any).byGroupAndProject?.map((g: any) => ({ 
                name: g.groupName, 
                value: g.total, 
                subItems: g.projects.map((p: any) => ({ name: p.name, value: p.amount })) 
            })) || []} />
            
            <GroupedList title="按项目汇总" data={stats.totalByProject.map(p => ({ name: p.name, value: p.amount }))} />
            
            <GroupedList title="按平台汇总" data={stats.totalByPlatform.map(p => ({ name: p.name, value: p.amount }))} />
          </div>
        </>
      )}

      <ConfirmModal
        open={!!idcDeleteConfirm}
        title="删除 IDC 费用"
        message="确定删除这条 IDC 费用？"
        confirmLabel="删除"
        variant="danger"
        onConfirm={doDeleteIdcRegionCost}
        onCancel={() => setIdcDeleteConfirm(null)}
      />
    </div>
  );
}

// Helper Component for Grouped Lists
function GroupedList({ title, data }: { title: string, data: { name: string, value: number, subItems?: { name: string, value: number }[] }[] }) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">{title}</h3>
            </div>
            <div className="flex-1 overflow-auto max-h-80 scrollbar-thin scrollbar-thumb-slate-200">
                {data.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">暂无数据</div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {data.map((item, i) => (
                            <div key={i} className="group hover:bg-slate-50/50 transition-colors">
                                <div className="px-5 py-3 flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                                    <span className="text-sm font-bold text-indigo-600 font-mono">$ {item.value.toFixed(2)}</span>
                                </div>
                                {item.subItems && (
                                    <div className="bg-slate-50/50 px-5 py-2 space-y-2 border-t border-slate-100/50">
                                        {item.subItems.map((sub, j) => (
                                            <div key={j} className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500 pl-2 border-l-2 border-slate-200">{sub.name}</span>
                                                <span className="text-slate-600 font-medium">$ {sub.value.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
