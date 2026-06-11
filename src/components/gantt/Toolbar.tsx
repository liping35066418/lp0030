import { memo } from 'react';
import {
  ZoomIn, ZoomOut, Maximize2, Minimize2, Calendar, Camera,
  FolderPlus, ListTodo, Filter, Search, X, ChevronDown,
  Save, Undo2, Redo2, LayoutGrid,
} from 'lucide-react';
import { useGanttStore } from '@/store/ganttStore';
import { VIEW_SCALE_CONFIG } from '@/types/gantt';
import type { ViewScale } from '@/types/gantt';
import { cn } from '@/lib/utils';

const Toolbar = memo(function Toolbar() {
  const {
    currentProject, projects, setViewScale, viewScale, pixelPerUnit, zoom, setZoom,
    isFullscreen, set, showProjectModal, showTaskModal, showSnapshotModal,
    fetchProjectDetail, batchSet,
  } = useGanttStore();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      set('isFullscreen', true);
    } else {
      document.exitFullscreen();
      set('isFullscreen', false);
    }
  };

  const zoomCfg = VIEW_SCALE_CONFIG[viewScale];
  const zoomPercent = Math.round(((pixelPerUnit - zoomCfg.minZoom) / (zoomCfg.maxZoom - zoomCfg.minZoom)) * 100);

  return (
    <div className="sticky top-0 z-40 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900/95 backdrop-blur-md border-b border-slate-700/80 px-3 py-2.5 flex items-center gap-2 shadow-lg">
      <div className="flex items-center gap-2 pr-3 border-r border-slate-700/70">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <LayoutGrid size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-wide leading-tight">Gantt Pro</h1>
          <p className="text-[10px] text-slate-400 leading-tight">项目排期管理</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 pr-3 border-r border-slate-700/70">
        <select
          className="bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1.5 text-sm text-slate-200 outline-none hover:border-slate-600 focus:border-blue-500 transition-colors min-w-[160px]"
          value={currentProject?.id || ''}
          onChange={(e) => e.target.value && fetchProjectDetail(e.target.value)}
        >
          <option value="">选择项目...</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.taskCount ?? 0})
            </option>
          ))}
        </select>
        <button
          className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          onClick={() => { batchSet({ showProjectModal: true, currentProject: null }); }}
          title="新建项目"
        >
          <FolderPlus size={16} />
        </button>
        <button
          className="p-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          onClick={() => { set('editingTask', null); set('showTaskModal', true); }}
          title="新建任务"
        >
          <ListTodo size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1 pr-3 border-r border-slate-700/70">
        <div className="relative">
          <Calendar size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <select
            className="bg-slate-800 border border-slate-700 rounded-md pl-7 pr-6 py-1.5 text-sm text-slate-200 outline-none hover:border-slate-600 focus:border-blue-500 transition-colors appearance-none"
            value={viewScale}
            onChange={(e) => setViewScale(e.target.value as ViewScale)}
          >
            {(Object.keys(VIEW_SCALE_CONFIG) as ViewScale[]).map(k => (
              <option key={k} value={k}>{VIEW_SCALE_CONFIG[k].label}视图</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      </div>

      <div className="flex items-center gap-1 pr-3 border-r border-slate-700/70">
        <button
          className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors disabled:opacity-40"
          onClick={() => zoom(-10)}
          disabled={pixelPerUnit <= zoomCfg.minZoom}
          title="缩小"
        >
          <ZoomOut size={16} />
        </button>
        <div className="flex items-center gap-1 px-2 py-1 bg-slate-800/60 rounded-md border border-slate-700/50 min-w-[78px]">
          <input
            type="range"
            min={zoomCfg.minZoom}
            max={zoomCfg.maxZoom}
            step={5}
            value={pixelPerUnit}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-14 h-1 accent-blue-500 cursor-pointer"
          />
          <span className="text-[11px] text-slate-400 tabular-nums w-7 text-right">{zoomPercent}%</span>
        </div>
        <button
          className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors disabled:opacity-40"
          onClick={() => zoom(10)}
          disabled={pixelPerUnit >= zoomCfg.maxZoom}
          title="放大"
        >
          <ZoomIn size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1 pr-3 border-r border-slate-700/70">
        <button
          className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          onClick={() => set('showSnapshotModal', true)}
          title="版本快照"
        >
          <Camera size={16} />
        </button>
        <button
          className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          title="撤销 (未启用)"
          disabled
        >
          <Undo2 size={16} />
        </button>
        <button
          className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          title="重做 (未启用)"
          disabled
        >
          <Redo2 size={16} />
        </button>
        <button
          className="p-1.5 rounded-md bg-emerald-600/90 hover:bg-emerald-500 text-white transition-colors"
          onClick={async () => {
            if (!currentProject) return;
            const name = `快照-${new Date().toLocaleString('zh-CN')}`;
            await useGanttStore.getState().createSnapshot(name);
          }}
          title="快速保存快照"
        >
          <Save size={16} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-end gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            placeholder="搜索任务..."
            className="bg-slate-800 border border-slate-700 rounded-md pl-8 pr-7 py-1.5 text-sm text-slate-200 outline-none hover:border-slate-600 focus:border-blue-500 transition-colors placeholder:text-slate-500 w-48"
            value={useGanttStore.getState().searchText}
            onChange={(e) => useGanttStore.getState().set('searchText', e.target.value)}
          />
          {useGanttStore.getState().searchText && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              onClick={() => useGanttStore.getState().set('searchText', '')}
            >
              <X size={13} />
            </button>
          )}
        </div>
        <button
          className={cn(
            'p-1.5 rounded-md border transition-colors',
            isFullscreen
              ? 'bg-amber-600 hover:bg-amber-500 border-amber-500 text-white'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300',
          )}
          onClick={toggleFullscreen}
          title={isFullscreen ? '退出全屏' : '全屏预览'}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {currentProject && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 text-[10px] text-slate-500 pointer-events-none">
          {currentProject.timezone !== 'UTC' && `时区: ${currentProject.timezone}`}
        </div>
      )}

      {showProjectModal && null}
      {showTaskModal && null}
      {showSnapshotModal && null}
      {batchSet && null}
    </div>
  );
});

export default Toolbar;
