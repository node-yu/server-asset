import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, X, Check, Download, Upload, Filter, Server as ServerIcon, Globe, Hash, AlertCircle, ChevronLeft, ChevronRight, ArrowRightLeft, Edit3 } from 'lucide-react';
import { api } from '../api';
import type { Server, ServerFormData } from '../types';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';

// Status Logic
function getRowStatus(server: Server): 'available' | 'pending_cancel' | 'expired' | 'unused' {
  if (server.status === '已过期' || server.status === '已取消') return 'expired';
  if (server.status === '未使用') return 'unused';
  if (!server.cancelAt) return 'available';
  const cancel = new Date(server.cancelAt);
  if (cancel < new Date()) return 'expired';
  return 'pending_cancel';
}

/** 项目专属配色：优先使用 API 返回的 color，否则用预设 */
function getProjectBadgeStyle(
  projectName: string,
  projectColorMap?: Record<string, string>,
): { className: string; style?: React.CSSProperties } {
  const base = 'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border';
  const customColor = projectColorMap?.[(projectName || '').trim()];
  if (customColor && /^#[0-9a-fA-F]{6}$/.test(customColor)) {
    return {
      className: `${base} border-transparent`,
      style: {
        backgroundColor: customColor + '25',
        color: customColor,
        borderColor: customColor + '40',
      },
    };
  }
  const name = (projectName || '').trim().toUpperCase();
  const preset: Record<string, { className: string; style?: React.CSSProperties }> = {
    JUMP: { className: `${base} bg-blue-100 text-blue-800 border-blue-200` },
    RINGPLUS: { className: `${base} text-amber-900 border-amber-300`, style: { background: 'linear-gradient(135deg, #fcd34d 0%, #fb923c 100%)' } },
    KINGPLUS: { className: `${base} text-amber-900 border-amber-300`, style: { background: 'linear-gradient(135deg, #fcd34d 0%, #fb923c 100%)' } },
    SPEEDTOP: { className: `${base} bg-violet-100 text-violet-800 border-violet-200` },
    FKEY: { className: `${base} bg-emerald-100 text-emerald-800 border-emerald-200` },
    'FKEY&SPEED': { className: `${base} bg-blue-50 text-blue-700 border-blue-200` },
    ZIPDRAMA: { className: `${base} bg-pink-100 text-pink-800 border-pink-200` },
    外包: { className: `${base} bg-teal-100 text-teal-800 border-teal-200` },
  };
  return preset[name] ?? { className: `${base} bg-slate-100 text-slate-700 border-slate-200` };
}

function CopyableText({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success('已复制');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };
  return (
    <span
      onClick={handleClick}
      className={className}
      title={copied ? '已复制' : '点击复制'}
    >
      {text}
      {copied && <span className="ml-1.5 text-xs text-emerald-600 font-medium">已复制</span>}
    </span>
  );
}

type PlatformAccount = { id: number; platformId: number; platform: { name: string }; accountName: string };

// --- Components ---

