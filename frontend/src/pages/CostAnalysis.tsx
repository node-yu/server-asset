import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertCircle,
  DollarSign,
  Layers,
  Building2,
  Server,
  Activity,
  Zap,
} from 'lucide-react';
import { api } from '../api';
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
} from 'recharts';

const CHART_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16',
];

const LABEL_HORIZONTAL = 20;
const MIN_GAP = 18; // 最小垂直间距

/** 计算并调整标签位置，进行碰撞检测 */
function calculateLabelLayout(data: { name: string; value: number }[], total: number, cx: number, cy: number, outerRadius: number) {
  if (total <= 0) return new Map();
  
  let cum = 0;
  // 1. 初步计算每个标签的理想位置
  const items = data.map((d) => {
    // Recharts 默认: 0度(3点钟)，逆时针
    const midAngle = (cum + d.value / 2) * 360 / total;
    cum += d.value;
    const rad = -midAngle * (Math.PI / 180);
    
    const percent = d.value / total;
    // 大扇区缩短，小扇区伸长
    const extend = percent > 0.2 ? 10 : percent < 0.05 ? 35 : 20;
    
    const x1 = cx + outerRadius * Math.cos(rad);
    const y1 = cy + outerRadius * Math.sin(rad);
    
    const x2 = cx + (outerRadius + extend) * Math.cos(rad);
    const y2 = cy + (outerRadius + extend) * Math.sin(rad);
    
    const isRight = Math.cos(rad) >= 0;
    
    return { name: d.name, percent, midAngle, x1, y1, x2, y2, isRight, finalY: y2 };
  });

  // 2. 分左右两侧分别处理碰撞
  const leftItems = items.filter(d => !d.isRight).sort((a, b) => a.y2 - b.y2);
  const rightItems = items.filter(d => d.isRight).sort((a, b) => a.y2 - b.y2);

  const resolveCollision = (list: typeof items) => {
    // 从上往下扫，推开重叠的
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const curr = list[i];
      if (curr.finalY - prev.finalY < MIN_GAP) {
        curr.finalY = prev.finalY + MIN_GAP;
      }
    }
    // 整体居中调整：如果整体偏下，往上挪
    if (list.length > 0) {
      // 这里可以根据容器高度做限制，暂且假设容器够大
      // 简单策略：如果最上面的点跑太高了，整体下移；反之亦然。
      // 但其实 PieChart 是居中的，我们只要保证相对间距即可。
      // 为防止单向推挤导致整体偏移太大，可以再做一次反向修正（从下往上扫）
    }
  };

  resolveCollision(leftItems);
  resolveCollision(rightItems);

  // 3. 构建结果 Map
  const result = new Map<string, { x1: number, y1: number, x2: number, y2: number, x3: number, textAnchor: string }>();
  
  [...leftItems, ...rightItems].forEach(item => {
    const dir = item.isRight ? 1 : -1;
    // x2 需要根据 finalY 重新计算吗？
    // 为了保持斜率不至于太离谱，我们保持 x2 不变，只改 y2 (即垂直拉伸引导线)
    // 或者，我们可以让 x2 也稍微随角度变化，但这里简单起见，只改 y 作为折点
    
    // 修正：引导线的折点 (bx, by)
    // 之前逻辑是：M x1,y1 -> L x2,y2 -> L x3,y2
    // 现在 y2 变成了 finalY
    
    const bx = item.x2; 
    const by = item.finalY;
    const x3 = bx + dir * LABEL_HORIZONTAL;

    result.set(item.name, {
      x1: item.x1,
      y1: item.y1,
      x2: bx,
      y2: by,
      x3,
      textAnchor: item.isRight ? 'start' : 'end'
    });
  });
  
  return result;
}

