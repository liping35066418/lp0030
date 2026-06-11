import type { ViewScale, Task, TreeNode, FlatTask, Dependency } from '@/types/gantt';

export function getTimezoneOffset(timezone: string, date: Date | string): number {
  if (!timezone || timezone === 'UTC') return 0;
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    const utcDate = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(d.toLocaleString('en-US', { timeZone: timezone }));
    return (utcDate.getTime() - tzDate.getTime());
  } catch {
    return 0;
  }
}

export function toTimezoneDate(date: Date | string, timezone: string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  const offset = getTimezoneOffset(timezone, d);
  return new Date(d.getTime() + offset);
}

export function formatDate(date: Date | string, fmt = 'YYYY-MM-DD', timezone?: string): string {
  const d = timezone ? toTimezoneDate(date, timezone) : (typeof date === 'string' ? new Date(date) : date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return fmt
    .replace('YYYY', String(y))
    .replace('MM', m)
    .replace('DD', day)
    .replace('HH', hh)
    .replace('mm', mm)
    .replace('ss', ss);
}

export function formatShortDate(date: Date | string, timezone?: string): string {
  const d = timezone ? toTimezoneDate(date, timezone) : (typeof date === 'string' ? new Date(date) : date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function addDays(date: Date | string, days: number, timezone?: string): Date {
  const d = timezone ? toTimezoneDate(date, timezone) : (typeof date === 'string' ? new Date(date) : new Date(date.getTime()));
  d.setDate(d.getDate() + days);
  return d;
}

export function diffDays(a: Date | string, b: Date | string, timezone?: string): number {
  const d1 = timezone ? toTimezoneDate(a, timezone) : (typeof a === 'string' ? new Date(a) : a);
  const d2 = timezone ? toTimezoneDate(b, timezone) : (typeof b === 'string' ? new Date(b) : b);
  const MS = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((utc2 - utc1) / MS);
}

export function startOfWeek(date: Date | string, timezone?: string): Date {
  const d = timezone ? toTimezoneDate(date, timezone) : (typeof date === 'string' ? new Date(date) : new Date(date.getTime()));
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date | string, timezone?: string): Date {
  const d = timezone ? toTimezoneDate(date, timezone) : (typeof date === 'string' ? new Date(date) : new Date(date.getTime()));
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function startOfQuarter(date: Date | string, timezone?: string): Date {
  const d = timezone ? toTimezoneDate(date, timezone) : (typeof date === 'string' ? new Date(date) : new Date(date.getTime()));
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

export function startOfScale(date: Date | string, scale: ViewScale, timezone?: string): Date {
  switch (scale) {
    case 'day': {
      const d = timezone ? toTimezoneDate(date, timezone) : (typeof date === 'string' ? new Date(date.slice(0, 10)) : new Date(date.getFullYear(), date.getMonth(), date.getDate()));
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    case 'week': return startOfWeek(date, timezone);
    case 'month': return startOfMonth(date, timezone);
    case 'quarter': return startOfQuarter(date, timezone);
  }
}

export function addScale(date: Date | string, scale: ViewScale, n = 1, timezone?: string): Date {
  const d = timezone ? toTimezoneDate(date, timezone) : (typeof date === 'string' ? new Date(date) : new Date(date.getTime()));
  switch (scale) {
    case 'day': d.setDate(d.getDate() + n); break;
    case 'week': d.setDate(d.getDate() + n * 7); break;
    case 'month': d.setMonth(d.getMonth() + n); break;
    case 'quarter': d.setMonth(d.getMonth() + n * 3); break;
  }
  return d;
}

export interface TimeTick {
  key: string;
  date: Date;
  label: string;
  subLabel?: string;
  x: number;
  width: number;
  isMajor: boolean;
}

export function generateTimeTicks(
  startDate: Date,
  endDate: Date,
  scale: ViewScale,
  pixelPerUnit: number,
  timezone?: string,
): { major: TimeTick[]; minor: TimeTick[]; totalWidth: number } {
  const majors: TimeTick[] = [];
  const minors: TimeTick[] = [];

  let cursor = startOfScale(startDate, scale, timezone);
  let x = 0;
  const end = toTimezoneDate(endDate, timezone || 'UTC');
  end.setDate(end.getDate() + 2);

  while (cursor <= end) {
    const nextCursor = addScale(cursor, scale, 1, timezone);
    const majorWidth = pixelPerUnit;
    let label = '';
    let subLabel = '';

    switch (scale) {
      case 'day':
        label = formatShortDate(cursor, timezone);
        subLabel = ['日', '一', '二', '三', '四', '五', '六'][cursor.getDay()];
        break;
      case 'week': {
        const wEnd = addDays(cursor, 6, timezone);
        label = `${formatShortDate(cursor, timezone)} - ${formatShortDate(wEnd, timezone)}`;
        subLabel = `${cursor.getFullYear()}年第${Math.ceil(((cursor.getDate() + new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() - 1) / 7)) + 1}周`;
        break;
      }
      case 'month':
        label = `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`;
        subLabel = `${Math.ceil((cursor.getMonth() + 1) / 3)}季度`;
        break;
      case 'quarter':
        label = `${cursor.getFullYear()}年Q${Math.ceil((cursor.getMonth() + 1) / 3)}`;
        subLabel = `${cursor.getFullYear()}`;
        break;
    }

    majors.push({
      key: `M-${cursor.getTime()}`,
      date: new Date(cursor),
      label,
      subLabel,
      x,
      width: majorWidth,
      isMajor: true,
    });

    if (scale === 'day') {
      minors.push({
        key: `m-${cursor.getTime()}`,
        date: new Date(cursor),
        label: String(cursor.getDate()),
        x,
        width: majorWidth,
        isMajor: false,
      });
    } else if (scale === 'week') {
      for (let i = 0; i < 7; i++) {
        const d = addDays(cursor, i, timezone);
        if (d > end) break;
        minors.push({
          key: `m-${d.getTime()}`,
          date: d,
          label: String(d.getDate()),
          x: x + (i * majorWidth) / 7,
          width: majorWidth / 7,
          isMajor: false,
        });
      }
    } else if (scale === 'month') {
      const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      for (let i = 0; i < daysInMonth; i++) {
        const d = new Date(cursor.getFullYear(), cursor.getMonth(), i + 1);
        if (d > end) break;
        minors.push({
          key: `m-${d.getTime()}`,
          date: d,
          label: String(i + 1),
          x: x + (i * majorWidth) / daysInMonth,
          width: majorWidth / daysInMonth,
          isMajor: false,
        });
      }
    } else if (scale === 'quarter') {
      for (let i = 0; i < 3; i++) {
        const d = new Date(cursor.getFullYear(), cursor.getMonth() + i, 1);
        if (d > end) break;
        const nd = new Date(cursor.getFullYear(), cursor.getMonth() + i + 1, 1);
        const ndTotal = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 1);
        const ratio1 = (nd.getTime() - d.getTime()) / (ndTotal.getTime() - cursor.getTime());
        const ratio0 = (d.getTime() - cursor.getTime()) / (ndTotal.getTime() - cursor.getTime());
        minors.push({
          key: `m-${d.getTime()}`,
          date: d,
          label: `${d.getMonth() + 1}月`,
          x: x + ratio0 * majorWidth,
          width: ratio1 * majorWidth,
          isMajor: false,
        });
      }
    }

    x += majorWidth;
    cursor = nextCursor;
  }

  return { major: majors, minor: minors, totalWidth: x };
}

export function dateToPixel(
  date: Date | string,
  axisStart: Date,
  scale: ViewScale,
  pixelPerUnit: number,
  timezone?: string,
): number {
  const d = timezone ? toTimezoneDate(date, timezone) : (typeof date === 'string' ? new Date(date) : date);
  const start = startOfScale(axisStart, scale, timezone);
  const totalMs = new Date(addScale(start, scale, 1, timezone)).getTime() - start.getTime();
  const unitCount = (d.getTime() - start.getTime()) / totalMs;
  return unitCount * pixelPerUnit;
}

export function pixelToDate(
  px: number,
  axisStart: Date,
  scale: ViewScale,
  pixelPerUnit: number,
  timezone?: string,
): Date {
  const start = startOfScale(axisStart, scale, timezone);
  const unitCount = px / pixelPerUnit;
  const totalMs = new Date(addScale(start, scale, 1, timezone)).getTime() - start.getTime();
  const tzDate = new Date(start.getTime() + unitCount * totalMs);
  if (timezone && timezone !== 'UTC') {
    const offset = getTimezoneOffset(timezone, tzDate);
    return new Date(tzDate.getTime() - offset);
  }
  return tzDate;
}

export function snapToDate(date: Date, scale: ViewScale, round: 'floor' | 'round' | 'ceil' = 'round', timezone?: string): Date {
  const d = timezone ? toTimezoneDate(date, timezone) : new Date(date);
  switch (scale) {
    case 'day': {
      const ms = d.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const frac = ms / (24 * 3600 * 1000);
      const off = round === 'floor' ? Math.floor(frac) : round === 'ceil' ? Math.ceil(frac) : Math.round(frac);
      const result = new Date(d.getFullYear(), d.getMonth(), d.getDate() + off);
      if (timezone && timezone !== 'UTC') {
        const offset = getTimezoneOffset(timezone, result);
        return new Date(result.getTime() - offset);
      }
      return result;
    }
    case 'week': {
      const sow = startOfWeek(d, timezone);
      const frac = (d.getTime() - sow.getTime()) / (7 * 24 * 3600 * 1000);
      const off = round === 'floor' ? Math.floor(frac) : round === 'ceil' ? Math.ceil(frac) : Math.round(frac);
      const result = addDays(sow, off * 7, timezone);
      if (timezone && timezone !== 'UTC') {
        const offset = getTimezoneOffset(timezone, result);
        return new Date(result.getTime() - offset);
      }
      return result;
    }
    default: return d;
  }
}

export function convertTZDisplay(dateStr: string, timezone: string): string {
  if (!timezone || timezone === 'UTC') return dateStr;
  try {
    const d = new Date(dateStr);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T00:00:00.000Z`;
  } catch {
    return dateStr;
  }
}

export function flattenTree(nodes: TreeNode[]): FlatTask[] {
  const result: FlatTask[] = [];
  function walk(arr: TreeNode[]) {
    for (const n of arr) {
      result.push({ ...n });
      if (n.expanded && n.children?.length > 0) walk(n.children);
    }
  }
  walk(nodes);
  return result;
}

export function getAncestorIds(id: string, tasks: Task[]): string[] {
  const ids: string[] = [];
  const byId = new Map(tasks.map(t => [t.id, t]));
  let cur = byId.get(id);
  while (cur?.parentId) {
    ids.push(cur.parentId);
    cur = byId.get(cur.parentId);
  }
  return ids;
}

export function getDescendantIds(id: string, tasks: Task[]): string[] {
  const ids: string[] = [];
  const byParent = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!byParent.has(t.parentId ?? '')) byParent.set(t.parentId ?? '', []);
    byParent.get(t.parentId ?? '')!.push(t);
  }
  const stack = [id];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const children = byParent.get(cur) ?? [];
    for (const c of children) {
      ids.push(c.id);
      stack.push(c.id);
    }
  }
  return ids;
}

export function parseTags(str: string): string[] {
  try { return JSON.parse(str) as string[]; } catch { return []; }
}

export function rgbAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.length === 3 ? clean[0] + clean[0] : clean.slice(0, 2), 16);
  const g = parseInt(clean.length === 3 ? clean[1] + clean[1] : clean.slice(2, 4), 16);
  const b = parseInt(clean.length === 3 ? clean[2] + clean[2] : clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function lighten(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  let r = parseInt(clean.length === 3 ? clean[0] + clean[0] : clean.slice(0, 2), 16);
  let g = parseInt(clean.length === 3 ? clean[1] + clean[1] : clean.slice(2, 4), 16);
  let b = parseInt(clean.length === 3 ? clean[2] + clean[2] : clean.slice(4, 6), 16);
  r = Math.min(255, Math.round(r + (255 - r) * amount));
  g = Math.min(255, Math.round(g + (255 - g) * amount));
  b = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, wait: number): T {
  let t: number | null = null;
  return ((...args: unknown[]) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), wait);
  }) as T;
}

export function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface CriticalPathResult {
  criticalTaskIds: Set<string>;
  criticalDepIds: Set<string>;
  projectDuration: number;
}

export function calculateCriticalPath(
  tasks: Task[],
  dependencies: Dependency[],
): CriticalPathResult {
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  const inDeps = new Map<string, Dependency[]>();
  const outDeps = new Map<string, Dependency[]>();
  for (const t of tasks) {
    inDeps.set(t.id, []);
    outDeps.set(t.id, []);
  }
  for (const d of dependencies) {
    if (!taskMap.has(d.fromTaskId) || !taskMap.has(d.toTaskId)) continue;
    outDeps.get(d.fromTaskId)!.push(d);
    inDeps.get(d.toTaskId)!.push(d);
  }

  const earliestStart = new Map<string, number>();
  const earliestFinish = new Map<string, number>();

  const topoOrder: string[] = [];
  const inDegree = new Map<string, number>();
  for (const t of tasks) {
    inDegree.set(t.id, inDeps.get(t.id)!.length);
  }
  const queue: string[] = [];
  for (const t of tasks) {
    if (inDegree.get(t.id) === 0) queue.push(t.id);
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    topoOrder.push(id);
    for (const d of outDeps.get(id)!) {
      const next = d.toTaskId;
      inDegree.set(next, inDegree.get(next)! - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }

  for (const id of topoOrder) {
    const task = taskMap.get(id)!;
    const dur = Math.max(0, task.duration || 0);
    let es = 0;
    const ins = inDeps.get(id)!;
    for (const d of ins) {
      const fromTask = taskMap.get(d.fromTaskId);
      if (!fromTask) continue;
      const fromEf = earliestFinish.get(d.fromTaskId) ?? 0;
      const fromEs = earliestStart.get(d.fromTaskId) ?? 0;
      const lag = d.lag || 0;
      let constraint = 0;
      switch (d.type) {
        case 'fs': constraint = fromEf + lag; break;
        case 'ss': constraint = fromEs + lag; break;
        case 'ff': constraint = fromEf + lag - dur; break;
        case 'sf': constraint = fromEs + lag - dur; break;
      }
      if (constraint > es) es = constraint;
    }
    earliestStart.set(id, es);
    earliestFinish.set(id, es + dur);
  }

  let maxEf = 0;
  for (const ef of earliestFinish.values()) {
    if (ef > maxEf) maxEf = ef;
  }

  const latestFinish = new Map<string, number>();
  const latestStart = new Map<string, number>();

  const reverseOrder = [...topoOrder].reverse();
  for (const id of reverseOrder) {
    const task = taskMap.get(id)!;
    const dur = Math.max(0, task.duration || 0);
    let lf = maxEf;
    const outs = outDeps.get(id)!;
    for (const d of outs) {
      const toTask = taskMap.get(d.toTaskId);
      if (!toTask) continue;
      const toLf = latestFinish.get(d.toTaskId) ?? maxEf;
      const toLs = latestStart.get(d.toTaskId) ?? maxEf;
      const lag = d.lag || 0;
      let constraint = maxEf;
      switch (d.type) {
        case 'fs': constraint = toLs - lag; break;
        case 'ss': constraint = toLs - lag + dur; break;
        case 'ff': constraint = toLf - lag; break;
        case 'sf': constraint = toLf - lag + dur; break;
      }
      if (constraint < lf) lf = constraint;
    }
    latestFinish.set(id, lf);
    latestStart.set(id, lf - dur);
  }

  const criticalTaskIds = new Set<string>();
  for (const id of topoOrder) {
    const es = earliestStart.get(id) ?? 0;
    const ls = latestStart.get(id) ?? 0;
    const slack = ls - es;
    if (Math.abs(slack) < 0.001) {
      criticalTaskIds.add(id);
    }
  }

  const criticalDepIds = new Set<string>();
  for (const d of dependencies) {
    if (criticalTaskIds.has(d.fromTaskId) && criticalTaskIds.has(d.toTaskId)) {
      const fromEf = earliestFinish.get(d.fromTaskId) ?? 0;
      const fromEs = earliestStart.get(d.fromTaskId) ?? 0;
      const toEs = earliestStart.get(d.toTaskId) ?? 0;
      const toEf = earliestFinish.get(d.toTaskId) ?? 0;
      const lag = d.lag || 0;
      let isCritical = false;
      switch (d.type) {
        case 'fs':
          isCritical = Math.abs(fromEf + lag - toEs) < 0.001;
          break;
        case 'ss':
          isCritical = Math.abs(fromEs + lag - toEs) < 0.001;
          break;
        case 'ff':
          isCritical = Math.abs(fromEf + lag - toEf) < 0.001;
          break;
        case 'sf':
          isCritical = Math.abs(fromEs + lag - toEf) < 0.001;
          break;
      }
      if (isCritical) criticalDepIds.add(d.id);
    }
  }

  if (criticalTaskIds.size === 0 && tasks.length > 0) {
    let maxDur = 0;
    let maxId = '';
    for (const t of tasks) {
      if ((t.duration || 0) > maxDur) {
        maxDur = t.duration || 0;
        maxId = t.id;
      }
    }
    if (maxId) criticalTaskIds.add(maxId);
  }

  return { criticalTaskIds, criticalDepIds, projectDuration: maxEf };
}

export function calculateWeightedProgress(tasks: Task[]): number {
  let totalWeight = 0;
  let weightedProgress = 0;
  for (const t of tasks) {
    if (t.type === 'summary') continue;
    const dur = Math.max(0, t.duration || 0);
    totalWeight += dur;
    weightedProgress += dur * (t.progress || 0);
  }
  if (totalWeight === 0) return 0;
  return Math.round((weightedProgress / totalWeight) * 100) / 100;
}
