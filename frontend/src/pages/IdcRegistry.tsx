import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, X, Check, History, Filter } from 'lucide-react';
import { api, type IdcRegistration, type IdcRegistrationDetail, type CreateIdcDto } from '../api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { inputClass, labelClass } from '../utils/styles';

type PlatformAccount = { id: number; platformId: number; platform: { name: string }; accountName: string };

const MB_PER_GB = 1000; // 1G = 1000Mb

function calcConfigCostTotal(perUnit: number, serverCount: number) {
  return (perUnit ?? 0) * (serverCount ?? 0);
}
function calcBandwidthCostTotal(perMb: number, bandwidthGb: number) {
  return (perMb ?? 0) * (bandwidthGb ?? 0) * MB_PER_GB;
}

export default function IdcRegistry() {
  const [list, setList] = useState<IdcRegistration[]>([]);
  const [platformAccounts, setPlatformAccounts] = useState<PlatformAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'new' | null>(null);
  const [detailModal, setDetailModal] = useState<IdcRegistrationDetail | null>(null);
  const [form, setForm] = useState<CreateIdcDto>({
    platformAccountId: 0,
    region: '',
    config: '',
    serverCount: 0,
    bandwidth: 0,
    configCost: 0,
    bandwidthCost: 0,
    notes: '',
  });
  const [adjustForm, setAdjustForm] = useState({
    adjustmentDate: new Date().toISOString().slice(0, 10),
    serverCountDelta: 0,   // 正数=增加，负数=减少
    bandwidthDelta: 0,
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [addingAdjust, setAddingAdjust] = useState(false);
  const [editingCost, setEditingCost] = useState<'config' | 'bandwidth' | null>(null);
  const [editCostValue, setEditCostValue] = useState(0);
  const [filter, setFilter] = useState({
    platform: '',
    accountId: 0,
    region: '',
    config: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number } | null>(null);
  const toast = useToast();

  const { platforms, regions, configs } = useMemo(() => {
    const platforms = [...new Set(list.map((r) => r.platformAccount.platform.name))].sort();
    const regions = [...new Set(list.map((r) => r.region))].sort();
    const configs = [...new Set(list.map((r) => r.config))].sort();
    return { platforms, regions, configs };
  }, [list]);

  const filteredList = useMemo(() => {
    return list.filter((r) => {
      if (filter.platform && r.platformAccount.platform.name !== filter.platform) return false;
      if (filter.accountId && r.platformAccountId !== filter.accountId) return false;
      if (filter.region && r.region !== filter.region) return false;
      if (filter.config && r.config !== filter.config) return false;
      return true;
    });
  }, [list, filter]);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([api.getIdcRegistrations(), api.getPlatformAccounts(undefined, true)])
      .then(([r, a]) => {
        setList(r);
        setPlatformAccounts(a as PlatformAccount[]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const handleSave = async () => {
    if (!form.platformAccountId || !form.region.trim() || !form.config.trim()) {
      toast.error('请填写平台账号、地区和配置');
      return;
    }
    setSaving(true);
    try {
      await api.createIdcRegistration(form);
      load();
      setModal(null);
      setForm({ platformAccountId: 0, region: '', config: '', serverCount: 0, bandwidth: 0, configCost: 0, bandwidthCost: 0, notes: '' });
      toast.success('登记已添加');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.deleteIdcRegistration(deleteConfirm.id);
      load();
      setDetailModal(null);
      setDeleteConfirm(null);
      toast.success('已删除');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleAddAdjustment = async () => {
    if (!detailModal) return;
    setAddingAdjust(true);
    try {
      const updated = await api.addIdcAdjustment(detailModal.id, {
        adjustmentDate: adjustForm.adjustmentDate + 'T00:00:00',
        serverCountDelta: adjustForm.serverCountDelta,
        bandwidthDelta: adjustForm.bandwidthDelta,
        note: adjustForm.note.trim() || undefined,
      });
      setDetailModal(updated);
      setAdjustForm({
        adjustmentDate: new Date().toISOString().slice(0, 10),
        serverCountDelta: 0,
        bandwidthDelta: 0,
        note: '',
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAddingAdjust(false);
    }
  };

  const openDetail = async (r: IdcRegistration) => {
    try {
      const detail = await api.getIdcRegistration(r.id);
      setDetailModal(detail);
      setEditCostValue(0);
      setEditingCost(null);
      setAdjustForm({
        adjustmentDate: new Date().toISOString().slice(0, 10),
        serverCountDelta: 0,
        bandwidthDelta: 0,
        note: '',
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleSaveCost = async (costType: 'config' | 'bandwidth') => {
    if (!detailModal) return;
    try {
      const payload = costType === 'config' ? { configCost: editCostValue } : { bandwidthCost: editCostValue };
      await api.updateIdcRegistration(detailModal.id, payload);
      setDetailModal({ ...detailModal, ...payload });
      setEditingCost(null);
      toast.success('已保存');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">IDC 登记</h1>
          <p className="text-slate-500 text-sm mt-1">登记 IDC 合作资源，记录地区配置与带宽费用，支持调整历史</p>
        </div>
        <button
          onClick={() => {
            setModal('new');
            setForm({
              platformAccountId: platformAccounts[0]?.id || 0,
              region: '',
              config: '',
              serverCount: 0,
              bandwidth: 0,
              configCost: 0,
              bandwidthCost: 0,
              notes: '',
            });
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-md shadow-indigo-100"
        >
          <Plus size={18} />
          新增登记
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 px-4 py-3 mb-6">{error}</div>
      )}

      {!loading && list.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 text-slate-600 mt-1">
            <Filter size={18} />
            <span className="text-sm font-medium">筛选</span>
          </div>
          <div>
            <label className={labelClass}>平台</label>
            <select
              value={filter.platform}
              onChange={(e) => setFilter((f) => ({ ...f, platform: e.target.value }))}
              className={inputClass}
            >
              <option value="">全部</option>
              {platforms.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>账号</label>
            <select
              value={filter.accountId}
              onChange={(e) => setFilter((f) => ({ ...f, accountId: parseInt(e.target.value) }))}
              className={inputClass}
            >
              <option value={0}>全部</option>
              {platformAccounts
                .filter((a) => !filter.platform || a.platform.name === filter.platform)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.platform.name} - {a.accountName}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>地区</label>
            <select
              value={filter.region}
              onChange={(e) => setFilter((f) => ({ ...f, region: e.target.value }))}
              className={inputClass}
            >
              <option value="">全部</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>配置</label>
            <select
              value={filter.config}
              onChange={(e) => setFilter((f) => ({ ...f, config: e.target.value }))}
              className={inputClass}
            >
              <option value="">全部</option>
              {configs.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {(filter.platform || filter.accountId || filter.region || filter.config) && (
            <button
              onClick={() => setFilter({ platform: '', accountId: 0, region: '', config: '' })}
              className="px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-200 border border-slate-300"
            >
              清除筛选
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl bg-white border border-slate-200 p-12 text-center text-slate-500">加载中...</div>
      ) : list.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200 p-12 text-center text-slate-500">
          暂无登记，点击「新增登记」添加
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">平台 / 账号</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">地区</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">配置</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">数量</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">带宽</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">配置费用(总)</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">带宽费用(总)</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    无匹配的登记，可尝试调整筛选条件
                  </td>
                </tr>
              ) : (
                filteredList.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer"
                    onClick={() => openDetail(r)}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-medium text-slate-900">{r.platformAccount.platform.name}</span>
                        <span className="text-slate-500 text-sm block">{r.platformAccount.accountName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{r.region}</td>
                    <td className="px-6 py-4 text-slate-700">{r.config}</td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900">{r.serverCount} 台</td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900">{r.bandwidth}G</td>
                  <td className="px-6 py-4 text-right text-amber-600 font-medium">${calcConfigCostTotal(r.configCost, r.serverCount).toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-amber-600 font-medium">${calcBandwidthCostTotal(r.bandwidthCost, r.bandwidth).toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(r);
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                        title="查看详情与调整"
                      >
                        <History size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 新增登记弹窗 */}
      {modal === 'new' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">新增 IDC 登记</h2>
              <button onClick={() => setModal(null)} className="p-2 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelClass}>平台账号</label>
                <select
                  value={form.platformAccountId}
                  onChange={(e) => setForm({ ...form, platformAccountId: parseInt(e.target.value) })}
                  className={inputClass}
                >
                  <option value={0}>选择账号...</option>
                  {platformAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.platform.name} - {a.accountName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>地区</label>
                  <input
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. 香港"
                  />
                </div>
                <div>
                  <label className={labelClass}>配置</label>
                  <input
                    value={form.config}
                    onChange={(e) => setForm({ ...form, config: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. 8C"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>数量</label>
                  <input
                    type="number"
                    min={0}
                    value={form.serverCount}
                    onChange={(e) => setForm({ ...form, serverCount: parseInt(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>带宽 (G)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.bandwidth}
                    onChange={(e) => setForm({ ...form, bandwidth: parseInt(e.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>每台费用 ($)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.configCost}
                    onChange={(e) => setForm({ ...form, configCost: parseFloat(e.target.value) || 0 })}
                    className={inputClass}
                    placeholder="单台配置月费，按数量自动计算"
                  />
                </div>
                <div>
                  <label className={labelClass}>每Mb费用 ($)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.00001}
                    value={form.bandwidthCost}
                    onChange={(e) => setForm({ ...form, bandwidthCost: parseFloat(e.target.value) || 0 })}
                    className={inputClass}
                    placeholder="1G=1000Mb，按带宽自动计算"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>备注</label>
                <textarea
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={`${inputClass} resize-none`}
                  rows={2}
                  placeholder="合作说明等..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? '保存中...' : <><Check size={16} /> 保存</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 详情与调整弹窗 */}
      {detailModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {detailModal.platformAccount.platform.name} - {detailModal.platformAccount.accountName}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">{detailModal.region} · {detailModal.config}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDeleteConfirm({ id: detailModal.id })}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  title="删除"
                >
                  <Trash2 size={18} />
                </button>
                <button onClick={() => setDetailModal(null)} className="p-2 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs text-slate-500">当前数量</span>
                  <p className="text-xl font-bold text-slate-900">{detailModal.serverCount} 台</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">当前带宽</span>
                  <p className="text-xl font-bold text-slate-900">{detailModal.bandwidth}G</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">配置费用</span>
                  {editingCost === 'config' ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-sm">每台 $</span>
                        <input
                          type="number"
                          step={0.01}
                          value={editCostValue}
                          onChange={(e) => setEditCostValue(parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 rounded border border-slate-300 text-amber-600 font-bold text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveCost('config')} className="text-indigo-600 text-xs">保存</button>
                        <button onClick={() => setEditingCost(null)} className="text-slate-400 text-xs">取消</button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className="text-xl font-bold text-amber-600 cursor-pointer hover:bg-amber-50 rounded px-1"
                      onClick={() => { setEditingCost('config'); setEditCostValue(detailModal.configCost ?? 0); }}
                      title="点击修改每台单价，可随时修改"
                    >
                      ${calcConfigCostTotal(detailModal.configCost ?? 0, detailModal.serverCount).toFixed(2)}
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-xs text-slate-500">带宽费用</span>
                  {editingCost === 'bandwidth' ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-sm">每Mb $</span>
                        <input
                          type="number"
                          step={0.00001}
                          value={editCostValue}
                          onChange={(e) => setEditCostValue(parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 rounded border border-slate-300 text-amber-600 font-bold text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveCost('bandwidth')} className="text-indigo-600 text-xs">保存</button>
                        <button onClick={() => setEditingCost(null)} className="text-slate-400 text-xs">取消</button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className="text-xl font-bold text-amber-600 cursor-pointer hover:bg-amber-50 rounded px-1"
                      onClick={() => { setEditingCost('bandwidth'); setEditCostValue(detailModal.bandwidthCost ?? 0); }}
                      title="点击修改每Mb单价，可随时修改"
                    >
                      ${calcBandwidthCostTotal(detailModal.bandwidthCost ?? 0, detailModal.bandwidth).toFixed(2)}
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-xs text-slate-500">备注</span>
                  <p className="text-sm text-slate-700 truncate">{detailModal.notes || '-'}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">新增调整</h3>
                <div className="space-y-4 p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>调整日期</label>
                      <input
                        type="date"
                        value={adjustForm.adjustmentDate}
                        onChange={(e) => setAdjustForm({ ...adjustForm, adjustmentDate: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>数量变化（台）</label>
                      <input
                        type="number"
                        value={adjustForm.serverCountDelta === 0 ? '' : adjustForm.serverCountDelta}
                        onChange={(e) => setAdjustForm({ ...adjustForm, serverCountDelta: parseInt(e.target.value) || 0 })}
                        className={inputClass}
                        placeholder="+50 或 -20"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>带宽变化（G）</label>
                      <input
                        type="number"
                        value={adjustForm.bandwidthDelta === 0 ? '' : adjustForm.bandwidthDelta}
                        onChange={(e) => setAdjustForm({ ...adjustForm, bandwidthDelta: parseInt(e.target.value) || 0 })}
                        className={inputClass}
                        placeholder="+50 或 -20"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[180px]">
                      <label className={labelClass}>说明（可选）</label>
                      <input
                        value={adjustForm.note}
                        onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
                        className={inputClass}
                        placeholder="如：增加50台8C，带宽增加50G"
                      />
                    </div>
                    <button
                      onClick={handleAddAdjustment}
                      disabled={addingAdjust || (adjustForm.serverCountDelta === 0 && adjustForm.bandwidthDelta === 0)}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      {addingAdjust ? '添加中...' : '添加调整'}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">调整历史</h3>
                {detailModal.adjustments.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">暂无调整记录</p>
                ) : (
                  <div className="space-y-2">
                    {detailModal.adjustments.map((a) => {
                      const hasIncrease = a.serverCountDelta > 0 || a.bandwidthDelta > 0;
                      const hasDecrease = a.serverCountDelta < 0 || a.bandwidthDelta < 0;
                      const bgClass = hasIncrease ? 'bg-emerald-50 border-emerald-200' : hasDecrease ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200';
                      const textClass = hasIncrease ? 'text-emerald-700' : hasDecrease ? 'text-red-700' : 'text-slate-900';
                      return (
                        <div
                          key={a.id}
                          className={`flex items-center justify-between py-3 px-4 rounded-lg border text-sm ${bgClass}`}
                        >
                          <span className="text-slate-500">
                            {new Date(a.adjustmentDate).toLocaleDateString('zh-CN')}
                          </span>
                          <span className={`font-medium ${textClass}`}>
                            {a.serverCountDelta >= 0 ? '+' : ''}{a.serverCountDelta} 台
                            {a.bandwidthDelta !== 0 && (
                              <span className="ml-2">{a.bandwidthDelta >= 0 ? '+' : ''}{a.bandwidthDelta}G 带宽</span>
                            )}
                          </span>
                          {a.note && <span className="text-slate-500 text-xs truncate max-w-[200px]">{a.note}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteConfirm}
        title="删除登记"
        message="确定删除此登记吗？删除后无法恢复。"
        confirmLabel="删除"
        variant="danger"
        onConfirm={doDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
