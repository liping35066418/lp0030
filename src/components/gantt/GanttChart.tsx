import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useGanttStore } from '@/store/ganttStore';
import type { DraggingState, FlatTask } from '@/types/gantt';
import { VIEW_SCALE_CONFIG } from '@/types/gantt';
import Toolbar from './Toolbar';
import TimelineAxis from './TimelineAxis';
import TaskSidebar from './TaskSidebar';
import TaskBarsLayer from './TaskBars';
import DependencyLines from './DependencyLines';
import GridBackground from './GridBackground';
import ProjectModal from './ProjectModal';
import TaskModal from './TaskModal';
import SnapshotModal from './SnapshotModal';
import Toast from './Toast';
import {
  dateToPixel, pixelToDate, snapToDate, generateTimeTicks,
  formatDate, addDays, diffDays,
} from '@/lib/gantt-utils';
import { taskApi } from '@/services/api';
import { Loader2, AlertTriangle } from 'lucide-react';

interface Props {
  onBackToList: () => void;
}

export default function GanttChart({ onBackToList }: Props) {
  const {
    currentProject, flatTasks, tasks, dependencies, rowHeight, sidebarWidth,
    viewScale, axisStart, axisEnd, pixelPerUnit,
    set, updateTask, reorderTasks, refreshCurrentProject,
    batchSet, depCreateMode,
  } = useGanttStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollSyncRef = useRef<{ syncing: boolean; source: string | null }>({ syncing: false, source: null });
  const [dragging, setDragging] = useState<DraggingState>({ type: null, taskId: null, startX: 0, startY: 0 });
  const [dragPreview, setDragPreview] = useState<{ left: number; width: number; row: number } | null>(null);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [depHoverId, setDepHoverId] = useState<string | null>(null);
  const [onDepBarHover, setOnDepBarHover] = useState<string | null>(null);
  const [rowDrag, setRowDrag] = useState<{ id: string | null; overId: string | null; position: 'before' | 'after' | 'inside' | null }>({ id: null, overId: null, position: null });
  const [depClickState, setDepClickState] = useState<{ fromId: string | null; mouseDown: boolean }>({ fromId: null, mouseDown: false });
  const [previewRect, setPreviewRect] = useState<DOMRect | null>(null);
  void depClickState;

  const { totalWidth } = useMemo(
    () => generateTimeTicks(axisStart, axisEnd, viewScale, pixelPerUnit),
    [axisStart, axisEnd, viewScale, pixelPerUnit],
  );
  const totalHeight = flatTasks.length * rowHeight;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!containerRef.current) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 8 : -8;
      useGanttStore.getState().zoom(delta);
    } else {
      const g = useGanttStore.getState();
      const newLeft = Math.max(0, g.scrollLeft + e.deltaX);
      const newTop = Math.max(0, g.scrollTop + e.deltaY);
      useGanttStore.getState().batchSet({ scrollLeft: newLeft, scrollTop: newTop });
    }
  }, []);

  const taskByIdMap = useMemo(() => new Map(flatTasks.map((t, i) => [t.id, { task: t, idx: i }])), [flatTasks]);

  const handleBarMouseDown = useCallback((e: React.MouseEvent, type: DraggingState['type'], taskId: string) => {
    if (depCreateMode.active) return;
    e.preventDefault();
    const found = taskByIdMap.get(taskId);
    if (!found) return;
    const { task } = found;
    setDragging({
      type, taskId,
      startX: e.clientX,
      startY: e.clientY,
      startDate: task.startDate,
      endDate: task.endDate,
      startRowIndex: found.idx,
    });
  }, [taskByIdMap, depCreateMode.active]);

  useEffect(() => {
    if (!dragging.type && !depCreateMode.active) return;

    const onMove = async (e: MouseEvent) => {
      if (!containerRef.current || !dragging.taskId || !dragging.type) return;
      const rect = containerRef.current.getBoundingClientRect();
      const g = useGanttStore.getState();
      const xInGantt = e.clientX - rect.left - sidebarWidth + g.scrollLeft;
      const yInGantt = e.clientY - rect.top + g.scrollTop;
      const found = taskByIdMap.get(dragging.taskId);
      if (!found) return;

      if (depCreateMode.active) return;

      const unitDays = VIEW_SCALE_CONFIG[g.viewScale].unitDays;
      void unitDays;

      let newStart = new Date(found.task.startDate);
      let newEnd = new Date(found.task.endDate);

      if (dragging.type === 'move') {
        const deltaPx = xInGantt - dateToPixel(found.task.startDate, g.axisStart, g.viewScale, g.pixelPerUnit);
        const deltaDays = Math.round(deltaPx / (g.pixelPerUnit / (g.viewScale === 'day' ? 1 : g.viewScale === 'week' ? 7 : 30)));
        newStart = snapToDate(addDays(found.task.startDate, deltaDays), g.viewScale, 'round');
        const dur = diffDays(found.task.startDate, found.task.endDate) + 1;
        newEnd = snapToDate(addDays(newStart, dur - 1), g.viewScale, 'round');
      } else if (dragging.type === 'resize-left') {
        const rawDate = pixelToDate(xInGantt, g.axisStart, g.viewScale, g.pixelPerUnit);
        newStart = snapToDate(rawDate, g.viewScale, 'round');
        if (newStart > new Date(found.task.endDate)) newStart = new Date(found.task.endDate);
      } else if (dragging.type === 'resize-right') {
        const rawDate = pixelToDate(xInGantt, g.axisStart, g.viewScale, g.pixelPerUnit);
        newEnd = snapToDate(rawDate, g.viewScale, 'round');
        if (newEnd < new Date(found.task.startDate)) newEnd = new Date(found.task.startDate);
      } else if (dragging.type === 'row') {
        const targetRow = Math.max(0, Math.min(flatTasks.length - 1, Math.floor(yInGantt / g.rowHeight)));
        const left = dateToPixel(newStart, g.axisStart, g.viewScale, g.pixelPerUnit);
        const w = dateToPixel(newEnd, g.axisStart, g.viewScale, g.pixelPerUnit) + g.pixelPerUnit / 30 - left;
        setDragPreview({ left, width: w, row: targetRow });
        return;
      }

      try {
        const startIso = newStart.toISOString();
        const endIso = newEnd.toISOString();
        const v = await taskApi.validateChange(dragging.taskId, startIso, endIso);
        if (!v.valid) {
          setValidationMsg(v.errors[0] || '时间不合法');
          return;
        }
        setValidationMsg(null);
        const left = dateToPixel(newStart, g.axisStart, g.viewScale, g.pixelPerUnit);
        const w = dateToPixel(newEnd, g.axisStart, g.viewScale, g.pixelPerUnit) + g.pixelPerUnit / 30 - left;
        setDragPreview({ left, width: w, row: found.idx });
      } catch (err) {
        setValidationMsg((err as Error).message);
      }
    };

    const onUp = async (e: MouseEvent) => {
      const g = useGanttStore.getState();
      if (depCreateMode.active && depCreateMode.from && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const yInGantt = e.clientY - rect.top + g.scrollTop;
        const targetIdx = Math.max(0, Math.min(flatTasks.length - 1, Math.floor(yInGantt / g.rowHeight)));
        const tTask = flatTasks[targetIdx];
        if (tTask && tTask.id !== depCreateMode.from) {
          await g.addDependency({
            projectId: currentProject!.id,
            fromTaskId: depCreateMode.from,
            toTaskId: tTask.id,
            type: 'fs', lag: 0,
          });
        }
        g.batchSet({ depCreateMode: { from: null, active: false } });
        setMousePos(null);
        setDragging({ type: null, taskId: null, startX: 0, startY: 0 });
        return;
      }

      if (!dragging.type || !dragging.taskId) {
        setDragging({ type: null, taskId: null, startX: 0, startY: 0 });
        setDragPreview(null);
        setValidationMsg(null);
        return;
      }

      if (dragPreview) {
        const found = taskByIdMap.get(dragging.taskId);
        if (found) {
          let newStart = new Date(found.task.startDate);
          let newEnd = new Date(found.task.endDate);
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const xInGantt = e.clientX - rect.left - sidebarWidth + g.scrollLeft;
            const yInGantt = e.clientY - rect.top + g.scrollTop;
            if (dragging.type === 'move') {
              const deltaPx = xInGantt - dateToPixel(found.task.startDate, g.axisStart, g.viewScale, g.pixelPerUnit);
              const deltaDays = Math.round(deltaPx / (g.pixelPerUnit / (g.viewScale === 'day' ? 1 : g.viewScale === 'week' ? 7 : 30)));
              newStart = snapToDate(addDays(found.task.startDate, deltaDays), g.viewScale, 'round');
              const dur = diffDays(found.task.startDate, found.task.endDate) + 1;
              newEnd = snapToDate(addDays(newStart, dur - 1), g.viewScale, 'round');
            } else if (dragging.type === 'resize-left') {
              const rawDate = pixelToDate(xInGantt, g.axisStart, g.viewScale, g.pixelPerUnit);
              newStart = snapToDate(rawDate, g.viewScale, 'round');
              if (newStart > newEnd) newStart = newEnd;
            } else if (dragging.type === 'resize-right') {
              const rawDate = pixelToDate(xInGantt, g.axisStart, g.viewScale, g.pixelPerUnit);
              newEnd = snapToDate(rawDate, g.viewScale, 'round');
              if (newEnd < newStart) newEnd = newStart;
            } else if (dragging.type === 'row') {
              const targetRow = Math.max(0, Math.min(flatTasks.length - 1, Math.floor(yInGantt / g.rowHeight)));
              if (targetRow !== found.idx && flatTasks[targetRow]) {
                const targetId = flatTasks[targetRow].id;
                const siblings = flatTasks.filter(t => t.parentId === found.task.parentId);
                const order = siblings.map(s => s.id);
                const fromIdx = order.indexOf(found.task.id);
                const toIdx = order.indexOf(targetId);
                if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
                  const [moved] = order.splice(fromIdx, 1);
                  order.splice(toIdx, 0, moved);
                  await reorderTasks(order, found.task.parentId);
                }
                setDragging({ type: null, taskId: null, startX: 0, startY: 0 });
                setDragPreview(null);
                return;
              }
            }
          }
          try {
            if (newStart.toISOString() !== found.task.startDate || newEnd.toISOString() !== found.task.endDate) {
              await updateTask(dragging.taskId, {
                startDate: newStart.toISOString(),
                endDate: newEnd.toISOString(),
                duration: diffDays(newStart, newEnd) + 1,
              });
            }
          } catch (err) {
            g.showToast('error', (err as Error).message);
          }
        }
      }
      setDragging({ type: null, taskId: null, startX: 0, startY: 0 });
      setDragPreview(null);
      setValidationMsg(null);
    };

    const onGlobalMove = (e: MouseEvent) => {
      if (containerRef.current && (dragging.type || depCreateMode.active)) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left - sidebarWidth, y: e.clientY - rect.top });
      }
      if (dragging.type) onMove(e);
    };

    window.addEventListener('mousemove', onGlobalMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onGlobalMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, taskByIdMap, dragPreview, flatTasks, sidebarWidth, updateTask, reorderTasks, depCreateMode, currentProject]);

  const handleRowDragStart = (e: React.DragEvent, id: string) => {
    setRowDrag({ id, overId: null, position: null });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };
  const handleRowDragOver = (e: React.DragEvent, id: string) => {
    if (!rowDrag.id || rowDrag.id === id) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const ratio = relY / rect.height;
    let pos: 'before' | 'after' | 'inside' = 'after';
    if (ratio < 0.3) pos = 'before';
    else if (ratio > 0.7) pos = 'after';
    else pos = 'inside';
    setRowDrag(prev => ({ ...prev, overId: id, position: pos }));
  };
  const handleRowDrop = async (_e: React.DragEvent, _id: string) => {
    if (!rowDrag.id || !rowDrag.overId || !rowDrag.position) return;
    const srcId = rowDrag.id;
    const targetId = rowDrag.overId;
    const pos = rowDrag.position;
    const src = tasks.find(t => t.id === srcId);
    const target = tasks.find(t => t.id === targetId);
    if (!src || !target || !currentProject) return;

    const siblings = tasks.filter(t => t.parentId === (pos === 'inside' ? targetId : target.parentId));
    const order = siblings.map(s => s.id);
    const fromIdx = order.indexOf(srcId);
    if (fromIdx >= 0) order.splice(fromIdx, 1);
    let toIdx = order.indexOf(targetId);
    if (pos === 'after') toIdx += 1;
    if (pos === 'inside') toIdx = order.length;
    if (toIdx < 0) toIdx = order.length;
    order.splice(toIdx, 0, srcId);
    const newParent = pos === 'inside' ? targetId : target.parentId;
    try {
      await taskApi.reorder(currentProject.id, order, newParent);
      if (newParent !== src.parentId) {
        await taskApi.update(srcId, { parentId: newParent, cascade: false });
      }
      await refreshCurrentProject();
    } catch (err) {
      useGanttStore.getState().showToast('error', (err as Error).message);
    }
    setRowDrag({ id: null, overId: null, position: null });
  };
  const handleRowDragEnd = () => setRowDrag({ id: null, overId: null, position: null });

  const handleDepClick = (taskId: string, _e: React.MouseEvent) => {
    if (!currentProject) return;
    if (!depCreateMode.active) {
      batchSet({ depCreateMode: { from: taskId, active: true } });
      return;
    }
    if (depCreateMode.from && depCreateMode.from !== taskId) {
      useGanttStore.getState().addDependency({
        projectId: currentProject.id,
        fromTaskId: depCreateMode.from,
        toTaskId: taskId,
        type: 'fs', lag: 0,
      });
    }
    batchSet({ depCreateMode: { from: null, active: false } });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        batchSet({
          depCreateMode: { from: null, active: false },
          showTaskModal: false, showProjectModal: false, showSnapshotModal: false,
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [batchSet]);

  void onDepBarHover;

  if (!currentProject) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-slate-900 text-slate-400">
        <Loader2 size={36} className="animate-spin text-blue-500" />
        <p>正在加载项目...</p>
        <button onClick={onBackToList} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm border border-slate-700">返回项目列表</button>
      </div>
    );
  }

  const { scrollLeft, scrollTop } = useGanttStore.getState();

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex flex-col bg-slate-950 text-white overflow-hidden relative"
      onWheel={handleWheel}
    >
      <Toolbar />

      <div className="relative flex-1 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900">
        <div className="absolute left-2 top-2 z-40 text-xs text-slate-500">
          {currentProject.name}
          <span className="mx-2 text-slate-700">·</span>
          <span>{formatDate(currentProject.startDate, 'YYYY-MM-DD')} → {formatDate(currentProject.endDate, 'YYYY-MM-DD')}</span>
          <span className="mx-2 text-slate-700">·</span>
          <span>{flatTasks.length} 任务 · {dependencies.length} 依赖</span>
        </div>
        <button
          onClick={onBackToList}
          className="absolute right-2 top-2 z-40 text-xs px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700"
        >
          ← 项目列表
        </button>

        {depCreateMode.active && (
          <div className="absolute left-1/2 -translate-x-1/2 top-12 z-50 px-4 py-2 rounded-full bg-amber-500/90 text-white text-xs font-semibold shadow-lg shadow-amber-500/30 flex items-center gap-2 animate-pulse">
            <AlertTriangle size={14} /> 正在创建依赖 - 点击目标任务连接 · ESC 取消
          </div>
        )}

        {validationMsg && (
          <div className="absolute left-1/2 -translate-x-1/2 top-20 z-50 px-4 py-2 rounded-lg bg-rose-600/95 text-white text-xs font-medium shadow-lg shadow-rose-500/40 flex items-center gap-2">
            <AlertTriangle size={14} /> {validationMsg}
          </div>
        )}

        <div className="absolute inset-0 flex flex-col" style={{ paddingTop: 56 }}>
          <div className="relative shrink-0" style={{ height: 60, zIndex: 20 }}>
            <TimelineAxis />
          </div>
          <div className="relative flex-1 overflow-hidden">
            <div
              className="absolute inset-0 overflow-auto"
              ref={(el) => {
                if (!el || scrollSyncRef.current.syncing) return;
                el.onscroll = () => {
                  if (scrollSyncRef.current.syncing) return;
                  useGanttStore.getState().batchSet({ scrollLeft: el.scrollLeft, scrollTop: el.scrollTop });
                };
              }}
              style={{ scrollbarWidth: 'thin' }}
            >
              <div className="relative" style={{ width: totalWidth + sidebarWidth, minHeight: Math.max(totalHeight + 60, 400) }}>
                <div className="absolute left-0 top-0 bottom-0" style={{ width: sidebarWidth, zIndex: 5 }}>
                  <TaskSidebar
                    totalHeight={totalHeight}
                    flatList={flatTasks as FlatTask[]}
                    onRowDragStart={handleRowDragStart}
                    onRowDragOver={handleRowDragOver}
                    onRowDrop={handleRowDrop}
                    onRowDragEnd={handleRowDragEnd}
                    dragOverId={rowDrag.overId}
                    dragOverPosition={rowDrag.position}
                  />
                </div>
                <div className="absolute top-0" style={{ left: sidebarWidth, width: totalWidth, minHeight: totalHeight }}>
                  <GridBackground
                    totalWidth={totalWidth}
                    totalHeight={totalHeight}
                    scrollLeft={scrollLeft}
                    scrollTop={scrollTop}
                    rowCount={flatTasks.length}
                  />
                  <DependencyLines
                    flatList={flatTasks as FlatTask[]}
                    totalWidth={totalWidth}
                    totalHeight={totalHeight}
                    scrollLeft={scrollLeft}
                    scrollTop={scrollTop}
                    depFromId={depCreateMode.from}
                    mousePos={mousePos}
                  />
                  <TaskBarsLayer
                    flatList={flatTasks as FlatTask[]}
                    onMouseDown={handleBarMouseDown}
                    onDepHoverId={depHoverId}
                    setOnDepHoverId={setDepHoverId}
                    onDepClick={handleDepClick}
                    totalWidth={totalWidth}
                    totalHeight={totalHeight}
                    scrollLeft={scrollLeft}
                    scrollTop={scrollTop}
                    dragging={dragging}
                    previewRect={previewRect}
                    setPreviewRect={setPreviewRect}
                  />
                  {dragPreview && dragging.taskId && (
                    <div
                      className="absolute z-30 pointer-events-none border-2 border-dashed border-white/70 rounded-md"
                      style={{
                        left: dragPreview.left - scrollLeft,
                        top: dragPreview.row * rowHeight - scrollTop + 6,
                        width: dragPreview.width,
                        height: rowHeight - 12,
                        background: 'rgba(59,130,246,0.18)',
                        boxShadow: '0 0 20px rgba(59,130,246,0.4)',
                      }}
                    >
                      <div className="absolute -top-5 left-0 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                        预览位置
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProjectModal />
      <TaskModal />
      <SnapshotModal />
      <Toast />
    </div>
  );
}
