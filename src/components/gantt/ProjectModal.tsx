import { useState, useEffect, useRef } from 'react';
import { X, Folder, Calendar, Globe2 } from 'lucide-react';
import { useGanttStore } from '@/store/ganttStore';
import { cn } from '@/lib/utils';

const TIMEZONES = [
  'UTC',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Kolkata',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Australia/Sydney',
];

const ProjectModal = () => {
  const { showProjectModal, set, createProject, currentProject, updateProject, deleteProject, fetchProjects, projects } = useGanttStore();
  const [form, setForm] = useState({ name: '', description: '', timezone: 'UTC', startDate: '', endDate: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (showProjectModal && !initRef.current) {
      if (currentProject) {
        setForm({
          name: currentProject.name,
          description: currentProject.description || '',
          timezone: currentProject.timezone,
          startDate: currentProject.startDate.slice(0, 10),
          endDate: currentProject.endDate.slice(0, 10),
        });
        setEditingId(currentProject.id);
      } else {
        const today = new Date();
        const end = new Date(); end.setMonth(end.getMonth() + 3);
        setForm({
          name: '', description: '', timezone: 'UTC',
          startDate: today.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
        });
        setEditingId(null);
      }
      initRef.current = true;
    }
    if (!showProjectModal) initRef.current = false;
  }, [showProjectModal, currentProject]);

  if (!showProjectModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.startDate || !form.endDate) return;
    if (editingId) {
      await updateProject(editingId, {
        ...form,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      });
    } else {
      const id = await createProject({
        ...form,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      });
      if (id) {
        await useGanttStore.getState().fetchProjectDetail(id);
      }
    }
    set('showProjectModal', false);
    await fetchProjects();
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (!confirm('确定删除此项目？所有任务和数据将被清除，无法恢复！')) return;
    await deleteProject(editingId);
    set('showProjectModal', false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4" onClick={() => set('showProjectModal', false)}>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden animate-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 bg-gradient-to-r from-indigo-600/10 to-purple-600/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Folder size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{editingId ? '编辑项目' : '新建项目'}</h2>
              <p className="text-xs text-slate-400">配置项目基础信息和时间范围</p>
            </div>
          </div>
          <button type="button" onClick={() => set('showProjectModal', false)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block">项目名称</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              placeholder="输入项目名称..."
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block">项目描述</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 resize-none"
              placeholder="简要描述项目目标和范围..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block flex items-center gap-1">
                <Calendar size={12} /> 开始日期
              </label>
              <input
                type="date"
                value={form.startDate}
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
                value={form.endDate}
                onChange={e => setForm({ ...form, endDate: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1.5 block flex items-center gap-1">
              <Globe2 size={12} /> 项目时区
            </label>
            <select
              value={form.timezone}
              onChange={e => setForm({ ...form, timezone: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          {editingId && (
            <div className="pt-2 border-t border-slate-700/50">
              <p className="text-xs text-slate-400 mb-2">项目管理</p>
              <div className="flex gap-2">
                <select
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none"
                  value=""
                  onChange={async e => {
                    if (e.target.value) {
                      await useGanttStore.getState().fetchProjectDetail(e.target.value);
                      set('showProjectModal', false);
                    }
                  }}
                >
                  <option value="">切换项目...</option>
                  {projects.filter(p => p.id !== editingId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-sm font-medium transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-700/60 bg-slate-900/50">
          <button
            type="button"
            onClick={() => set('showProjectModal', false)}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all',
              'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-indigo-500/20',
            )}
          >
            {editingId ? '保存修改' : '创建项目'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectModal;
