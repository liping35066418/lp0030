import { useMemo, memo } from 'react';
import type { Dependency, FlatTask, DependencyType, Task } from '@/types/gantt';
import { useGanttStore } from '@/store/ganttStore';
import { dateToPixel, calculateCriticalPath } from '@/lib/gantt-utils';

interface Props {
  flatList: FlatTask[];
  totalWidth: number;
  totalHeight: number;
  depFromId: string | null;
  mousePos: { x: number; y: number } | null;
}

function calcEndpoints(
  dep: Dependency,
  fromTask: FlatTask,
  toTask: FlatTask,
  fromRowIdx: number,
  toRowIdx: number,
  axisStart: Date,
  viewScale: string,
  pixelPerUnit: number,
  rowHeight: number,
  timezone?: string,
): { x1: number; y1: number; x2: number; y2: number; cx1: number; cy1: number; cx2: number; cy2: number } | null {
  const type = dep.type as DependencyType;
  const isMileFrom = fromTask.type === 'milestone';
  const isMileTo = toTask.type === 'milestone';
  const yFrom = fromRowIdx * rowHeight + rowHeight / 2;
  const yTo = toRowIdx * rowHeight + rowHeight / 2;

  let x1 = 0, x2 = 0;
  const fromStart = dateToPixel(fromTask.startDate, axisStart, viewScale as never, pixelPerUnit, timezone);
  const fromEnd = dateToPixel(fromTask.endDate, axisStart, viewScale as never, pixelPerUnit, timezone) + pixelPerUnit / (viewScale === 'day' ? 1 : viewScale === 'week' ? 7 : 30);
  const toStart = dateToPixel(toTask.startDate, axisStart, viewScale as never, pixelPerUnit, timezone);
  const toEnd = dateToPixel(toTask.endDate, axisStart, viewScale as never, pixelPerUnit, timezone) + pixelPerUnit / (viewScale === 'day' ? 1 : viewScale === 'week' ? 7 : 30);

  if (isMileFrom) {
    const mileCenter = (fromStart + fromEnd) / 2;
    switch (type) {
      case 'fs': case 'ff': x1 = mileCenter; break;
      case 'ss': case 'sf': x1 = mileCenter; break;
    }
  } else {
    switch (type) {
      case 'fs': case 'ff': x1 = fromEnd - 2; break;
      case 'ss': case 'sf': x1 = fromStart + 2; break;
    }
  }
  if (isMileTo) {
    const mileCenter = (toStart + toEnd) / 2;
    switch (type) {
      case 'fs': case 'ss': x2 = mileCenter; break;
      case 'ff': case 'sf': x2 = mileCenter; break;
    }
  } else {
    switch (type) {
      case 'fs': case 'ss': x2 = toStart + 2; break;
      case 'ff': case 'sf': x2 = toEnd - 2; break;
    }
  }

  const sameRow = fromRowIdx === toRowIdx;
  const midX = sameRow ? (x1 + x2) / 2 : Math.max(x1, x2) + 20;
  let cx1 = midX, cy1 = yFrom, cx2 = midX, cy2 = yTo;
  if (sameRow) {
    cx1 = x1 + (x2 - x1) * 0.5;
    cy1 = yFrom;
    cx2 = cx1;
    cy2 = yTo;
  }
  return { x1, y1: yFrom, x2, y2: yTo, cx1, cy1, cx2, cy2 };
}