/** 饼图引导线组件 */
function PieLabelPercent(props: {
  cx?: number;
  cy?: number;
  name?: string;
  percent?: number;
  fill?: string;
  payload?: { name?: string; fill?: string };
  layoutMap?: Map<string, { x1: number, y1: number, x2: number, y2: number, x3: number, textAnchor: string }>;
}) {
  const { cx = 0, cy = 0, name = '', percent = 0, fill, payload, layoutMap } = props;
  const segmentColor = fill || payload?.fill || '#64748b';
  const layout = layoutMap?.get(payload?.name ?? name);
  
  if (!layout) return null;

  // 布局坐标是相对圆心(0,0)计算的，需加上实际 cx,cy 得到正确位置
  const x1 = layout.x1 + cx;
  const y1 = layout.y1 + cy;
  const x2 = layout.x2 + cx;
  const y2 = layout.y2 + cy;
  const x3 = layout.x3 + cx;
  const dx = layout.textAnchor === 'start' ? 6 : -6;
  const path = `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y2}`;
  const textAnchor = (layout.textAnchor === 'start' || layout.textAnchor === 'end' ? layout.textAnchor : 'end') as 'start' | 'end';

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={segmentColor}
        strokeWidth={1.2}
        strokeOpacity={0.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x={x3} y={y2} textAnchor={textAnchor as 'start' | 'end'} dx={dx} dy={4} fontSize={11} fill={segmentColor} fontWeight={600}>
        {(percent * 100).toFixed(1)}%
      </text>
    </g>
  );
}

/** 饼图下方图例：色块 + 名称，紧凑布局 */
function PieLegend({ data }: { data: { name: string; value: number; fill: string }[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
          <span className="text-xs text-slate-600">{d.name}</span>
        </div>
      ))}
    </div>
  );
}

