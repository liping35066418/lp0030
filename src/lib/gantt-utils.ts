import type { ViewScale, Task, TreeNode, FlatTask } from '@/types/gantt';

export function formatDate(date: Date | string, fmt = 'YYYY-MM-DD'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
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

export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

export function diffDays(a: Date | string, b: Date | string): number {
  const d1 = typeof a === 'string' ? new Date(a) : a;
  const d2 = typeof b === 'string' ? new Date(b) : b;
  const MS = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((utc2 - utc1) / MS);
}

export function startOfWeek(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function startOfQuarter(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

export function startOfScale(date: Date | string, scale: ViewScale): Date {
  switch (scale) {
    case 'day': return typeof date === 'string' ? new Date(date.slice(0, 10)) : new Date(date.getFullYear(), date.getMonth(), date.getDate());
    case 'week': return startOfWeek(date);
    case 'month': return startOfMonth(date);
    case 'quarter': return startOfQuarter(date);
  }
}

export function addScale(date: Date | string, scale: ViewScale, n = 1): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
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
): { major: TimeTick[]; minor: TimeTick[]; totalWidth: number } {
  const majors: TimeTick[] = [];
  const minors: TimeTick[] = [];

  let cursor = startOfScale(startDate, scale);
  let x = 0;
  const end = new Date(endDate);
  end.setDate(end.getDate() + 2);

  while (cursor <= end) {
    const nextCursor = addScale(cursor, scale, 1);
    const majorWidth = pixelPerUnit;
    let label = '';
    let subLabel = '';

    switch (scale) {
      case 'day':
        label = formatShortDate(cursor);
        subLabel = ['日', '一', '二', '三', '四', '五', '六'][cursor.getDay()];
        break;
      case 'week': {
        const wEnd = addDays(cursor, 6);
        label = `${formatShortDate(cursor)} - ${formatShortDate(wEnd)}`;
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
        const d = addDays(cursor, i);
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
): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const start = startOfScale(axisStart, scale);
  const MS = 1000 * 60 * 60 * 24;
  const totalMs = new Date(addScale(start, scale, 1)).getTime() - start.getTime();
  const unitCount = (d.getTime() - start.getTime()) / totalMs;
  return unitCount * pixelPerUnit;
}

export function pixelToDate(
  px: number,
  axisStart: Date,
  scale: ViewScale,
  pixelPerUnit: number,
): Date {
  const start = startOfScale(axisStart, scale);
  const unitCount = px / pixelPerUnit;
  const totalMs = new Date(addScale(start, scale, 1)).getTime() - start.getTime();
  return new Date(start.getTime() + unitCount * totalMs);
}

export function snapToDate(date: Date, scale: ViewScale, round: 'floor' | 'round' | 'ceil' = 'round'): Date {
  const d = new Date(date);
  switch (scale) {
    case 'day': {
      const ms = d.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const frac = ms / (24 * 3600 * 1000);
      const off = round === 'floor' ? Math.floor(frac) : round === 'ceil' ? Math.ceil(frac) : Math.round(frac);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + off);
    }
    case 'week': {
      const sow = startOfWeek(d);
      const frac = (d.getTime() - sow.getTime()) / (7 * 24 * 3600 * 1000);
      const off = round === 'floor' ? Math.floor(frac) : round === 'ceil' ? Math.ceil(frac) : Math.round(frac);
      return addDays(sow, off * 7);
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