const DependencyLines = memo(function DependencyLines({
  flatList, totalWidth, totalHeight, depFromId, mousePos,
}: Props) {
  const { dependencies, rowHeight, viewScale, axisStart, pixelPerUnit, hoveredTaskId, selectedTaskId, scrollLeft, scrollTop, currentProject, criticalPathEnabled, filterGroupId, searchText } = useGanttStore();

  const rowIdxMap = useMemo(() => {
    const m = new Map<string, number>();
    flatList.forEach((t, i) => m.set(t.id, i));
    return m;
  }, [flatList]);
  const taskMap = useMemo(() => {
    const m = new Map<string, FlatTask>();
    flatList.forEach(t => m.set(t.id, t));
    return m;
  }, [flatList]);

  const visibleTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of flatList) {
      if (filterGroupId && t.groupId !== filterGroupId) continue;
      if (searchText && !t.name.toLowerCase().includes(searchText.toLowerCase())) continue;
      ids.add(t.id);
    }
    return ids;
  }, [flatList, filterGroupId, searchText]);

  const criticalPathResult = useMemo(() => {
    if (!criticalPathEnabled) return { criticalTaskIds: new Set<string>(), criticalDepIds: new Set<string>(), projectDuration: 0 };
    const visibleTasks = flatList.filter(t => visibleTaskIds.has(t.id));
    const visibleDeps = dependencies.filter(d => visibleTaskIds.has(d.fromTaskId) && visibleTaskIds.has(d.toTaskId));
    return calculateCriticalPath(visibleTasks as Task[], visibleDeps);
  }, [criticalPathEnabled, flatList, visibleTaskIds, dependencies]);

  const lines = useMemo(() => {
    const result: Array<{ dep: Dependency; path: string; arrow: { x: number; y: number; rotate: number }; highlight: boolean; id: string; color: string; isCritical: boolean }> = [];
    for (const dep of dependencies) {
      const fromTask = taskMap.get(dep.fromTaskId);
      const toTask = taskMap.get(dep.toTaskId);
      const fIdx = rowIdxMap.get(dep.fromTaskId);
      const tIdx = rowIdxMap.get(dep.toTaskId);
      if (!fromTask || !toTask || fIdx === undefined || tIdx === undefined) continue;
      const pts = calcEndpoints(dep, fromTask, toTask, fIdx, tIdx, axisStart, viewScale, pixelPerUnit, rowHeight, currentProject?.timezone);
      if (!pts) continue;
      const path = `M ${pts.x1} ${pts.y1} C ${pts.cx1} ${pts.cy1}, ${pts.cx2} ${pts.cy2}, ${pts.x2} ${pts.y2}`;
      const arrow = { x: pts.x2, y: pts.y2, rotate: Math.atan2(pts.y2 - pts.cy2, pts.x2 - pts.cx2) * 180 / Math.PI };
      const highlight = hoveredTaskId === dep.fromTaskId || hoveredTaskId === dep.toTaskId ||
        selectedTaskId === dep.fromTaskId || selectedTaskId === dep.toTaskId;
      const isCritical = criticalPathEnabled && criticalPathResult.criticalDepIds.has(dep.id);
      let color = '#64748b';
      if (isCritical) color = '#f43f5e';
      else if (dep.type === 'fs') color = '#64748b';
      else if (dep.type === 'ss') color = '#0ea5e9';
      else if (dep.type === 'ff') color = '#f97316';
      else if (dep.type === 'sf') color = '#a855f7';
      result.push({ dep, path, arrow, highlight, id: dep.id, color, isCritical });
    }
    return result;
  }, [dependencies, taskMap, rowIdxMap, axisStart, viewScale, pixelPerUnit, rowHeight, hoveredTaskId, selectedTaskId, currentProject?.timezone, criticalPathEnabled, criticalPathResult]);

  const mouseX = mousePos ? mousePos.x + scrollLeft : 0;
  const mouseY = mousePos ? mousePos.y + scrollTop : 0;
  const startTask = depFromId ? taskMap.get(depFromId) : null;
  const startRowIdx = depFromId ? rowIdxMap.get(depFromId) : undefined;

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible z-10"
      width={totalWidth}
      height={totalHeight}
    >
      <defs>
        {['#64748b', '#0ea5e9', '#f97316', '#a855f7', '#f59e0b', '#f43f5e'].map(c => (
          <marker key={c} id={`arrow-${c.replace('#', '')}`} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill={c} />
          </marker>
        ))}
        <marker id="arrow-amber" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#f59e0b" />
        </marker>
      </defs>
      <g>
        {lines.map(({ dep, path, arrow, highlight, id, color, isCritical }) => (
          <g key={id} className="transition-all duration-200">
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={highlight || isCritical ? 3 : 1.5}
              strokeOpacity={criticalPathEnabled && !isCritical ? 0.15 : highlight ? 1 : 0.55}
              markerEnd={`url(#arrow-${color.replace('#', '')})`}
              style={{ filter: isCritical ? `drop-shadow(0 0 6px ${color})` : highlight ? `drop-shadow(0 0 4px ${color})` : 'none' }}
            />
            {highlight && (
              <g transform={`translate(${arrow.x}, ${arrow.y}) rotate(${arrow.rotate})`}>
                <circle cx="0" cy="0" r="4" fill={color} opacity="0.8" />
              </g>
            )}
            {dep.lag > 0 && (
              <g>
                <text
                  x={(startX(dep) + arrow.x) / 2}
                  y={(startY(dep) + arrow.y) / 2 - 6}
                  fontSize="9"
                  fill={color}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  +{dep.lag}d
                </text>
              </g>
            )}
          </g>
        ))}
      </g>
      {startTask && startRowIdx !== undefined && mousePos && (() => {
        const yFrom = startRowIdx * rowHeight + rowHeight / 2;
        const fromEnd = dateToPixel(startTask.endDate, axisStart, viewScale, pixelPerUnit, currentProject?.timezone) + pixelPerUnit / (viewScale === 'day' ? 1 : viewScale === 'week' ? 7 : 30);
        const x1 = fromEnd - 2;
        const path = `M ${x1} ${yFrom} C ${x1 + 20} ${yFrom}, ${mouseX - 20} ${mouseY}, ${mouseX} ${mouseY}`;
        return (
          <g>
            <path d={path} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 3" markerEnd="url(#arrow-amber)" />
            <circle cx={mouseX} cy={mouseY} r="5" fill="#f59e0b" opacity="0.8" />
          </g>
        );
      })()}
    </svg>
  );

  function startX(_dep: Dependency): number {
    const startTask = taskMap.get(_dep.fromTaskId);
    const startIdx = rowIdxMap.get(_dep.fromTaskId);
    if (!startTask || startIdx === undefined) return 0;
    const fromEnd = dateToPixel(startTask.endDate, axisStart, viewScale, pixelPerUnit, currentProject?.timezone) + pixelPerUnit / (viewScale === 'day' ? 1 : viewScale === 'week' ? 7 : 30);
    return fromEnd - 2;
  }
  function startY(_dep: Dependency): number {
    const startIdx = rowIdxMap.get(_dep.fromTaskId);
    if (startIdx === undefined) return 0;
    return startIdx * rowHeight + rowHeight / 2;
  }
});

export default DependencyLines;
