import { useEffect, useMemo, useState } from 'react';
import { useGanttStore } from '@/store/ganttStore';
import { Plus, FolderOpen, Calendar, Layers, Trash2, Search, Sparkles } from 'lucide-react';
import { formatDate } from '@/lib/gantt-utils';
import type { Project } from '@/types/gantt';
import { STATUS_CONFIG } from '@/types/gantt';
import { cn } from '@/lib/utils';

interface Props {
  onOpenProject: (id: string) => void;
}

export default function ProjectList({ onOpenProject }: Props) {
  const {
    projects, fetchProjects, fetchProjectDetail, deleteProject, createProject, set, tasks, batchSet,
  } = useGanttStore();
  const [search, setSearch] = useState('');

  useEffect(() => { void fetchProjects(); }, [fetchProjects]);

  const filtered = useMemo(() => {
    if (!search) return projects;
    const s = search.toLowerCase();
    return projects.filter(p => p.name.toLowerCase().includes(s) || (p.description || '').toLowerCase().includes(s));
  }, [projects, search]);

  const stats = useMemo(() => {
    const total = projects.length;
    const totalTasks = projects.reduce((s, p) => s + (p.taskCount || 0), 0);
    return { total, totalTasks };
  }, [projects]);

  void tasks;

  const handleCreateDemo = async () => {
    const today = new Date();
    const end = new Date(today); end.setMonth(end.getMonth() + 3);
    const id = await createProject({
      name: '新产品研发项目示例',
      description: '包含完整研发流程：需求→设计→开发→测试→上线的全流程任务编排。',
      timezone: 'Asia/Shanghai',
      startDate: today.toISOString(),
      endDate: end.toISOString(),
    });
    if (id) await fetchProjectDetail(id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 text-white overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-8">
        <header className="mb-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/40">
                  <Layers size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-indigo-200 bg-clip-text text-transparent tracking-tight">
                    Gantt Pro
                  </h1>
                  <p className="text-sm text-slate-400">专业级项目甘特图排期与进度管理系统</p>
                </div>
              </div>
              <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
                可视化任务编排、智能联动依赖、进度实时追踪。拖拽即所得，团队协同更高效。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { batchSet({ showProjectModal: true, currentProject: null }); }}
                className="px-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-sm font-semibold text-slate-200 transition-all flex items-center gap-2"
              >
                <Plus size={16} /> 新建项目
              </button>
              <button
                onClick={handleCreateDemo}
                className={cn(
                  'px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center gap-2',
                  'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500',
                  'shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5',
                )}
              >
                <Sparkles size={16} /> 快速体验 (示例项目)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-8">
            {[
              { label: '项目总数', value: stats.total, hint: 'projects', color: 'from-blue-500 to-cyan-500', icon: <FolderOpen size={20} /> },
              { label: '任务总数', value: stats.totalTasks, hint: 'tasks', color: 'from-emerald-500 to-teal-500', icon: <Layers size={20} /> },
              { label: '任务完成率', value: Math.round((tasks.filter(t => t.status === 'completed').length / Math.max(1, tasks.length)) * 100) + '%', hint: 'completion', color: 'from-amber-500 to-orange-500', icon: <Calendar size={20} /> },
              { label: '进行中', value: tasks.filter(t => t.status === 'in_progress').length, hint: 'active', color: 'from-rose-500 to-pink-500', icon: <Calendar size={20} /> },
            ].map((s, i) => (
              <div key={i} className="group p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700 transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{s.label}</p>
                    <p className="text-2xl font-bold text-white mt-1 tabular-nums">{s.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg opacity-90`}>
                    {s.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </header>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FolderOpen size={18} className="text-slate-400" /> 全部项目
          </h2>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索项目..."
              className="bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white outline-none focus:border-blue-500/60 w-64"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(p => <ProjectCard key={p.id} project={p} onOpen={onOpenProject} onDelete={deleteProject} />)}
          {filtered.length === 0 && (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-700/60 rounded-3xl">
              <div className="w-20 h-20 rounded-3xl bg-slate-800/60 flex items-center justify-center mb-4">
                <FolderOpen size={32} className="text-slate-500" />
              </div>
              <p className="text-slate-400 font-semibold">还没有项目</p>
              <p className="text-slate-500 text-sm mt-1 mb-5">点击右上角创建一个新项目，或生成示例项目快速体验</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { batchSet({ showProjectModal: true, currentProject: null }); }}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-semibold text-white"
                >
                  新建项目
                </button>
                <button
                  onClick={handleCreateDemo}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30"
                >
                  生成示例项目
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="mt-12 text-center text-xs text-slate-500">
          <p>Gantt Pro · 专业项目排期管理系统 · 数据存储于端口 8650 服务</p>
        </footer>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(1deg); }
        }
      `}</style>
    </div>
  );
}

function ProjectCard({
  project, onOpen, onDelete,
}: { project: Project & { taskCount?: number }; onOpen: (id: string) => void; onDelete: (id: string) => Promise<void> }) {
  const duration = Math.max(1, Math.ceil((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / 86400000));
  const today = new Date();
  const total = Math.max(1, duration);
  const progress = Math.min(100, Math.max(0, Math.round(((today.getTime() - new Date(project.startDate).getTime()) / (new Date(project.endDate).getTime() - new Date(project.startDate).getTime())) * 100)));

  return (
    <div
      onClick={() => onOpen(project.id)}
      className="group relative p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm hover:border-indigo-500/40 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/15 overflow-hidden"
    >
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative flex items-start justify-between mb-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/40 flex items-center justify-center">
          <FolderOpen size={20} className="text-slate-300" />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm('确定删除此项目？')) void onDelete(project.id); }}
          className="p-2 rounded-lg hover:bg-rose-600/20 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <h3 className="text-lg font-bold text-white mb-1.5 truncate group-hover:text-indigo-200 transition-colors">
        {project.name}
      </h3>
      <p className="text-xs text-slate-400 line-clamp-2 mb-4 h-8 leading-relaxed">
        {project.description || '暂无项目描述，点击进入开始编辑项目详情。'}
      </p>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/20">
          <Calendar size={10} /> {duration}天排期
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
          <Layers size={10} /> {project.taskCount || 0} 任务
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-slate-700/50 text-slate-300 border border-slate-600/40">
          {project.timezone}
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
          <span>时间进度</span>
          <span className="text-slate-300 font-medium tabular-nums">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
        <span>{formatDate(project.startDate, 'MM/DD')} → {formatDate(project.endDate, 'MM/DD')}</span>
        <span className="group-hover:text-indigo-400 font-semibold transition-colors flex items-center gap-1">
          打开项目 <span aria-hidden>→</span>
        </span>
      </div>
      <div style={{ display: 'none' }}>{Object.keys(STATUS_CONFIG).length}</div>
    </div>
  );
}