export default function CostAnalysis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);
  const groupIdsParam = searchParams.get('groupIds');
  const groupIds = groupIdsParam ? groupIdsParam.split(',').map(Number).filter(Boolean) : undefined;
  const selectedGroupIds = groupIds ?? [];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    totalByProject: { name: string; amount: number }[];
    totalByPlatform: { name: string; amount: number }[];
  } | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<{
    rows: { project: string; type: string; platform: string; usage: string; quantity: number; currentCost: number; lastCost: number | null; change: number | null }[];
    totalCurrent: number;
    totalLast: number;
    totalChange: number | null;
  } | null>(null);
  const [multiMonth, setMultiMonth] = useState<{
    label: string;
    total: number;
  }[]>([]);
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    api.getGroups().then((g) => setGroups(g.map((x) => ({ id: x.id, name: x.name })))).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    let cancelled = false;
    Promise.all([
      api.getStats(year, month),
      api.getCostBreakdown(year, month, groupIds?.length ? groupIds : undefined),
      api.getMultiMonthStats(year, month, 6),
    ])
      .then(([s, c, m]) => {
        if (cancelled) return;
        setStats(s);
        setCostBreakdown(c);
        setMultiMonth(m);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [year, month, groupIds?.join(',')]);

  const filterLabel = groupIds?.length
    ? groups.filter((g) => groupIds.includes(g.id)).map((g) => g.name).join('、') || '已筛选'
    : null;

  const updateGroupFilter = (ids: number[]) => {
    const next = new URLSearchParams(searchParams);
    if (ids.length === 0) {
      next.delete('groupIds');
    } else {
      next.set('groupIds', ids.join(','));
    }
    setSearchParams(next, { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500 gap-4">
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm font-medium">正在生成全维分析报告...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-[1400px] mx-auto">
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-600 px-6 py-4 flex items-center gap-3">
          <AlertCircle size={20} />
          {error}
        </div>
        <Link to="/" className="inline-flex items-center gap-2 mt-4 text-indigo-600 hover:text-indigo-700 font-medium">
          <ArrowLeft size={18} /> 返回费用看板
        </Link>
      </div>
    );
  }

  // --- 数据聚合逻辑 ---

  const total = costBreakdown?.totalCurrent ?? stats?.total ?? 0;
  const lastTotal = costBreakdown?.totalLast ?? 0;
  const change = costBreakdown?.totalChange;
  const hasChange = change != null && lastTotal > 0;
  const rows = costBreakdown?.rows || [];

  // 1. 项目与平台聚合 (考虑筛选)
  const byProject = (() => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.project, (map.get(r.project) ?? 0) + r.currentCost));
    return Array.from(map.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  })();

  const byPlatform = (() => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.platform, (map.get(r.platform) ?? 0) + r.currentCost));
    return Array.from(map.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  })();

  // 2. 用途分布 (Usage)
  const byUsage = (() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      // 简单归类：取 Usage 的第一部分或直接使用
      const key = (r.usage || '未标记').split('-')[0].trim(); 
      map.set(key, (map.get(key) ?? 0) + r.currentCost);
    });
    return Array.from(map.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  })();

  // 3. 涨跌幅排行
  const growthTop = rows
    .filter((r) => (r.lastCost ?? 0) > 0 && (r.change ?? 0) > 0)
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
    .slice(0, 5);
  
  const dropTop = rows
    .filter((r) => (r.lastCost ?? 0) > 0 && (r.change ?? 0) < 0)
    .sort((a, b) => (a.change ?? 0) - (b.change ?? 0)) // 负数越小跌幅越大
    .slice(0, 5);

  // 4. 服务器数量与平均单价
  const serverCount = rows.reduce((acc, r) => acc + (r.quantity || 1), 0);
  const avgCost = serverCount > 0 ? total / serverCount : 0;

  // Chart Data
  const trendData = multiMonth.map((m) => ({ name: m.label, 总费用: m.total }));
  const projectPieData = byProject.map((x, i) => ({ name: x.name, value: x.amount, fill: CHART_COLORS[i % CHART_COLORS.length] }));
  const usagePieData = byUsage.map((x, i) => ({ name: x.name, value: x.amount, fill: CHART_COLORS[(i + 2) % CHART_COLORS.length] }));
  const projectTotal = projectPieData.reduce((s, d) => s + d.value, 0);
  const usageTotal = usagePieData.reduce((s, d) => s + d.value, 0);
  
  // 预计算布局，假设圆心在 (0,0)，半径95。实际渲染时加上真实 cx, cy
  const projectLayout = calculateLabelLayout(projectPieData, projectTotal, 0, 0, 95);
  const usageLayout = calculateLabelLayout(usagePieData, usageTotal, 0, 0, 95);

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 bg-slate-50/50 min-h-screen">
      {/* 顶部导航 */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors p-2 hover:bg-white rounded-lg">
              <ArrowLeft size={20} />
              <span className="text-sm font-medium">返回</span>
            </Link>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
                <Activity size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">智能费用分析</h1>
                <p className="text-xs text-slate-500">
                  {year}年{month}月 {filterLabel ? `· ${filterLabel}` : '· 全量数据'}
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* 项目组筛选 */}
        <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-sm font-medium text-slate-600 shrink-0">项目组：</span>
          <button
            type="button"
            onClick={() => updateGroupFilter([])}
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
                    updateGroupFilter([...selectedGroupIds, g.id]);
                  } else {
                    updateGroupFilter(selectedGroupIds.filter((id) => id !== g.id));
                  }
                }}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              {g.name.endsWith('组') ? g.name : g.name + '组'}
            </label>
          ))}
        </div>
      </div>

      {/* KPI 卡片组 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={`${year}年${month}月总支出`}
          value={`$${total.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          trend={hasChange ? change : null}
          trendLabel="环比"
          color="indigo"
        />
        <KpiCard
          title={`${month === 1 ? year - 1 : year}年${month === 1 ? 12 : month - 1}月支出`}
          value={`$${lastTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
          icon={Calendar}
          subValue="历史对比"
          color="slate"
        />
        <KpiCard
          title="资源实例数"
          value={serverCount}
          icon={Server}
          subValue="台服务器"
          color="emerald"
        />
        <KpiCard
          title="平均单机成本"
          value={`$${avgCost.toFixed(2)}`}
          icon={Zap}
          subValue="/ 台"
          color="amber"
        />
      </div>

      {/* 核心分析区域：趋势 + 摘要 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 趋势图 */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp size={18} className="text-indigo-600" />
              近半年费用趋势
            </h3>
            {filterLabel && <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">注：趋势图显示全量数据</span>}
          </div>
          <div className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(v: number) => [`$${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`, '总费用']}
                />
                <Line type="monotone" dataKey="总费用" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 智能洞察 */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2 relative z-10">
            <Activity size={20} />
            智能洞察报告
          </h3>
          <div className="space-y-4 relative z-10 flex-1">
            <InsightItem>
              本月总计 <strong>{byProject.length}</strong> 个项目，<strong>{byPlatform.length}</strong> 个平台产生费用。
            </InsightItem>
            {byProject.length > 0 && (
              <InsightItem>
                <strong>{byProject[0].name}</strong> 是支出大户，占总费用的 <strong>{((byProject[0].amount / total) * 100).toFixed(1)}%</strong>。
              </InsightItem>
            )}
            {hasChange && (
              <InsightItem>
                相比上月，费用<strong>{change! > 0 ? '上涨' : '下降'}了 {Math.abs(change!).toFixed(1)}%</strong>
                {change! > 0 ? '。建议检查新增资源或临时扩容。' : '。成本优化初见成效。'}
              </InsightItem>
            )}
            {growthTop.length > 0 && (
              <InsightItem>
                <strong>{growthTop[0].project}</strong> 的 <strong>{growthTop[0].platform}</strong> 资源涨幅最大 (+{growthTop[0].change?.toFixed(0)}%)。
              </InsightItem>
            )}
          </div>
          <div className="mt-6 pt-4 border-t border-white/20 text-xs text-indigo-200 relative z-10">
            * 基于当前筛选条件的实时分析
          </div>
        </div>
      </div>

      {/* 结构分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="项目费用占比" icon={Layers}>
          <div>
            <ResponsiveContainer width="100%" height={260}>
              <RechartsPie>
                <Pie
                  data={projectPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                  label={(p) => <PieLabelPercent {...p} layoutMap={projectLayout} />}
                  labelLine={false}
                  isAnimationActive={true}
                >
                  {projectPieData.map((_, i) => <Cell key={i} fill={projectPieData[i].fill} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, '']} />
              </RechartsPie>
            </ResponsiveContainer>
            <PieLegend data={projectPieData} />
          </div>
        </ChartCard>

        <ChartCard title="平台费用分布" icon={Building2}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byPlatform.slice(0, 6)} layout="vertical" margin={{ left: 10, right: 90 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(v: number) => [`$${v.toLocaleString()}`, '']} />
              <Bar dataKey="amount" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20}>
                <LabelList
                  dataKey="amount"
                  position="right"
                  formatter={(v: number) => `$${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
                  style={{ fontSize: 11, fontWeight: 600, fill: '#475569' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="用途类型分布" icon={Zap}>
          <div>
            <ResponsiveContainer width="100%" height={260}>
              <RechartsPie>
                <Pie
                  data={usagePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                  label={(p) => <PieLabelPercent {...p} layoutMap={usageLayout} />}
                  labelLine={false}
                  isAnimationActive={true}
                >
                  {usagePieData.map((_, i) => <Cell key={i} fill={usagePieData[i].fill} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, '']} />
              </RechartsPie>
            </ResponsiveContainer>
            <PieLegend data={usagePieData} />
          </div>
        </ChartCard>
      </div>

      {/* 涨跌幅榜单 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 bg-red-50/30 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp size={18} className="text-red-500" />
              费用增长 Top 5
            </h3>
            <span className="text-xs text-slate-400">环比上月</span>
          </div>
          <div className="divide-y divide-slate-50">
            {growthTop.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">暂无增长记录</div>
            ) : (
              growthTop.map((r, i) => (
                <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-700">{r.project}</span>
                    <span className="text-xs text-slate-400">{r.platform} · {r.usage}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-red-600">+{r.change?.toFixed(1)}%</div>
                    <div className="text-xs text-slate-400">
                      ${(r.lastCost ?? 0).toFixed(0)} <span className="text-slate-300">→</span> ${r.currentCost.toFixed(0)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 bg-emerald-50/30 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingDown size={18} className="text-emerald-500" />
              费用下降 Top 5
            </h3>
            <span className="text-xs text-slate-400">环比上月</span>
          </div>
          <div className="divide-y divide-slate-50">
            {dropTop.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">暂无下降记录</div>
            ) : (
              dropTop.map((r, i) => (
                <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-700">{r.project}</span>
                    <span className="text-xs text-slate-400">{r.platform} · {r.usage}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-600">{r.change?.toFixed(1)}%</div>
                    <div className="text-xs text-slate-400">
                      ${(r.lastCost ?? 0).toFixed(0)} <span className="text-slate-300">→</span> ${r.currentCost.toFixed(0)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 组件 ---

function KpiCard({ title, value, icon: Icon, subValue, trend, trendLabel, color }: any) {
  const colorStyles = {
    indigo: 'bg-indigo-50 text-indigo-600',
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl ${(colorStyles as any)[color]}`}>
          <Icon size={20} />
        </div>
        {trend != null && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
            trend > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
        {(subValue || trendLabel) && (
          <p className="text-xs text-slate-400 mt-1">
            {subValue || `${trendLabel}变化`}
          </p>
        )}
      </div>
    </div>
  );
}

function InsightItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm text-indigo-50/90 leading-relaxed bg-white/5 p-3 rounded-lg border border-white/10">
      <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-300 shrink-0 shadow-[0_0_8px_rgba(165,180,252,0.6)]" />
      <div>{children}</div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
      <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Icon size={18} className="text-slate-400" />
        {title}
      </h3>
      <div className="flex-1 min-h-[280px]">
        {children}
      </div>
    </div>
  );
}
