import { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Tag, FolderKanban, User, Link2, Trash2, Plus, Layers } from 'lucide-react';
import { useGanttStore } from '@/store/ganttStore';
import type { Task, TaskType, TaskStatus, DependencyType } from '@/types/gantt';
import { TYPE_CONFIG, STATUS_CONFIG, DEP_TYPE_CONFIG } from '@/types/gantt';
import { cn } from '@/lib/utils';
import { formatDate, parseTags } from '@/lib/gantt-utils';

const COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#10b981', '#06b6d4', '#6366f1', '#14b8a6', '#f97316',
  '#a855f7', '#64748b', '#22c55e', '#0ea5e9', '#f43f5e',
];

const TaskModal = () => {
  const {
    showTaskModal, set, editingTask, createTask, updateTask, deleteTask,
    currentProject, tasks, dependencies, groups, tags, removeDependency,
    refreshCurrentProject, createGroup, createTag,
  } = useGanttStore();

  const [form, setForm] = useState<Partial<Task>>({
    name: '', description: '', type: 'task', status: 'not_started',
    startDate: '', endDate: '', progress: 0, groupId: null,
    tags: '[]', color: '#3b82f6', assignee: '', parentId: null,
  });
  const [newGroupName, setNewGroupName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [selTags, setSelTags] = useState<string[]>([]);
  const [depType, setDepType] = useState<DependencyType>('fs');
  const [depLag, setDepLag] = useState(0);
  const [addDepId, setAddDepId] = useState('');

  const deps = useMemo(() => dependencies.filter(d => editingTask && (d.fromTaskId === editingTask.id || d.toTaskId === editingTask.id)), [dependencies, editingTask]);
  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);

  useEffect(() => {
    if (!showTaskModal) return;
    if (editingTask) {
      setForm({ ...editingTask });
      setSelTags(parseTags(editingTask.tags));
    } else {
      const today = new Date();
      const end = new Date(today); end.setDate(end.getDate() + 3);
      setForm({
        name: '', description: '', type: 'task', status: 'not_started',
        startDate: today.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        progress: 0, groupId: null, tags: '[]', color: '#3b82f6', assignee: '', parentId: null,
      });
      setSelTags([]);
    }
  }, [showTaskModal, editingTask]);

  if (!showTaskModal) return null;
  if (!currentProject) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Partial<Task> & { projectId: string } = {
      ...form,
      startDate: new Date(form.startDate!).toISOString(),
      endDate: new Date(form.endDate!).toISOString(),
      tags: JSON.stringify(selTags),
      projectId: currentProject.id,
    };
    if (editingTask) {
      await updateTask(editingTask.id, body);
    } else {
      await createTask(body);
    }
    set('showTaskModal', false);
  };

  const toggleTag = (id: string) => {
    setSelTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4" onClick={() => set('showTaskModal', false)}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl animate-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${form.color}, ${form.color}cc)` }}>
              <Layers size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{editingTask ? '编辑任务' : '新建任务'}</h2>
              <p className="text-xs text-slate-400">{editingTask ? `修改任务配置 · 最后更新 ${formatDate(editingTask.updatedAt, 'YYYY-MM-DD HH:mm')}` : '创建新任务并配置参数'}</p>
            </div>
          </div>
          <button type="button" onClick={() => set('showTaskModal', false)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-x-5 gap-y-4">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block">任务名称</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
              placeholder="输入任务名称..."
              required
              autoFocus
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block">任务描述</label>
            <textarea
              value={form.description || ''}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 resize-none"
              placeholder="详细描述..."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block">任务类型</label>
            <div className="flex gap-1.5">
              {(Object.keys(TYPE_CONFIG) as TaskType[]).map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm({ ...form, type: k })}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all border',
                    form.type === k
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600',
                  )}
                >
                  {TYPE_CONFIG[k].icon} {TYPE_CONFIG[k].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block">任务状态</label>
            <select
              value={form.status}
              onChange={e => {
                const ns = e.target.value as TaskStatus;
                const patch: Partial<Task> = { status: ns };
                if (ns === 'completed') patch.progress = 100;
                else if (ns === 'not_started') patch.progress = 0;
                setForm({ ...form, ...patch });
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            >
              {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map(k => (
                <option key={k} value={k}>{STATUS_CONFIG[k].label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block flex items-center gap-1">
              <Calendar size={12} /> 开始日期
            </label>
            <input
              type="date"
              value={(form.startDate || '').slice(0, 10)}
              onChange={e => setForm({ ...form, startDate: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block flex items-center gap-1">
              <Calendar size={12} /> 结束日期
            </label>
            <input
              type="date"
              value={(form.endDate || '').slice(0, 10)}
              onChange={e => setForm({ ...form, endDate: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block">
              进度: <span className="text-blue-400 font-bold ml-1">{form.progress}%</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0} max={100} step={5}
                value={form.progress || 0}
                onChange={e => setForm({ ...form, progress: Number(e.target.value) })}
                className="flex-1 h-2 accent-blue-500"
              />
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all" style={{ width: `${form.progress || 0}%` }} />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block">父任务</label>
            <select
              value={form.parentId || ''}
              onChange={e => setForm({ ...form, parentId: e.target.value || null })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            >
              <option value="">— 顶级任务 —</option>
              {tasks
                .filter(t => !editingTask || (t.id !== editingTask.id))
                .filter(t => t.type === 'summary' || t.parentId === null)
                .map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block flex items-center gap-1">
              <FolderKanban size={12} /> 任务分组
            </label>
            <div className="flex gap-1.5">
              <select
                value={form.groupId || ''}
                onChange={e => setForm({ ...form, groupId: e.target.value || null })}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              >
                <option value="">— 未分组 —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              {newGroupName && (
                <button
                  type="button"
                  onClick={async () => { const id = await createGroup(newGroupName); if (id) { setForm({ ...form, groupId: id }); setNewGroupName(''); } }}
                  className="px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                  title="创建分组"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
            <input
              type="text"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="新分组名..."
              className="mt-1.5 w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-2 py-1 text-xs text-white outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block flex items-center gap-1">
              <User size={12} /> 负责人
            </label>
            <input
              type="text"
              value={form.assignee || ''}
              onChange={e => setForm({ ...form, assignee: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              placeholder="输入负责人..."
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block flex items-center gap-1">
              <Tag size={12} /> 标签分类
            </label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {tags.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className={cn(
                    'px-2 py-1 rounded-md text-xs font-medium transition-all border',
                    selTags.includes(t.id)
                      ? 'text-white border-transparent shadow-md'
                      : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:border-slate-500',
                  )}
                  style={selTags.includes(t.id) ? { backgroundColor: t.color, boxShadow: `0 0 8px ${t.color}60` } : {}}
                >
                  {t.name}
                </button>
              ))}
            </div>
            {newTagName && (
              <button
                type="button"
                onClick={async () => { await createTag(newTagName, COLORS[Math.floor(Math.random() * COLORS.length)]); setNewTagName(''); }}
                className="text-xs px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                创建「{newTagName}」
              </button>
            )}
            <input
              type="text"
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              placeholder="输入新标签名 + Enter创建..."
              className="mt-1 w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-2 py-1 text-xs text-white outline-none"
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block">任务颜色</label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={cn(
                    'w-7 h-7 rounded-lg transition-all',
                    form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-105',
                  )}
                  style={{ backgroundColor: c, boxShadow: `0 2px 8px ${c}40` }}
                />
              ))}
            </div>
          </div>

          {editingTask && (
            <div className="col-span-2 pt-3 border-t border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1">
                  <Link2 size={12} /> 任务依赖关系
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={depType}
                    onChange={e => setDepType(e.target.value as DependencyType)}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none"
                  >
                    {(Object.keys(DEP_TYPE_CONFIG) as DependencyType[]).map(k => (
                      <option key={k} value={k}>{DEP_TYPE_CONFIG[k].label} - {DEP_TYPE_CONFIG[k].desc}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={depLag}
                    onChange={e => setDepLag(Number(e.target.value))}
                    className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none"
                    placeholder="延后天数"
                  />
                  <select
                    value={addDepId}
                    onChange={e => setAddDepId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none max-w-[180px]"
                  >
                    <option value="">选择任务添加依赖...</option>
                    {tasks.filter(t => t.id !== editingTask.id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button
                    type="button"
                    disabled={!addDepId}
                    onClick={async () => {
                      if (!addDepId) return;
                      await useGanttStore.getState().addDependency({
                        projectId: currentProject.id,
                        fromTaskId: addDepId,
                        toTaskId: editingTask.id,
                        type: depType,
                        lag: depLag,
                      });
                      setAddDepId('');
                      await refreshCurrentProject();
                    }}
                    className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {deps.length === 0 && <p className="text-xs text-slate-500 italic px-2 py-3 text-center border border-dashed border-slate-700 rounded">暂无依赖关系，从甘特图拖拽连接点或在上方快速添加</p>}
                {deps.map(d => {
                  const isFrom = d.fromTaskId === editingTask.id;
                  const other = taskMap.get(isFrom ? d.toTaskId : d.fromTaskId);
                  return (
                    <div key={d.id} className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2">
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded font-bold',
                        d.type === 'fs' ? 'bg-slate-600 text-white' : d.type === 'ss' ? 'bg-sky-600 text-white' : d.type === 'ff' ? 'bg-orange-600 text-white' : 'bg-purple-600 text-white',
                      )}>{DEP_TYPE_CONFIG[d.type].label}</span>
                      <span className="text-xs text-slate-400">{isFrom ? '→' : '←'}</span>
                      <span className="text-sm text-slate-200 flex-1 truncate">{other?.name || '(已删除)'}</span>
                      {d.lag > 0 && <span className="text-[10px] text-amber-400 font-medium">+{d.lag}d</span>}
                      <button
                        type="button"
                        onClick={async () => { await removeDependency(d.id); await refreshCurrentProject(); }}
                        className="p-1 rounded hover:bg-rose-600/30 text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center px-5 py-4 border-t border-slate-700/60 bg-slate-900/50 sticky bottom-0 backdrop-blur-sm">
          {editingTask ? (
            <button
              type="button"
              onClick={async () => {
                if (!confirm(`确定删除「${editingTask.name}」及其所有子任务？`)) return;
                await deleteTask(editingTask.id);
                set('showTaskModal', false);
              }}
              className="px-3 py-2 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-medium transition-colors flex items-center gap-1"
            >
              <Trash2 size={14} /> 删除任务
            </button>
          ) : <div />}
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={() => set('showTaskModal', false)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all',
                'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/30',
              )}
            >
              {editingTask ? '保存修改' : '创建任务'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default TaskModal;
