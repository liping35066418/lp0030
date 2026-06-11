import { useMemo, useRef, memo, useState, useEffect } from 'react';
import type { Task, FlatTask, DraggingState } from '@/types/gantt';
import { STATUS_CONFIG, TYPE_CONFIG } from '@/types/gantt';
import { useGanttStore } from '@/store/ganttStore';
import { dateToPixel, formatDate, formatShortDate, rgbAlpha, lighten } from '@/lib/gantt-utils';
import { GripVertical, Link2, Plus, Trash2, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MIN_BAR_WIDTH = 8;

interface BarProps {
  task: FlatTask;
  rowIndex: number;
  barLeft: number;
  barWidth: number;
  onMouseDown: (e: React.MouseEvent, type: DraggingState['type'], taskId: string) => void;
  onDepHoverId: string | null;
  onDepClick: (taskId: string, e: React.MouseEvent) => void;
  previewRect: DOMRect | null;
  setPreviewRect: (r: DOMRect | null) => void;
}

const TaskBar = memo(function TaskBar({
  task, rowIndex, barLeft, barWidth, onMouseDown, onDepHoverId, onDepClick, previewRect, setPreviewRect,
}: BarProps) {
  const {
    selectedTaskId, hoveredTaskId, set, rowHeight,
    viewScale, axisStart, pixelPerUnit,
    depCreateMode, currentProject, updateTask,
  } = useGanttStore();
  const showDetail = useMemo(() => barWidth >= 40, [barWidth]);
  const [progressTip, setProgressTip] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [localProgress, setLocalProgress] = useState(task.progress);
  const [editProg, setEditProg] = useState(false);

  useEffect(() => { setLocalProgress(task.progress); }, [task.progress]);

  const isSel = selectedTaskId === task.id;
  const isHover = hoveredTaskId === task.id || onDepHoverId === task.id;
  const isMilestone = task.type === 'milestone';
  const isSummary = task.type === 'summary';
  const barBg = task.color;
  const statusCfg = STATUS_CONFIG[task.status];
  const typeCfg = TYPE_CONFIG[task.type];

  const startX = dateToPixel(task.startDate, axisStart, viewScale, pixelPerUnit, currentProject?.timezone);

  void barLeft;
  void startX;

  const actualLeft = barLeft;
  const actualWidth = Math.max(barWidth, MIN_BAR_WIDTH);

  const handleProgressCommit = async () => {
    setEditProg(false);
    if (localProgress !== task.progress) {
      try {
        await updateTask(task.id, { progress: localProgress });
      } catch { /* noop */ }
    }
  };

  const handleProgressWheel = (e: React.WheelEvent) => {
    if (!editProg) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 5 : -5;
    setLocalProgress(Math.max(0, Math.min(100, localProgress + delta)));
  };

  const topPad = (rowHeight - (isMilestone ? 22 : 26)) / 2;

  return (
    <div
      className="absolute"
      style={{ left: actualLeft, top: rowIndex * rowHeight + (isMilestone ? topPad : topPad), width: actualWidth, height: isMilestone ? 22 : 26 }}
      onMouseEnter={(_e) => {
        void _e;
        if (barRef.current && isHover === false) {
          setPreviewRect(barRef.current.getBoundingClientRect());
        }
      }}
      onMouseLeave={() => {
        if (onDepHoverId === task.id) { setPreviewRect(null); }
        setProgressTip(false);
      }}
    >
      {isMilestone ? (
        <div
          ref={barRef}
          className={cn(
            'relative w-6 h-6 mx-auto cursor-grab active:cursor-grabbing transition-transform',
            isSel ? 'scale-110' : '',
          )}
          style={{ transform: `rotate(45deg)`, background: barBg, boxShadow: `0 2px 8px ${rgbAlpha(barBg, 0.45)}`, border: isSel ? '2px solid #fff' : '1px solid rgba(255,255,255,0.3)' }}
          onMouseDown={(e) => { e.preventDefault(); onMouseDown(e, 'move', task.id); }}
          title={`${task.name} · ${formatDate(task.startDate)} · ${typeCfg.label}`}
        />
      ) : (
        <div
          ref={barRef}
          className={cn(
            'relative h-full rounded-md cursor-grab active:cursor-grabbing select-none overflow-hidden transition-all',
            isSel ? 'ring-2 ring-white/90 ring-offset-1 ring-offset-slate-900' : '',
            isHover ? 'shadow-lg' : '',
            isSummary ? 'opacity-90' : '',
          )}
          style={{
            background: `linear-gradient(180deg, ${lighten(barBg, 0.1)}, ${barBg} 40%, ${barBg})`,
            boxShadow: `0 2px 10px ${rgbAlpha(barBg, 0.35)}`,
            border: `1px solid ${lighten(barBg, -0.25)}`,
          }}
          onMouseDown={(e) => { if ((e.target as HTMLElement).dataset.nodrag) return; e.preventDefault(); onMouseDown(e, 'move', task.id); }}
          onWheel={handleProgressWheel}
          onDoubleClick={() => { set('editingTask', task); set('showTaskModal', true); }}
        >
          <div
            className="absolute left-0 top-0 h-full transition-all"
            style={{
              width: `${task.progress}%`,
              background: `linear-gradient(90deg, ${statusCfg.dot}cc, ${statusCfg.dot})`,
              opacity: 0.85,
            }}
          />
          <div
            className={cn('absolute inset-0 flex items-center gap-1 px-2 text-white text-[12px] font-medium', isSummary ? 'font-semibold' : '')}
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
          >
            {showDetail && (
              <>
                <span className="truncate max-w-[calc(100%-60px)]">{task.name}</span>
                {!isSummary && (
                  <span
                    data-nodrag
                    className="ml-auto shrink-0 bg-black/30 rounded px-1.5 py-0.5 text-[11px] tabular-nums backdrop-blur-sm"
                    onMouseEnter={() => setProgressTip(true)}
                    onMouseLeave={() => setProgressTip(false)}
                    onClick={(e) => { e.stopPropagation(); setEditProg(v => !v); }}
                    onWheel={(e) => { e.stopPropagation(); if (editProg) { e.preventDefault(); const d = e.deltaY < 0 ? 5 : -5; const np = Math.max(0, Math.min(100, localProgress + d)); setLocalProgress(np); } }}
                    onMouseUp={(e) => { e.stopPropagation(); if (editProg) handleProgressCommit(); }}
                  >
                    {localProgress}%
                  </span>
                )}
                {isSummary && task.duration > 0 && (
                  <span className="ml-auto shrink-0 bg-black/25 rounded px-1.5 py-0.5 text-[11px]">{task.duration}天</span>
                )}
              </>
            )}
            {progressTip && !isSummary && (
              <div className="absolute -top-7 right-0 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-[10px] whitespace-nowrap shadow-lg">
                滚轮调整 · 点击锁定 · 再次点击或失焦提交
              </div>
            )}
          </div>
          <div
            className="absolute left-0 top-0 w-1.5 h-full cursor-ew-resize hover:bg-white/40 active:bg-white/60 transition-colors"
            onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, 'resize-left', task.id); }}
            title="调整开始时间"
          />
          <div
            className="absolute right-0 top-0 w-1.5 h-full cursor-ew-resize hover:bg-white/40 active:bg-white/60 transition-colors"
            onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, 'resize-right', task.id); }}
            title="调整结束时间"
          />
          <div className="absolute -right-5 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <div
              data-nodrag
              className={cn(
                'w-4 h-4 rounded-full cursor-pointer flex items-center justify-center',
                depCreateMode.active ? 'bg-amber-500 animate-pulse' : 'bg-slate-700/80 hover:bg-blue-500',
              )}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onDepClick(task.id, e); }}
              onMouseUp={(e) => { e.stopPropagation(); e.preventDefault(); onDepClick(task.id, e); }}
              title="创建依赖"
            >
              <Link2 size={10} className="text-white" />
            </div>
          </div>
          <div className="absolute -left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <GripVertical size={14} className="text-slate-500" />
          </div>
        </div>
      )}
      {isHover && !isMilestone && (
        <div className="absolute -bottom-6 left-0 right-0 flex justify-center pointer-events-none z-10">
          <div className="bg-slate-900/95 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-300 whitespace-nowrap shadow-lg backdrop-blur-sm">
            {task.name} · {formatShortDate(task.startDate, currentProject?.timezone)} → {formatShortDate(task.endDate, currentProject?.timezone)} · {task.duration}天
          </div>
        </div>
      )}
      {isSel && (
        <div className="absolute -right-10 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-20">
          <button
            data-nodrag
            className="w-6 h-6 rounded bg-blue-600 hover:bg-blue-500 flex items-center justify-center"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); set('editingTask', task); set('showTaskModal', true); }}
            title="编辑"
          >
            <Edit3 size={12} className="text-white" />
          </button>
          <button
            data-nodrag
            className="w-6 h-6 rounded bg-rose-600 hover:bg-rose-500 flex items-center justify-center"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (currentProject && confirm(`确定删除「${task.name}」及其所有子任务？`)) {
                useGanttStore.getState().deleteTask(task.id);
              }
            }}
            title="删除"
          >
            <Trash2 size={12} className="text-white" />
          </button>
          <button
            data-nodrag
            className="w-6 h-6 rounded bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (currentProject) {
                const sd = new Date(task.endDate);
                sd.setDate(sd.getDate() + 1);
                const ed = new Date(sd); ed.setDate(ed.getDate() + 2);
                useGanttStore.getState().createTask({
                  projectId: currentProject.id,
                  parentId: task.parentId,
                  name: '新任务',
                  startDate: sd.toISOString(),
                  endDate: ed.toISOString(),
                  afterId: task.id,
                  color: '#3b82f6',
                });
              }
            }}
            title="后续任务"
          >
            <Plus size={12} className="text-white" />
          </button>
        </div>
      )}
      {previewRect && onDepHoverId === task.id && null}
    </div>
  );
});

