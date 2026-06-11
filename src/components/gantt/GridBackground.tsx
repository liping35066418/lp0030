import { useMemo, memo } from 'react';
import { generateTimeTicks } from '@/lib/gantt-utils';
import { useGanttStore } from '@/store/ganttStore';

const GridBackground = memo(function GridBackground({
  totalWidth, totalHeight, scrollLeft, scrollTop, rowCount,
}: { totalWidth: number; totalHeight: number; scrollLeft: number; scrollTop: number; rowCount: number }) {
  const { viewScale, pixelPerUnit, axisStart, axisEnd, rowHeight, sidebarWidth } = useGanttStore();
  const { minor } = useMemo(
    () => generateTimeTicks(axisStart, axisEnd, viewScale, pixelPerUnit),
    [axisStart, axisEnd, viewScale, pixelPerUnit],
  );

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ left: sidebarWidth }}
    >
      <div
        className="absolute"
        style={{ width: totalWidth, minHeight: totalHeight, transform: `translate(${-scrollLeft}px, ${-scrollTop}px)` }}
      >
        <svg width={totalWidth} height={totalHeight} className="overflow-visible">
          {minor.map((t, i) => {
            const day = t.date.getDay();
            const isWeekend = day === 0 || day === 6;
            return (
              <rect
                key={t.key}
                x={t.x}
                y={0}
                width={t.width}
                height={totalHeight}
                fill={isWeekend ? 'rgba(251, 191, 36, 0.035)' : i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent'}
              />
            );
          })}
          {minor.map(t => {
            const d = t.date;
            const isMonthStart = d.getDate() === 1;
            const isWeekStart = (d.getDay() + 6) % 7 === 0;
            const stroke = isMonthStart ? 'rgba(148,163,184,0.3)' : isWeekStart ? 'rgba(100,116,139,0.2)' : 'rgba(100,116,139,0.08)';
            const width = isMonthStart ? 1.2 : isWeekStart ? 0.8 : 0.4;
            return (
              <line
                key={`vl-${t.key}`}
                x1={t.x} y1={0}
                x2={t.x} y2={totalHeight}
                stroke={stroke}
                strokeWidth={width}
              />
            );
          })}
          {Array.from({ length: rowCount + 1 }, (_, i) => (
            <line
              key={`hl-${i}`}
              x1={0} y1={i * rowHeight}
              x2={totalWidth} y2={i * rowHeight}
              stroke={i === 0 ? 'rgba(100,116,139,0.3)' : 'rgba(100,116,139,0.08)'}
              strokeWidth={0.6}
            />
          ))}
        </svg>
      </div>
    </div>
  );
});

export default GridBackground;