function ServerModal({
  server,
  projects,
  platforms,
  platformAccounts,
  onClose,
  onSaved,
}: {
  server?: Server | null;
  projects: { id: number; name: string }[];
  platforms: { id: number; name: string }[];
  platformAccounts: PlatformAccount[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toDatetimeLocal = (s?: string) =>
    s ? new Date(s).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16);
  const [showPassword, setShowPassword] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [form, setForm] = useState<ServerFormData>(() => ({
    platform: '',
    hostname: '',
    ip: '',
    password: '',
    project: '',
    status: '运行中',
    monthlyCost: 0,
    createdAt: new Date().toISOString().slice(0, 16),
  }));

  useEffect(() => {
    setShowPassword(false);
    setRevealedPassword(null);
    setForm(
      server
        ? { ...server, password: '', createdAt: toDatetimeLocal(server.createdAt) }
        : {
            platform: '',
            hostname: '',
            ip: '',
            password: '',
            project: '',
            status: '运行中',
            usage: '会员节点',
            monthlyCost: 0,
            createdAt: new Date().toISOString().slice(0, 16),
          },
    );
  }, [server]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<{ id: number; fromProject: string; toProject: string; transferDate: string }[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [addTransferFrom, setAddTransferFrom] = useState('');
  const [addTransferTo, setAddTransferTo] = useState('');
  const [addTransferDate, setAddTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [addingTransfer, setAddingTransfer] = useState(false);
  const [transferDeleteConfirm, setTransferDeleteConfirm] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (server?.id) {
      setTransfersLoading(true);
      api.getTransfers(server.id).then(setTransfers).catch(() => setTransfers([])).finally(() => setTransfersLoading(false));
    } else {
      setTransfers([]);
    }
  }, [server?.id]);

  useEffect(() => {
    if (server && transfers.length > 0) {
      setAddTransferFrom(transfers[transfers.length - 1].toProject);
    } else if (server?.project) {
      setAddTransferFrom(server.project);
    }
  }, [server?.id, server?.project, transfers]);

  const handleAddTransfer = async () => {
    if (!server?.id || !addTransferFrom.trim() || !addTransferTo.trim() || !addTransferDate) return;
    if (addTransferFrom === addTransferTo) {
      setErr('来源项目与目标项目不能相同');
      return;
    }
    setAddingTransfer(true);
    setErr(null);
    try {
      await api.addTransfer(server.id, {
        fromProject: addTransferFrom.trim(),
        toProject: addTransferTo.trim(),
        transferDate: addTransferDate + 'T00:00:00',
      });
      const list = await api.getTransfers(server.id);
      setTransfers(list);
      setForm((f) => ({ ...f, project: addTransferTo.trim() }));
      setAddTransferFrom(addTransferTo.trim());
      setAddTransferTo('');
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAddingTransfer(false);
    }
  };

  const handleRemoveTransfer = (transferId: number) => setTransferDeleteConfirm(transferId);
  const doRemoveTransfer = async () => {
    if (!server?.id || !transferDeleteConfirm) return;
    const deleted = transfers.find((t) => t.id === transferDeleteConfirm);
    try {
      await api.removeTransfer(server.id, transferDeleteConfirm);
      const list = await api.getTransfers(server.id);
      setTransfers(list);
      const last = list[list.length - 1];
      if (last) setForm((f) => ({ ...f, project: last.toProject }));
      else if (deleted) setForm((f) => ({ ...f, project: deleted.fromProject }));
      setTransferDeleteConfirm(null);
      onSaved();
      toast.success('已删除');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      if (server) {
        const data = { ...form };
        if (!data.password) delete (data as Record<string, unknown>).password;
        await api.updateServer(server.id, data);
      } else {
        if (!form.password) {
          setErr('密码不能为空');
          setSaving(false);
          return;
        }
        await api.createServer(form);
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 text-sm";
  const labelClass = "block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide";

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${server ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <ServerIcon size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{server ? '编辑服务器' : '新增服务器'}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="overflow-y-auto flex-1 p-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          <form onSubmit={handleSubmit} className="space-y-6">
            {err && (
              <div className="rounded-lg bg-red-50 border border-red-100 text-red-600 px-4 py-3 text-sm flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {err}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>平台供应商</label>
                  <div className="relative">
                    <select
                      value={form.platform}
                      onChange={(e) => setForm({ ...form, platform: e.target.value, platformAccountId: undefined })}
                      className={`${inputClass} appearance-none pr-8`}
                      required
                    >
                      <option value="">选择平台...</option>
                      {form.platform && !platforms.some((p) => p.name === form.platform) && (
                        <option value={form.platform}>{form.platform}（历史）</option>
                      )}
                      {platforms.map((p) => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <Globe size={14} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>主机名</label>
                  <input
                    value={form.hostname}
                    onChange={(e) => setForm({ ...form, hostname: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. hk-server-01"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>IP 地址</label>
                  <input
                    value={form.ip}
                    onChange={(e) => setForm({ ...form, ip: e.target.value })}
                    className={`${inputClass} font-mono`}
                    placeholder="0.0.0.0"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>SSH 密码 {server && '(留空不修改)'}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={server && showPassword ? (loadingPassword ? '' : (revealedPassword ?? '')) : form.password}
                      onChange={(e) => {
                        if (!server || !showPassword) setForm({ ...form, password: e.target.value });
                      }}
                      readOnly={!!(server && showPassword)}
                      className={`${inputClass} pr-10`}
                      placeholder={server && !showPassword ? '•••••••• 点击眼睛查看' : server ? '' : 'SSH Root Password'}
                      required={!server}
                    />
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (showPassword) {
                          setShowPassword(false);
                          setRevealedPassword(null);
                        } else {
                          setShowPassword(true);
                          if (server?.id && !revealedPassword) {
                            setLoadingPassword(true);
                            try {
                              const { password } = await api.getPassword(server.id);
                              setRevealedPassword(password);
                            } catch (err) {
                              toast.error((err as Error).message);
                              setShowPassword(false);
                            } finally {
                              setLoadingPassword(false);
                            }
                          }
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 z-10 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {server && showPassword && loadingPassword && (
                    <p className="text-xs text-slate-500 mt-1">加载密码中...</p>
                  )}
                </div>
                 <div>
                  <label className={labelClass}>配置规格</label>
                  <input
                    value={form.config || ''}
                    onChange={(e) => setForm({ ...form, config: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. 2C4G 50GB"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>地区</label>
                    <input
                      value={form.region || ''}
                      onChange={(e) => setForm({ ...form, region: e.target.value })}
                      className={inputClass}
                      placeholder="e.g. 香港"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>服务器类型</label>
                    <input
                      value={form.serverType || ''}
                      onChange={(e) => setForm({ ...form, serverType: e.target.value })}
                      className={inputClass}
                      placeholder="e.g. VPS"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>流量类型</label>
                    <input
                      value={form.bandwidthType || ''}
                      onChange={(e) => setForm({ ...form, bandwidthType: e.target.value })}
                      className={inputClass}
                      placeholder="e.g. 按量"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-5">
                 <div>
                  <label className={labelClass}>关联账号</label>
                  <div className="relative">
                    <select
                      value={form.platformAccountId ?? ''}
                      onChange={(e) => setForm({ ...form, platformAccountId: e.target.value ? parseInt(e.target.value) : undefined })}
                      className={`${inputClass} appearance-none pr-8`}
                    >
                      <option value="">不关联</option>
                      {platformAccounts
                        .filter((a) => a.platform.name === form.platform)
                        .map((a) => (
                          <option key={a.id} value={a.id}>{a.accountName}</option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <Hash size={14} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>管理者</label>
                  <input
                    value={form.manager || ''}
                    onChange={(e) => setForm({ ...form, manager: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. 张三"
                  />
                </div>
                 <div>
                  <label className={labelClass}>所属项目</label>
                  <input
                    list="project-list"
                    value={form.project}
                    onChange={(e) => setForm({ ...form, project: e.target.value })}
                    className={inputClass}
                    placeholder="单独选下拉，共用输入 项目A&项目B"
                    required
                  />
                  <datalist id="project-list">
                    {projects.map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                  <p className="mt-1 text-xs text-slate-400">共用服务器请输入 项目A&项目B，费用将平分到各项目</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>每月费用</label>
                    <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.monthlyCost}
                        onChange={(e) => setForm({ ...form, monthlyCost: parseFloat(e.target.value) || 0 })}
                        className={`${inputClass} pl-6 font-medium text-amber-600`}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>状态</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className={inputClass}
                    >
                      <option>运行中</option>
                      <option>已停止</option>
                      <option>未使用</option>
                      <option>已过期</option>
                    </select>
                  </div>
                </div>
                <div>
                   <label className={labelClass}>用途分类</label>
                   <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="usageType"
                            checked={['免费节点','会员节点','广告节点'].includes(form.usage || '')}
                            onChange={() => setForm({ ...form, usage: '会员节点' })}
                            className="text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">普通节点</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="usageType"
                            checked={!!(form.usage?.startsWith('核心') || (form.usage && !['免费节点','会员节点','广告节点'].includes(form.usage)))}
                            onChange={() => setForm({ ...form, usage: form.usage?.startsWith('核心') ? form.usage : '核心-核心服务器' })}
                            className="text-indigo-600 focus:ring-indigo-500 border-slate-300"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">核心服务</span>
                        </label>
                      </div>
                      {(form.usage?.startsWith('核心') || (form.usage && !['免费节点','会员节点','广告节点'].includes(form.usage))) ? (
                        <input
                          value={form.usage?.startsWith('核心') ? form.usage.slice(2) : form.usage}
                          onChange={(e) => setForm({ ...form, usage: e.target.value ? `核心-${e.target.value}` : '核心-' })}
                          placeholder="输入具体用途..."
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 outline-none placeholder:text-slate-400"
                        />
                      ) : (
                        <select
                          value={['免费节点','会员节点','广告节点'].includes(form.usage || '') ? form.usage : '会员节点'}
                          onChange={(e) => setForm({ ...form, usage: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 outline-none"
                        >
                          <option value="会员节点">会员节点</option>
                          <option value="免费节点">免费节点</option>
                          <option value="广告节点">广告节点</option>
                        </select>
                      )}
                   </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-2 border-t border-slate-100 mt-2">
               <div>
                <label className={labelClass}>创建时间</label>
                <input
                  type="datetime-local"
                  value={form.createdAt ? form.createdAt.slice(0, 16) : ''}
                  onChange={(e) => setForm({ ...form, createdAt: e.target.value || undefined })}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>取消时间</label>
                <input
                  type="datetime-local"
                  value={form.cancelAt ? form.cancelAt.slice(0, 16) : ''}
                  onChange={(e) => setForm({ ...form, cancelAt: e.target.value || undefined })}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>备注说明</label>
              <textarea
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className={`${inputClass} resize-none`}
                placeholder="添加备注..."
              />
            </div>

            {server && (
              <div className="pt-4 border-t border-slate-100 mt-4">
                <label className={`${labelClass} flex items-center gap-2`}>
                  <ArrowRightLeft size={14} />
                  项目转移记录
                </label>
                <p className="text-xs text-slate-500 mb-3">服务器若在某月内从 A 组转到 B 组，费用将按天数拆分到各项目</p>
                {transfersLoading ? (
                  <div className="text-sm text-slate-400 py-4">加载中...</div>
                ) : (
                  <>
                    {transfers.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {transfers.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm"
                          >
                            <span className="text-slate-700">
                              {t.fromProject} → {t.toProject}
                            </span>
                            <span className="text-slate-500 text-xs">{new Date(t.transferDate).toLocaleDateString('zh-CN')}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTransfer(t.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="删除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 items-end">
                      <div className="flex-1 min-w-[100px]">
                        <span className="text-[10px] text-slate-400 block mb-0.5">从项目</span>
                        <input
                          value={addTransferFrom}
                          onChange={(e) => setAddTransferFrom(e.target.value)}
                          className={inputClass}
                          placeholder="来源项目"
                          list="project-list"
                        />
                      </div>
                      <div className="flex-1 min-w-[100px]">
                        <span className="text-[10px] text-slate-400 block mb-0.5">转到项目</span>
                        <input
                          value={addTransferTo}
                          onChange={(e) => setAddTransferTo(e.target.value)}
                          className={inputClass}
                          placeholder="目标项目"
                          list="project-list"
                        />
                      </div>
                      <div className="w-[140px]">
                        <span className="text-[10px] text-slate-400 block mb-0.5">转移日期</span>
                        <input
                          type="date"
                          value={addTransferDate}
                          onChange={(e) => setAddTransferDate(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddTransfer}
                        disabled={addingTransfer || !addTransferFrom.trim() || !addTransferTo.trim()}
                        className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {addingTransfer ? '添加中...' : '添加转移'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-sm font-medium shadow-sm"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md shadow-indigo-100 transition-all text-sm active:scale-95"
              >
                {saving ? '保存中...' : <><Check size={16} /> 保存配置</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        open={!!transferDeleteConfirm}
        title="删除转移记录"
        message="确定删除此转移记录？费用统计将不再按此拆分。"
        confirmLabel="删除"
        variant="danger"
        onConfirm={doRemoveTransfer}
        onCancel={() => setTransferDeleteConfirm(null)}
      />
    </div>
  );
}

function PasswordModal({ password, onClose }: { password: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl border border-slate-200 p-8 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
             <div className="p-2.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
               <Eye size={20} />
             </div>
             <div>
               <h3 className="font-bold text-slate-900">查看密码</h3>
               <p className="text-xs text-slate-500 mt-0.5">Sensitive Information</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4">
          <div className="relative group">
            <p className="font-mono text-lg text-center text-slate-900 break-all select-all bg-slate-50 border border-slate-200 px-6 py-6 rounded-xl shadow-inner font-medium tracking-wide">
              {password}
            </p>
          </div>
          <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
            <AlertCircle size={12} />
            请妥善保管，切勿泄露给他人
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ServerList() {
  const [servers, setServers] = useState<Server[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string; color?: string | null }[]>([]);
  const [platforms, setPlatforms] = useState<{ id: number; name: string }[]>([]);
  const [platformAccounts, setPlatformAccounts] = useState<PlatformAccount[]>([]);
  const [importing, setImporting] = useState(false);
  const [importOverwrite, setImportOverwrite] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; errors: string[]; duplicateIps?: { ip: string; count: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Server | null | 'new'>(null);
  const [passwordModal, setPasswordModal] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [filter, setFilter] = useState<{ platform?: string; project?: string; usage?: string; status?: string; search?: string; platformAccountId?: number }>({});
  const [searchInput, setSearchInput] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const toast = useToast();

  const filteredByStatus = (() => {
    if (!filter.status) return servers;
    return servers.filter((s) => getRowStatus(s) === filter.status);
  })();

  const stats = (() => {
    const list = filteredByStatus;
    let available = 0;
    let pending = 0;
    let unused = 0;
    let expired = 0;
    list.forEach((s) => {
      const st = getRowStatus(s);
      if (st === 'available') available++;
      else if (st === 'pending_cancel') pending++;
      else if (st === 'unused') unused++;
      else expired++;
    });
    return { total: list.length, available, pending, unused, expired };
  })();

  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
  const totalPages = Math.max(1, Math.ceil(filteredByStatus.length / pageSize));
  const paginatedServers = filteredByStatus.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, filter.platform, filter.project, filter.usage, filter.status, filter.search, filter.platformAccountId]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredByStatus.length / pageSize));
    setCurrentPage((p) => Math.min(p, maxPage));
  }, [filteredByStatus.length, pageSize]);

  const load = () => {
    setLoading(true);
    setError(null);
    const hasParams = filter.platform || filter.project || filter.usage || filter.search || filter.platformAccountId != null;
    const serverParams = hasParams
      ? { platform: filter.platform || undefined, project: filter.project || undefined, usage: filter.usage || undefined, search: filter.search || undefined, platformAccountId: filter.platformAccountId }
      : undefined;
    Promise.all([
      api.getServers(serverParams),
      api.getProjects(),
      api.getPlatforms(),
      api.getPlatformAccounts(),
    ])
      .then(([s, p, pl, pa]) => {
        setServers(s);
        setProjects(p);
        setPlatforms(pl);
        setPlatformAccounts(pa as PlatformAccount[]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), [filter.platform, filter.project, filter.usage, filter.search, filter.platformAccountId]);

  useEffect(() => {
    const t = setTimeout(() => setFilter((f) => ({ ...f, search: searchInput.trim() || undefined })), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleDelete = (id: number) => setDeleteConfirm(id);
  const doDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(deleteConfirm);
    try {
      await api.deleteServer(deleteConfirm);
      load();
      setDeleteConfirm(null);
      toast.success('已删除');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  const handleShowPassword = async (id: number) => {
    try {
      const { password } = await api.getPassword(id);
      setPasswordModal(password);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
        <div>
           <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">
             服务器资产列表
           </h1>
           <p className="text-slate-500 text-sm">统一管理所有云资源实例、状态与成本开销</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={importOverwrite}
                onChange={(e) => setImportOverwrite(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>导入时覆盖已存在（按 IP 或主机名匹配）</span>
            </label>
          </div>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm p-1">
            <button
              onClick={() => api.downloadTemplate().then(() => toast.success('模板已下载')).catch((e) => toast.error((e as Error).message))}
              className="group p-2 rounded-md hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all"
              title="下载模板"
            >
              <Download size={18} />
            </button>
            <label className="group p-2 rounded-md hover:bg-slate-50 text-slate-400 hover:text-emerald-600 cursor-pointer transition-all border-l border-slate-100" title="导入 Excel">
              <Upload size={18} />
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setImporting(true);
                  setImportResult(null);
                  try {
                    const r = await api.importServers(f, { overwrite: importOverwrite });
                    setImportResult(r);
                    load();
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
              onClick={() => api.exportServers().then(() => toast.success('导出成功')).catch((e) => toast.error((e as Error).message))}
               className="group p-2 rounded-md hover:bg-slate-50 text-slate-400 hover:text-amber-600 transition-all border-l border-slate-100"
               title="导出 Excel"
            >
              <Download size={18} className="rotate-180" />
            </button>
          </div>

          <button
            onClick={() => setModal('new')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all active:scale-95 text-sm"
          >
            <Plus size={18} />
            新增服务器
          </button>
        </div>
      </div>

      {/* Notifications */}
      {importing && (
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 px-6 py-4 mb-6 flex items-center gap-3 animate-pulse shadow-sm">
           <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
           正在导入数据，请稍候...
        </div>
      )}
      {importResult && (
        <div className="rounded-xl bg-white border border-slate-200 px-6 py-4 mb-6 shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-slate-900 font-semibold">导入完成</p>
            <button onClick={() => setImportResult(null)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
          </div>
          <div className="flex gap-6 mt-2 text-sm">
             <span className="text-emerald-600 font-medium">成功: {importResult.imported}</span>
             <span className="text-red-600 font-medium">失败: {importResult.failed}</span>
          </div>
          {importResult.errors.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-100">
              <ul className="text-sm text-red-600/90 space-y-1 list-disc list-inside">
                {importResult.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                {importResult.errors.length > 3 && <li>... 以及更多 {importResult.errors.length - 3} 项错误</li>}
              </ul>
            </div>
          )}
          {importResult.duplicateIps && importResult.duplicateIps.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <span className="font-medium">本文件中存在重复 IP：</span>
              {importResult.duplicateIps.slice(0, 5).map((d) => `${d.ip} (${d.count}次)`).join('、')}
              {importResult.duplicateIps.length > 5 && ` 等共 ${importResult.duplicateIps.length} 个`}
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 px-6 py-4 mb-6 flex items-center gap-3 shadow-sm">
           <AlertCircle size={18} />
           {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-center shadow-sm">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold px-2">
           <Filter size={16} />
           <span>筛选</span>
        </div>

        <input
          type="text"
          placeholder="搜索主机名、IP（多个用逗号或分号分隔）"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none hover:bg-slate-100 transition-colors w-56"
        />
        
        <select
          value={filter.platform ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, platform: e.target.value || undefined, platformAccountId: undefined }))}
          className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <option value="">所有供应商</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>

        <select
          value={filter.platformAccountId ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, platformAccountId: e.target.value ? parseInt(e.target.value) : undefined }))}
          className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none hover:bg-slate-100 transition-colors cursor-pointer min-w-[180px]"
          title="按平台账号筛选"
        >
          <option value="">所有账号</option>
          {(filter.platform
            ? platformAccounts.filter((a) => a.platform?.name === filter.platform)
            : platformAccounts
          ).map((a) => (
            <option key={a.id} value={a.id}>{a.platform?.name} - {a.accountName}</option>
          ))}
        </select>
        
        <select
          value={filter.project ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, project: e.target.value || undefined }))}
          className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <option value="">所有项目</option>
          {[...new Set([...projects.map((p) => p.name), ...servers.map((s) => s.project)])].sort().map((name) => (
            <option key={name} value={name}>{name}{name.includes('&') ? ' (共用)' : ''}</option>
          ))}
        </select>
        
        <select
          value={filter.usage ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, usage: e.target.value || undefined }))}
          className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <option value="">所有用途</option>
          <option value="会员节点">会员节点</option>
          <option value="免费节点">免费节点</option>
          <option value="广告节点">广告节点</option>
          <option value="核心">核心服务</option>
        </select>

        <select
          value={filter.status ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value || undefined }))}
          className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <option value="">所有状态</option>
          <option value="available">在用</option>
          <option value="pending_cancel">待取消</option>
          <option value="unused">未使用</option>
          <option value="expired">已取消</option>
        </select>

        {(filter.platform || filter.project || filter.usage || filter.status || filter.search || filter.platformAccountId != null) && (
          <button
            onClick={() => { setFilter({}); setSearchInput(''); }}
            className="ml-auto px-3 py-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors text-sm flex items-center gap-1.5 font-medium"
          >
            <X size={16} /> 清除条件
          </button>
        )}
      </div>

      {/* Stats Bar */}
      {!loading && servers.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-4 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
          <span className="text-sm font-semibold text-slate-600">
            {[filter.project && `项目 ${filter.project}`, filter.platform && `供应商 ${filter.platform}`, filter.platformAccountId != null && (() => {
              const acc = platformAccounts.find((a) => a.id === filter.platformAccountId);
              return acc ? `账号 ${acc.accountName}` : null;
            })()]
              .filter(Boolean)
              .join(' · ') || '全部'}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-sm text-slate-600">
            总计 <strong className="text-slate-800 font-bold">{stats.total}</strong>
          </span>
          <span className="text-sm text-emerald-600">
            在用 <strong className="font-bold">{stats.available}</strong>
          </span>
          <span className="text-sm text-amber-600">
            待取消 <strong className="font-bold">{stats.pending}</strong>
          </span>
          <span className="text-sm text-slate-500">
            未使用 <strong className="font-bold">{stats.unused}</strong>
          </span>
          <span className="text-sm text-red-600">
            已取消 <strong className="font-bold">{stats.expired}</strong>
          </span>
        </div>
      )}

      {/* Main Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-500 gap-4">
           <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
           <p className="text-sm font-medium">加载数据中...</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-4 py-4 w-12">
                    {filteredByStatus.length > 0 && (
                      <input
                        type="checkbox"
                        checked={paginatedServers.length > 0 && paginatedServers.every((s) => selectedIds.has(s.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds((prev) => new Set([...prev, ...paginatedServers.map((s) => s.id)]));
                          } else {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              paginatedServers.forEach((s) => next.delete(s.id));
                              return next;
                            });
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    )}
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-28">状态</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">平台 / 账号</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">主机信息</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">归属</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">时间 / 费用</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-32">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {filteredByStatus.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-24 text-center">
                      <div className="flex flex-col items-center gap-4">
                         <div className="p-4 rounded-full bg-slate-50 border border-slate-100 text-slate-400">
                           <ServerIcon size={32} />
                         </div>
                         <div>
                            <h3 className="text-slate-900 font-semibold mb-1">
                              {servers.length === 0 ? '暂无服务器数据' : '当前筛选条件下暂无数据'}
                            </h3>
                            <p className="text-slate-500 text-sm max-w-xs mx-auto">
                              {servers.length === 0
                                ? '点击右上角的 "新增服务器" 按钮添加您的第一台服务器'
                                : '尝试调整筛选条件'}
                            </p>
                         </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const projectColorMap = Object.fromEntries(
                      projects.filter((p) => p.color).map((p) => [p.name, p.color!]),
                    );
                    return paginatedServers.map((s) => {
                    const status = getRowStatus(s);
                    
                    // 整行底色：与状态徽标背景一致
                    const rowBg =
                      status === 'available'
                        ? 'bg-emerald-50/80 hover:bg-emerald-50'
                        : status === 'pending_cancel'
                          ? 'bg-amber-50/80 hover:bg-amber-50'
                          : status === 'unused'
                            ? 'bg-slate-50/80 hover:bg-slate-50'
                            : 'bg-red-50/80 hover:bg-red-50';
                    
                    const statusConfig =
                      status === 'available'
                        ? { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-600' }
                        : status === 'pending_cancel'
                          ? { bg: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-600' }
                          : status === 'unused'
                            ? { bg: 'bg-slate-100 text-slate-600 border-slate-300', dot: 'bg-slate-500' }
                            : { bg: 'bg-red-100 text-red-800 border-red-300', dot: 'bg-red-600' };

                    const isExpiredOrUnused = status === 'expired' || status === 'unused';
                    return (
                      <tr
                        key={s.id}
                        className={`group transition-all ${rowBg} ${isExpiredOrUnused ? 'grayscale-[0.3]' : ''}`}
                      >
                        <td className="px-4 py-5 align-top">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(s.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds((prev) => new Set([...prev, s.id]));
                              } else {
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  next.delete(s.id);
                                  return next;
                                });
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        {/* Status Column */}
                        <td className="px-6 py-5 align-top">
                           <div className="flex flex-col gap-2 items-start">
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm whitespace-nowrap ${statusConfig.bg}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusConfig.dot}`} />
                                {statusLabel(status, s.status)}
                              </div>
                              {status === 'pending_cancel' && s.cancelAt && (
                                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded ml-0.5">
                                  {new Date(s.cancelAt).toLocaleDateString()} 到期
                                </span>
                              )}
                           </div>
                        </td>

                        {/* Platform / Account */}
                        <td className="px-6 py-5 align-top">
                          <div className="flex flex-col">
                            <span className={`font-semibold text-sm ${isExpiredOrUnused ? 'text-slate-500' : 'text-slate-900'}`}>
                              {s.platformAccount?.platform?.name ?? s.platform}
                            </span>
                            {s.platformAccount ? (
                               <span className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                 <span className="w-1 h-1 rounded-full bg-slate-300"/>
                                 {s.platformAccount.accountName}
                               </span>
                            ) : (
                               <span className="text-xs text-slate-400 mt-1 italic">未关联账号</span>
                            )}
                          </div>
                        </td>

                        {/* Hostname / IP */}
                        <td className="px-6 py-5 align-top">
                          <div className="flex flex-col gap-1.5">
                            <CopyableText
                              text={s.hostname}
                              className={`font-medium text-sm cursor-pointer hover:text-indigo-600 hover:underline ${isExpiredOrUnused ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700'}`}
                            />
                            <div className="flex flex-wrap gap-2">
                              {s.ip
                                .split(/[\s,，;；、]+/)
                                .map((ip) => ip.trim())
                                .filter(Boolean)
                                .map((ip, i) => (
                                  <CopyableText
                                    key={i}
                                    text={ip}
                                    className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 cursor-pointer transition-colors inline-block"
                                  />
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                               {s.usage && (
                                 <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200 font-medium shadow-sm">
                                   {s.usage}
                                 </span>
                               )}
                               {s.region && (
                                 <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200 shadow-sm" title="地区">
                                   {s.region}
                                 </span>
                               )}
                               {s.serverType && (
                                 <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200 shadow-sm" title="服务器类型">
                                   {s.serverType}
                                 </span>
                               )}
                               {s.bandwidthType && (
                                 <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200 shadow-sm" title="流量类型">
                                   {s.bandwidthType}
                                 </span>
                               )}
                               {s.config && (
                                 <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm max-w-[8rem] truncate inline-block align-bottom" title={s.config}>
                                   {s.config}
                                 </span>
                               )}
                            </div>
                          </div>
                        </td>

                        {/* Project */}
                        <td className="px-6 py-5 align-top">
                           {(() => {
                             const { className, style } = getProjectBadgeStyle(s.project, projectColorMap);
                             return (
                               <div className={className} style={style}>
                                 {s.project}
                               </div>
                             );
                           })()}
                           {s.manager && (
                             <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                               <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                               {s.manager}
                             </div>
                           )}
                        </td>

                        {/* Cost / Time */}
                        <td className="px-6 py-5 align-top">
                          <div className="flex flex-col gap-1.5">
                             <span className={`text-sm font-bold flex items-center gap-0.5 ${isExpiredOrUnused ? 'text-slate-400' : 'text-amber-600'}`}>
                               <span className="text-xs font-medium text-slate-400">$</span>{s.monthlyCost.toFixed(2)}
                               <span className="text-[10px] font-normal text-slate-400 ml-1">/ 月</span>
                             </span>
                             <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                               <span title={`创建于 ${new Date(s.createdAt).toLocaleString()}`}>
                                 始: {new Date(s.createdAt).toLocaleDateString('zh-CN')}
                               </span>
                               {s.cancelAt && (
                                 <span className={`${isExpiredOrUnused ? 'text-red-400' : 'text-amber-600'}`} title="取消时间">
                                   止: {new Date(s.cancelAt).toLocaleDateString('zh-CN')}
                                 </span>
                               )}
                             </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-5 align-top text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleShowPassword(s.id); }}
                              className="p-2 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors relative z-10"
                              title="查看密码"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => setModal(s)}
                              className="p-2 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              title="编辑"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(s.id)}
                              disabled={deleting === s.id}
                              className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                              title="删除"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                  })()
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredByStatus.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-3">
                {selectedIds.size > 0 && (
                  <>
                    <button
                      onClick={() => setBatchEditOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                      <Edit3 size={16} />
                      批量修改 ({selectedIds.size})
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="text-sm text-slate-500 hover:text-slate-700"
                    >
                      取消选择
                    </button>
                    <span className="text-slate-300">|</span>
                  </>
                )}
                <span className="text-sm text-slate-500">每页</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} 条</option>
                  ))}
                </select>
                <span className="text-sm text-slate-500">
                  共 {filteredByStatus.length} 条，第 {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredByStatus.length)} 条
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-2 rounded-lg text-slate-600 hover:bg-white hover:border-slate-200 border border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="上一页"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="px-3 py-1 text-sm text-slate-600 font-medium">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-2 rounded-lg text-slate-600 hover:bg-white hover:border-slate-200 border border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="下一页"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {modal && (
        <ServerModal
          server={modal === 'new' ? undefined : modal}
          projects={projects}
          platforms={platforms}
          platformAccounts={platformAccounts}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
      {passwordModal !== null && (
        <PasswordModal password={passwordModal} onClose={() => setPasswordModal(null)} />
      )}

      <ConfirmModal
        open={!!deleteConfirm}
        title="删除服务器"
        message="确定要删除该服务器吗？"
        confirmLabel="删除"
        variant="danger"
        onConfirm={doDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      {batchEditOpen && (
        <BatchEditModal
          ids={Array.from(selectedIds)}
          projects={projects}
          onClose={() => setBatchEditOpen(false)}
          onSaved={() => {
            setBatchEditOpen(false);
            setSelectedIds(new Set());
            load();
          }}
        />
      )}
    </div>
  );
}

function BatchEditModal({
  ids,
  projects,
  onClose,
  onSaved,
}: {
  ids: number[];
  projects: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cancelAt, setCancelAt] = useState('');
  const [clearCancelAt, setClearCancelAt] = useState(false);
  const [project, setProject] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    const payload: Partial<ServerFormData> = {};
    if (clearCancelAt) payload.cancelAt = '';
    else if (cancelAt.trim()) payload.cancelAt = cancelAt.trim().slice(0, 16);
    if (project) payload.project = project;
    if (status) payload.status = status;
    if (Object.keys(payload).length === 0) {
      toast.error('请至少修改一个字段');
      return;
    }
    setSaving(true);
    try {
      await api.batchUpdateServers(ids, payload);
      toast.success(`已批量更新 ${ids.length} 台服务器`);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900">批量修改</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">已选择 <strong className="text-indigo-600">{ids.length}</strong> 台服务器</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">取消时间</label>
            <div className="flex items-center gap-3">
              <input
                type="datetime-local"
                value={cancelAt}
                onChange={(e) => { setCancelAt(e.target.value); setClearCancelAt(false); }}
                disabled={clearCancelAt}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50 disabled:bg-slate-50"
              />
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={clearCancelAt}
                  onChange={(e) => { setClearCancelAt(e.target.checked); if (e.target.checked) setCancelAt(''); }}
                  className="rounded border-slate-300 text-indigo-600"
                />
                清空
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">所属项目</label>
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
            >
              <option value="">不修改</option>
              {projects.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">状态</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm focus:border-indigo-500 outline-none"
            >
              <option value="">不修改</option>
              <option value="运行中">运行中</option>
              <option value="已过期">已过期</option>
              <option value="已取消">已取消</option>
              <option value="未使用">未使用</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100">取消</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function statusLabel(type: 'available' | 'pending_cancel' | 'expired' | 'unused', rawStatus: string) {
  if (type === 'expired') return '已过期';
  if (type === 'pending_cancel') return '待取消';
  if (type === 'unused') return '未使用';
  return rawStatus === '运行中' ? '运行中' : rawStatus;
}