interface Props {
  flatList: FlatTask[];
  onMouseDown: (e: React.MouseEvent, type: DraggingState['type'], taskId: string) => void;
  onDepHoverId: string | null;
  setOnDepHoverId: (id: string | null) => void;
  onDepClick: (taskId: string, e: React.MouseEvent) => void;
  totalWidth: number;
  totalHeight: number;
  dragging: DraggingState;
  previewRect: DOMRect | null;
  setPreviewRect: (r: DOMRect | null) => void;
}

const TaskBarsLayer = memo(function TaskBarsLayer({
  flatList, onMouseDown, onDepHoverId, setOnDepHoverId, onDepClick,
  totalWidth, totalHeight, dragging, previewRect, setPreviewRect,
}: Props) {
  const { viewScale, axisStart, pixelPerUnit, filterGroupId, searchText, currentProject } = useGanttStore();

  const bars = useMemo(() => {
    const result: Array<{ task: FlatTask; left: number; width: number; row: number }> = [];
    const matches = (t: Task) => {
      if (filterGroupId && t.groupId !== filterGroupId) return false;
      if (searchText && !t.name.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    };
    for (let i = 0; i < flatList.length; i++) {
      const t = flatList[i];
      if (!matches(t)) continue;
      const left = dateToPixel(t.startDate, axisStart, viewScale, pixelPerUnit, currentProject?.timezone);
      const right = dateToPixel(t.endDate, axisStart, viewScale, pixelPerUnit, currentProject?.timezone);
      const width = t.type === 'milestone' ? 0 : Math.max(0, right - left + pixelPerUnit / (viewScale === 'day' ? 1 : viewScale === 'week' ? 7 : 30));
      result.push({ task: t, left, width, row: i });
    }
    return result;
  }, [flatList, axisStart, viewScale, pixelPerUnit, filterGroupId, searchText, currentProject?.timezone]);

  return (
    <div
      className="relative"
      style={{ width: totalWidth, minHeight: totalHeight }}
      onMouseMove={(e) => {
        if (!dragging.type) {
          const target = e.target as HTMLElement;
          const barEl = target.closest('[data-bar-id]') as HTMLElement | null;
          if (barEl?.dataset.barId && barEl.dataset.barId !== onDepHoverId) {
            setOnDepHoverId(barEl.dataset.barId);
          } else if (!barEl && onDepHoverId) {
            setOnDepHoverId(null);
          }
        }
      }}
    >
      {bars.map(({ task, left, width, row }) => (
        <div key={task.id} data-bar-id={task.id}>
          <TaskBar
            task={task}
            rowIndex={row}
            barLeft={left}
            barWidth={width}
            onMouseDown={onMouseDown}
            onDepHoverId={onDepHoverId}
            onDepClick={onDepClick}
            previewRect={previewRect}
            setPreviewRect={setPreviewRect}
          />
        </div>
      ))}
    </div>
  );
});

export default TaskBarsLayer;
