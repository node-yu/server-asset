import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Check, ArrowRight } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b',
  '#06b6d4', '#14b8a6', '#6366f1', '#f43f5e', '#64748b',
];

type Group = { id: number; name: string; projects: { id: number; name: string; color?: string | null }[] };

export default function ProjectList() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<{ id: number; name: string } | 'new' | null>(null);
  const [editingProject, setEditingProject] = useState<{ id: number; name: string; groupId: number; color?: string | null } | 'new' | null>(null);
  const [movingProject, setMovingProject] = useState<{ id: number; name: string; currentGroupId: number } | null>(null);
  const [groupName, setGroupName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectColor, setProjectColor] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [moveTargetGroupId, setMoveTargetGroupId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'group' | 'project'; id: number; name: string; projectCount?: number } | null>(null);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    setError(null);
    api.getGroups().then(setGroups).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const handleSaveGroup = async () => {
    if (!groupName.trim()) return;
    setSaving(true);
    try {
      if (editingGroup === 'new') {
        await api.createGroup(groupName.trim());
      } else if (editingGroup) {
        await api.updateGroup(editingGroup.id, groupName.trim());
      }
      load();
      setEditingGroup(null);
      setGroupName('');
      toast.success('已保存');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProject = async () => {
    if (!projectName.trim()) return;
    setSaving(true);
    try {
      if (editingProject === 'new') {
        if (!selectedGroupId) {
          toast.error('请先选择分组');
          setSaving(false);
          return;
        }
        await api.createProject(selectedGroupId, projectName.trim(), projectColor || undefined);
      } else if (editingProject) {
        await api.updateProject(editingProject.id, projectName.trim(), projectColor || undefined);
      }
      load();
      setEditingProject(null);
      setProjectName('');
      setProjectColor('');
      setSelectedGroupId(null);
      toast.success('已保存');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleMoveProject = async () => {
    if (!movingProject || !moveTargetGroupId || moveTargetGroupId === movingProject.currentGroupId) return;
    setSaving(true);
    try {
      await api.moveProject(movingProject.id, moveTargetGroupId);
      load();
      setMovingProject(null);
      setMoveTargetGroupId(null);
      toast.success('已移动');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = (id: number, name: string) => {
    const g = groups.find((x) => x.id === id);
    setDeleteConfirm({ type: 'group', id, name, projectCount: g?.projects.length });
  };
  const handleDeleteProject = (id: number, name: string) => {
    setDeleteConfirm({ type: 'project', id, name });
  };
  const doDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'group') {
        await api.deleteGroup(deleteConfirm.id);
      } else {
        await api.deleteProject(deleteConfirm.id);
      }
      load();
      setDeleteConfirm(null);
      toast.success('已删除');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">项目组管理</h1>
          <p className="text-slate-500 text-sm mt-1">管理项目分组及下属项目</p>
        </div>
        <button
          onClick={() => {
            setEditingGroup('new');
            setGroupName('');
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-md shadow-indigo-100"
        >
          <Plus size={18} />
          新增分组
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
        <div className="space-y-6">
          {editingGroup && (
            <div className="rounded-xl border border-slate-200 p-4 bg-white shadow-sm flex items-center gap-3">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="输入分组名称（如 A组、B组）"
                className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-400"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveGroup()}
              />
              <button
                onClick={handleSaveGroup}
                disabled={saving || !groupName.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Check size={16} /> {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => {
                  setEditingGroup(null);
                  setGroupName('');
                }}
                className="p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {groups.length === 0 && !editingGroup && (
            <div className="rounded-xl border border-slate-200 p-12 text-center text-slate-500 bg-white">
              暂无分组，点击「新增分组」添加 A组、B组 等，再在各分组下添加项目。
            </div>
          )}

          {groups.map((group) => (
            <div
              key={group.id}
              className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm"
            >
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-900">{group.name}</span>
                  <span className="text-sm text-slate-500">
                    {group.projects.length} 个项目
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingProject('new');
                      setSelectedGroupId(group.id);
                      setProjectName('');
                      setProjectColor('');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600"
                  >
                    <Plus size={14} /> 添加项目
                  </button>
                  <button
                    onClick={() => {
                      setEditingGroup(group);
                      setGroupName(group.name);
                    }}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                    title="编辑分组"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group.id, group.name)}
                    className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                    title="删除分组"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-200">
                {group.projects.length === 0 && (
                  <div className="px-6 py-8 text-center text-slate-500 text-sm">
                    该分组下暂无项目，点击「添加项目」添加
                  </div>
                )}
                {group.projects.map((project) => (
                  <div
                    key={project.id}
                    className="px-6 py-3 flex items-center justify-between hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      {project.color && (
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-slate-200"
                          style={{ backgroundColor: project.color }}
                          title={project.color}
                        />
                      )}
                      <span className="font-medium text-slate-800">{project.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setMovingProject({ id: project.id, name: project.name, currentGroupId: group.id })}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
                        title="移动到其他分组"
                      >
                        <ArrowRight size={14} /> 移动
                      </button>
                      <button
                        onClick={() => {
                          setEditingProject({ id: project.id, name: project.name, groupId: group.id, color: project.color });
                          setProjectName(project.name);
                          setProjectColor(project.color || '');
                        }}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                        title="编辑"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteProject(project.id, project.name)}
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
          ))}

          {editingProject && (
            <div className="rounded-xl border border-indigo-200 p-4 bg-white shadow-sm space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {editingProject === 'new' ? (
                  <select
                    value={selectedGroupId ?? ''}
                    onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
                    className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:border-indigo-500 outline-none"
                  >
                    <option value="">选择分组</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                ) : null}
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="输入项目名称"
                  className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:border-indigo-500 outline-none placeholder:text-slate-400"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveProject()}
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">颜色：</span>
                  <div className="flex gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setProjectColor(projectColor === c ? '' : c)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          projectColor === c ? 'border-slate-800 scale-110' : 'border-slate-200 hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                  <input
                    type="text"
                    value={PRESET_COLORS.includes(projectColor) ? '' : projectColor}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setProjectColor(v);
                    }}
                    placeholder="#自定义"
                    className="w-20 px-2 py-1 text-xs rounded border border-slate-200 font-mono placeholder:text-slate-400"
                  />
                  {projectColor && (
                    <button
                      type="button"
                      onClick={() => setProjectColor('')}
                      className="text-xs text-slate-500 hover:text-slate-700 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
                <button
                onClick={handleSaveProject}
                disabled={saving || !projectName.trim() || (editingProject === 'new' && !selectedGroupId)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shrink-0"
              >
                <Check size={16} /> {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={() => {
                  setEditingProject(null);
                  setProjectName('');
                  setProjectColor('');
                  setSelectedGroupId(null);
                }}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
              >
                <X size={18} />
              </button>
              </div>
            </div>
          )}

          {movingProject && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-xl">
                <h3 className="font-semibold text-slate-900 mb-4">
                  将「{movingProject.name}」移动到
                </h3>
                <select
                  value={moveTargetGroupId ?? ''}
                  onChange={(e) => setMoveTargetGroupId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:border-indigo-500 outline-none mb-4"
                >
                  <option value="">选择目标分组</option>
                  {groups
                    .filter((g) => g.id !== movingProject.currentGroupId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setMovingProject(null);
                      setMoveTargetGroupId(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleMoveProject}
                    disabled={saving || !moveTargetGroupId}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? '移动中...' : '确认移动'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <ConfirmModal
            open={!!deleteConfirm}
            title={deleteConfirm?.type === 'group' ? '删除分组' : '删除项目'}
            message={
              deleteConfirm
                ? deleteConfirm.type === 'group' && (deleteConfirm.projectCount ?? 0) > 0
                  ? `分组「${deleteConfirm.name}」下还有 ${deleteConfirm.projectCount} 个项目，删除后项目将一并删除。确定吗？`
                  : `确定删除${deleteConfirm.type === 'group' ? '分组' : '项目'}「${deleteConfirm.name}」吗？`
                : ''
            }
            confirmLabel="删除"
            variant="danger"
            onConfirm={doDelete}
            onCancel={() => setDeleteConfirm(null)}
          />
        </div>
      )}
    </div>
  );
}
