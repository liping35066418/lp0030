import { useMemo, memo } from 'react';
import type { TimeTick } from '@/lib/gantt-utils';
import { generateTimeTicks } from '@/lib/gantt-utils';
import { useGanttStore } from '@/store/ganttStore';
import { cn } from '@/lib/utils';

const TimelineAxis = memo(function TimelineAxis() {
  const { viewScale, pixelPerUnit, axisStart, axisEnd, scrollLeft, sidebarWidth } = useGanttStore();

  const { major, minor, totalWidth } = useMemo(
    () => generateTimeTicks(axisStart, axisEnd, viewScale, pixelPerUnit),
    [axisStart, axisEnd, viewScale, pixelPerUnit],
  );

  const weekendSet = useMemo(() => {
    const s = new Set<string>();
    for (const t of minor) {
      const day = t.date.getDay();
      if (day === 0 || day === 6) s.add(t.key);
    }
    return s;
  }, [minor]);

  return (
    <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/80 select-none" style={{ marginLeft: sidebarWidth }}>
      <div className="relative" style={{ width: totalWidth, transform: `translateX(${-scrollLeft}px)` }}>
        <div className="flex h-8 border-b border-slate-700/60">
          {major.map((t: TimeTick) => (
            <div
              key={t.key}
              className={cn(
                'flex items-center px-2 border-r border-slate-700/60 text-xs font-medium',
                'text-slate-200 bg-slate-800/50',
              )}
              style={{ width: t.width, minWidth: t.width }}
            >
              <span className="truncate">{t.label}</span>
            </div>
          ))}
        </div>
        <div className="flex h-7">
          {minor.map((t: TimeTick) => {
            const day = t.date.getDay();
            const isWeekend = day === 0 || day === 6;
            return (
              <div
                key={t.key}
                className={cn(
                  'flex items-center justify-center border-r border-slate-700/40 text-[11px]',
                  isWeekend
                    ? 'bg-slate-800/40 text-amber-300/80 font-medium'
                    : 'text-slate-400',
                )}
                style={{ width: t.width, minWidth: t.width }}
              >
                {t.label}
              </div>
            );
          })}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px pointer-events-none">
          {Array.from(weekendSet).map(k => {
            const t = minor.find(x => x.key === k);
            if (!t) return null;
            return (
              <div
                key={`bg-${k}`}
                className="absolute top-7 bottom-0 bg-amber-400/5"
                style={{ left: t.x, width: t.width, height: 'calc(100% - 28px)' }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default TimelineAxis;
