import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';

export default function PlatformList() {
  const [list, setList] = useState<{ id: number; name: string; isIdcSupplier?: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: number; name: string; isIdcSupplier?: boolean } | 'new' | null>(null);
  const [name, setName] = useState('');
  const [isIdcSupplier, setIsIdcSupplier] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    setError(null);
    api.getPlatforms().then(setList).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing === 'new') {
        await api.createPlatform(name.trim(), isIdcSupplier);
      } else if (editing) {
        await api.updatePlatform(editing.id, name.trim(), isIdcSupplier);
      }
      load();
      setEditing(null);
      setName('');
      setIsIdcSupplier(false);
      toast.success('已保存');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number, n: string) => setDeleteConfirm({ id, name: n });
  const doDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.deletePlatform(deleteConfirm.id);
      load();
      setDeleteConfirm(null);
      toast.success('已删除');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="p-8 max-w-[800px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">平台管理</h1>
          <p className="text-slate-500 text-sm mt-1">管理云服务供应商（如阿里云、腾讯云、AWS）</p>
        </div>
        <button
          onClick={() => { setEditing('new'); setName(''); setIsIdcSupplier(false); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-md shadow-indigo-100"
        >
          <Plus size={18} />
          新增平台
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-slate-500">加载中...</div>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <div className="divide-y divide-slate-200">
            {list.length === 0 && !editing && (
              <div className="px-6 py-12 text-center text-slate-500">
                暂无平台，点击「新增平台」添加。添加后可在新增服务器时从下拉菜单选择。
              </div>
            )}
            {editing && (
              <div className="px-6 py-4 bg-slate-50 flex flex-wrap items-center gap-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="输入平台名称（如：阿里云、腾讯云）"
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-400"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isIdcSupplier}
                    onChange={(e) => setIsIdcSupplier(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-600">IDC 供应商</span>
                </label>
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Check size={16} /> {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => { setEditing(null); setName(''); setIsIdcSupplier(false); }}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            {list.map((item) => (
              <div key={item.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{item.name}</span>
                  {item.isIdcSupplier && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">IDC</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditing(item); setName(item.name); setIsIdcSupplier(item.isIdcSupplier ?? false); }}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                    title="编辑"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id, item.name)}
                    className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                    title="删除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteConfirm}
        title="删除平台"
        message={deleteConfirm ? `确定删除平台「${deleteConfirm.name}」吗？` : ''}
        confirmLabel="删除"
        variant="danger"
        onConfirm={doDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
