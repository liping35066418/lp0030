import { useMemo, memo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { TreeNode, FlatTask } from '@/types/gantt';
import { TYPE_CONFIG, STATUS_CONFIG } from '@/types/gantt';
import { cn } from '@/lib/utils';
import { useGanttStore } from '@/store/ganttStore';
import { formatDate, parseTags } from '@/lib/gantt-utils';

interface Props {
  onRowDragStart: (e: React.DragEvent, id: string) => void;
  onRowDragOver: (e: React.DragEvent, id: string) => void;
  onRowDrop: (e: React.DragEvent, id: string) => void;
  onRowDragEnd: () => void;
  dragOverId: string | null;
  dragOverPosition: 'before' | 'after' | 'inside' | null;
}

const SidebarRow = memo(function SidebarRow({
  task, rowIndex,
  onRowDragStart, onRowDragOver, onRowDrop, onRowDragEnd,
  dragOverId, dragOverPosition,
}: {
  task: FlatTask;
  rowIndex: number;
} & Props) {
  const {
    toggleExpand, selectedTaskId, hoveredTaskId,
    set, rowHeight, tags, groups, searchText, currentProject,
  } = useGanttStore();
  const taskTags = useMemo(() => parseTags(task.tags).map(id => tags.find(t => t.id === id)).filter(Boolean) as Array<{ id: string; name: string; color: string }>, [task.tags, tags]);
  const group = groups.find(g => g.id === task.groupId);

  const matches = useMemo(() => {
    if (!searchText) return true;
    return task.name.toLowerCase().includes(searchText.toLowerCase());
  }, [searchText, task.name]);

  if (!matches) return null;

  const isSel = selectedTaskId === task.id;
  const isHover = hoveredTaskId === task.id;
  const statusCfg = STATUS_CONFIG[task.status];
  const typeCfg = TYPE_CONFIG[task.type];
  const hasChildren = task.type === 'summary' || task.parentId === null;
  void hasChildren;

  return (
    <div
      className={cn(
        'group relative flex items-center gap-1.5 border-b border-slate-700/40 transition-colors',
        isSel ? 'bg-blue-600/10' : isHover ? 'bg-slate-800/40' : 'hover:bg-slate-800/20',
        'cursor-pointer',
      )}
      style={{ height: rowHeight, paddingLeft: 8 + task.level * 16 }}
      draggable
      onDragStart={(e) => onRowDragStart(e, task.id)}
      onDragOver={(e) => onRowDragOver(e, task.id)}
      onDrop={(e) => onRowDrop(e, task.id)}
      onDragEnd={onRowDragEnd}
      onMouseEnter={() => set('hoveredTaskId', task.id)}
      onMouseLeave={() => set('hoveredTaskId', null)}
      onClick={() => set('selectedTaskId', task.id)}
      onDoubleClick={() => { set('editingTask', task); set('showTaskModal', true); }}
      data-row-index={rowIndex}
    >
      {dragOverId === task.id && dragOverPosition === 'before' && (
        <div className="absolute left-0 right-0 top-0 h-0.5 bg-blue-500" />
      )}
      {dragOverId === task.id && dragOverPosition === 'inside' && (
        <div className="absolute inset-0 ring-2 ring-inset ring-blue-500/60 bg-blue-500/5 pointer-events-none" />
      )}
      {dragOverId === task.id && dragOverPosition === 'after' && (
        <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-blue-500" />
      )}
      <button
        className="shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-slate-700/60 text-slate-400"
        onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
      >
        {task.children && (task.children as unknown[]).length > 0 ? (
          (task as unknown as TreeNode).expanded
            ? <ChevronDown size={14} className="text-slate-300" />
            : <ChevronRight size={14} className="text-slate-300" />
        ) : (
          <span className="w-3" />
        )}
      </button>
      <span
        className="shrink-0 w-4 text-center text-xs"
        style={{ color: task.color }}
      >
        {typeCfg.icon}
      </span>
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: statusCfg.dot }}
        title={statusCfg.label}
      />
      <div className="flex-1 min-w-0 truncate text-sm text-slate-200 pr-2">
        <span className="truncate">{task.name}</span>
        {task.type === 'milestone' && (
          <span className="ml-1 text-[10px] text-amber-400 font-medium">里程碑</span>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1 pr-2">
        {group && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white"
            style={{ backgroundColor: group.color }}
            title={group.name}
          >
            {group.name.slice(0, 2)}
          </span>
        )}
        {taskTags.slice(0, 2).map(t => (
          <span
            key={t.id}
            className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white"
            style={{ backgroundColor: t.color }}
            title={t.name}
          >
            {t.name.slice(0, 2)}
          </span>
        ))}
      </div>
      <div className="shrink-0 w-14 text-right text-[11px] text-slate-500 pr-2 tabular-nums">
        {formatDate(task.startDate, 'MM/DD', currentProject?.timezone)}
      </div>
      <div className="shrink-0 w-16 text-right text-[11px] pr-3">
        <span className={cn(
          'font-medium tabular-nums',
          task.progress === 0 ? 'text-slate-500' : task.progress === 100 ? 'text-emerald-400' : 'text-blue-400',
        )}>
          {task.progress}%
        </span>
      </div>
    </div>
  );
});

interface SidebarProps extends Props {
  totalHeight: number;
  flatList: FlatTask[];
}

const TaskSidebar = memo(function TaskSidebar(props: SidebarProps) {
  const { sidebarWidth, groups, set, showTaskModal, scrollTop } = useGanttStore();
  const { totalHeight, flatList } = props;

  return (
    <div className="sticky left-0 z-20 bg-slate-900 border-r border-slate-700/80 flex flex-col" style={{ width: sidebarWidth, height: totalHeight + 120 }}>
      <div className="sticky top-0 z-20 flex h-[60px] items-center border-b border-slate-700/80 bg-slate-900 px-3 gap-2" style={{ transform: `translateY(${scrollTop}px)` }}>
        <div className="flex-1 text-xs font-semibold text-slate-300 uppercase tracking-wide">任务结构</div>
        <button
          className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          onClick={() => { set('editingTask', null); set('showTaskModal', !showTaskModal); }}
        >
          + 新建
        </button>
      </div>
      <div className="flex text-[11px] text-slate-400 border-b border-slate-700/40 px-2 py-1.5 bg-slate-800/40 sticky top-[60px] z-10" style={{ transform: `translateY(${scrollTop}px)` }}>
        <div className="w-8"></div>
        <div className="flex-1">名称 / 分组</div>
        <div className="w-14 text-right">开始</div>
        <div className="w-16 text-right pr-2">进度</div>
      </div>
      <div className="flex-1" style={{ scrollbarWidth: 'thin' }}>
        <div style={{ minHeight: totalHeight }}>
          {flatList.map((t, idx) => (
            <SidebarRow key={t.id} task={t} rowIndex={idx} {...props} />
          ))}
          {flatList.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">暂无任务</div>
          )}
        </div>
      </div>
      <div className="sticky bottom-0 border-t border-slate-700/60 p-2 bg-slate-900 text-[11px] text-slate-400 flex items-center gap-2" style={{ transform: `translateY(${scrollTop}px)` }}>
        <span>筛选分组:</span>
        <select
          className="flex-1 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200 outline-none"
          onChange={(e) => useGanttStore.getState().set('filterGroupId', e.target.value || null)}
        >
          <option value="">全部分组</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
    </div>
  );
});

export default TaskSidebar;
