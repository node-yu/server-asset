import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Eye, X, Check } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';

type Account = {
  id: number;
  platformId: number;
  platform: { name: string };
  accountName: string;
  password: string;
  notes?: string;
};

export default function AccountList() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [platforms, setPlatforms] = useState<{ id: number; name: string }[]>([]);
  const [stats, setStats] = useState<{ platformId: number; platformName: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'new' | Account | null>(null);
  const [passwordModal, setPasswordModal] = useState<string | null>(null);
  const [form, setForm] = useState({ platformId: 0, accountName: '', password: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState<number | ''>('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getPlatformAccounts(filterPlatform || undefined),
      api.getPlatforms(),
      api.getPlatformAccountStats(),
    ])
      .then(([a, p, s]) => {
        setAccounts(a as Account[]);
        setPlatforms(p);
        setStats(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), [filterPlatform]);

  const handleSave = async () => {
    if (!form.platformId || !form.accountName || !form.password) {
      toast.error('请填写平台、账号名和密码');
      return;
    }
    setSaving(true);
    try {
      if (modal === 'new') {
        await api.createPlatformAccount(form);
      } else if (modal && typeof modal === 'object') {
        await api.updatePlatformAccount(modal.id, {
          accountName: form.accountName,
          password: form.password,
          notes: form.notes || undefined,
        });
      }
      load();
      setModal(null);
      setForm({ platformId: 0, accountName: '', password: '', notes: '' });
      toast.success('已保存');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => setDeleteConfirm(id);
  const doDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.deletePlatformAccount(deleteConfirm);
      load();
      setDeleteConfirm(null);
      toast.success('已删除');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleShowPassword = async (id: number) => {
    try {
      const { password } = await api.getPlatformAccountPassword(id);
      setPasswordModal(password);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="p-8 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">账号管理</h1>
          <p className="text-slate-500 text-sm mt-1">管理各云平台的登录账号，可关联到服务器</p>
        </div>
        <button
          onClick={() => {
            setModal('new');
            setForm({ platformId: platforms[0]?.id || 0, accountName: '', password: '', notes: '' });
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-md shadow-indigo-100"
        >
          <Plus size={18} />
          新增账号
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {!loading && stats.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 p-4 mb-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">各平台账号数量</h3>
          <div className="flex flex-wrap gap-3">
            {stats.map((s) => (
              <span
                key={s.platformId}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-sm font-medium"
              >
                {s.platformName}: {s.count} 个
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value ? parseInt(e.target.value) : '')}
          className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm focus:border-indigo-500 outline-none"
        >
          <option value="">全部平台</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-500">加载中...</div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">平台</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">账号</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">备注</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      暂无账号，请先在「平台管理」添加平台，再点击「新增账号」
                    </td>
                  </tr>
                ) : (
                  accounts.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-800">{a.platform.name}</td>
                      <td className="px-6 py-4 text-slate-700">{a.accountName}</td>
                      <td className="px-6 py-4 text-slate-500 text-sm">{a.notes || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleShowPassword(a.id)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                            title="查看密码"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setModal(a);
                              setForm({
                                platformId: a.platformId,
                                accountName: a.accountName,
                                password: '',
                                notes: a.notes || '',
                              });
                            }}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                            title="编辑"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(a.id)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                            title="删除"
                          >
                            <Trash2 size={16} />
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

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md shadow-xl">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">
                {modal === 'new' ? '新增账号' : '编辑账号'}
              </h2>
              <button onClick={() => setModal(null)} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">平台</label>
                <select
                  value={form.platformId}
                  onChange={(e) => setForm({ ...form, platformId: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:border-indigo-500 outline-none"
                  disabled={modal !== 'new'}
                >
                  {platforms.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">账号名</label>
                <input
                  value={form.accountName}
                  onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:border-indigo-500 outline-none placeholder:text-slate-400"
                  placeholder="登录邮箱/用户名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">密码 {modal !== 'new' && '(留空不修改)'}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:border-indigo-500 outline-none placeholder:text-slate-400"
                  placeholder={modal !== 'new' ? '••••••••' : ''}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">备注</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:border-indigo-500 outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setModal(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || (modal === 'new' && !form.password)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {passwordModal !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setPasswordModal(null)}>
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-900">密码</h3>
              <button onClick={() => setPasswordModal(null)} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <p className="font-mono text-slate-900 break-all select-all bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg">
              {passwordModal}
            </p>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteConfirm}
        title="删除账号"
        message="确定删除该账号吗？"
        confirmLabel="删除"
        variant="danger"
        onConfirm={doDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
