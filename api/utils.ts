import type { Task, Dependency, DependencyType, ValidationResult } from './types.js';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function diffDays(startStr: string, endStr: string): number {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function calcDuration(startStr: string, endStr: string): number {
  return diffDays(startStr, endStr) + 1;
}

export function detectCycle(
  dependencies: Pick<Dependency, 'fromTaskId' | 'toTaskId'>[],
  fromId: string,
  toId: string
): boolean {
  const adjMap = new Map<string, Set<string>>();
  for (const dep of dependencies) {
    if (!adjMap.has(dep.fromTaskId)) {
      adjMap.set(dep.fromTaskId, new Set());
    }
    adjMap.get(dep.fromTaskId)!.add(dep.toTaskId);
  }
  if (!adjMap.has(fromId)) {
    adjMap.set(fromId, new Set());
  }
  adjMap.get(fromId)!.add(toId);

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const colorMap = new Map<string, number>();
  const allNodes = new Set<string>();
  for (const dep of dependencies) {
    allNodes.add(dep.fromTaskId);
    allNodes.add(dep.toTaskId);
  }
  allNodes.add(fromId);
  allNodes.add(toId);
  for (const n of allNodes) colorMap.set(n, WHITE);

  function dfs(node: string): boolean {
    colorMap.set(node, GRAY);
    const neighbors = adjMap.get(node);
    if (neighbors) {
      for (const next of neighbors) {
        const c = colorMap.get(next)!;
        if (c === GRAY) return true;
        if (c === WHITE && dfs(next)) return true;
      }
    }
    colorMap.set(node, BLACK);
    return false;
  }

  for (const n of allNodes) {
    if (colorMap.get(n) === WHITE) {
      if (dfs(n)) return true;
    }
  }
  return false;
}

export function computeTaskDatesByDeps(
  task: Task,
  allTasks: Task[],
  dependencies: Dependency[]
): { startDate: string; endDate: string } | null {
  const incoming = dependencies.filter(d => d.toTaskId === task.id);
  if (incoming.length === 0) return null;

  let maxEnd = task.startDate;
  let changed = false;

  for (const dep of incoming) {
    const fromTask = allTasks.find(t => t.id === dep.fromTaskId);
    if (!fromTask) continue;
    const lagDays = dep.lag || 0;

    switch (dep.type as DependencyType) {
      case 'fs': {
        const proposedStart = addDays(fromTask.endDate, 1 + lagDays);
        if (new Date(proposedStart) > new Date(maxEnd)) {
          maxEnd = proposedStart;
          changed = true;
        }
        break;
      }
      case 'ss': {
        const proposedStart = addDays(fromTask.startDate, lagDays);
        if (new Date(proposedStart) > new Date(maxEnd)) {
          maxEnd = proposedStart;
          changed = true;
        }
        break;
      }
      case 'ff': {
        const proposedEnd = addDays(fromTask.endDate, lagDays);
        const proposedStart = addDays(proposedEnd, -(task.duration - 1));
        if (new Date(proposedStart) > new Date(maxEnd)) {
          maxEnd = proposedStart;
          changed = true;
        }
        break;
      }
      case 'sf': {
        const proposedEnd = addDays(fromTask.startDate, lagDays);
        const proposedStart = addDays(proposedEnd, -(task.duration - 1));
        if (new Date(proposedStart) > new Date(maxEnd)) {
          maxEnd = proposedStart;
          changed = true;
        }
        break;
      }
    }
  }

  if (!changed) return null;

  const duration = task.duration > 0 ? task.duration : 1;
  const endDate = addDays(maxEnd, duration - 1);
  return { startDate: maxEnd, endDate };
}

export function validateTaskTimeChange(
  task: Task,
  newStart: string,
  newEnd: string,
  allTasks: Task[],
  dependencies: Dependency[]
): ValidationResult {
  const errors: string[] = [];
  const incoming = dependencies.filter(d => d.toTaskId === task.id);

  for (const dep of incoming) {
    const fromTask = allTasks.find(t => t.id === dep.fromTaskId);
    if (!fromTask) continue;
    const lagDays = dep.lag || 0;

    switch (dep.type as DependencyType) {
      case 'fs': {
        const minStart = addDays(fromTask.endDate, 1 + lagDays);
        if (new Date(newStart) < new Date(minStart)) {
          errors.push(`前置任务「${fromTask.name}」未完成，开始时间不能早于 ${minStart.slice(0, 10)}`);
        }
        break;
      }
      case 'ss': {
        const minStart = addDays(fromTask.startDate, lagDays);
        if (new Date(newStart) < new Date(minStart)) {
          errors.push(`与「${fromTask.name}」SS依赖：开始时间不能早于 ${minStart.slice(0, 10)}`);
        }
        break;
      }
      case 'ff': {
        const minEnd = addDays(fromTask.endDate, lagDays);
        if (new Date(newEnd) < new Date(minEnd)) {
          errors.push(`与「${fromTask.name}」FF依赖：结束时间不能早于 ${minEnd.slice(0, 10)}`);
        }
        break;
      }
      case 'sf': {
        const minEnd = addDays(fromTask.startDate, lagDays);
        if (new Date(newEnd) < new Date(minEnd)) {
          errors.push(`与「${fromTask.name}」SF依赖：结束时间不能早于 ${minEnd.slice(0, 10)}`);
        }
        break;
      }
    }
  }

  const descendants = getDescendantIds(task.id, allTasks);
  for (const descId of descendants) {
    const desc = allTasks.find(t => t.id === descId);
    if (!desc) continue;
    if (new Date(desc.startDate) < new Date(newStart)) {
      errors.push(`子任务「${desc.name}」开始时间早于父任务，无法调整`);
      break;
    }
    if (new Date(desc.endDate) > new Date(newEnd)) {
      errors.push(`子任务「${desc.name}」结束时间晚于父任务，无法调整`);
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

function getDescendantIds(parentId: string, allTasks: Task[]): string[] {
  const result: string[] = [];
  const stack = [parentId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const children = allTasks.filter(t => t.parentId === id);
    for (const c of children) {
      result.push(c.id);
      stack.push(c.id);
    }
  }
  return result;
}

export function buildTaskTree(tasks: Task[], expandedIds: Set<string> = new Set()): {
  tree: Array<Task & { children: unknown[]; level: number; expanded: boolean }>;
  flatOrdered: (Task & { level: number })[];
} {
  const byParent = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const key = t.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(t);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  type Node = Task & { children: Node[]; level: number; expanded: boolean };
  const tree: Node[] = [];
  const flatOrdered: (Task & { level: number })[] = [];

  function buildNodes(parentId: string | null, level: number): Node[] {
    const nodes: Node[] = [];
    const list = byParent.get(parentId) ?? [];
    for (const t of list) {
      const expanded = expandedIds.size === 0 ? true : expandedIds.has(t.id);
      const node: Node = { ...t, children: [], level, expanded };
      node.children = buildNodes(t.id, level + 1);
      nodes.push(node);
      flatOrdered.push({ ...t, level });
    }
    return nodes;
  }

  return { tree: buildNodes(null, 0), flatOrdered };
}

export function convertTimezone(dateStr: string, fromTZ: string, toTZ: string): string {
  const date = new Date(dateStr);
  const fmt = (tz: string) => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).format(date);
  };
  void fromTZ;
  void fmt;
  const iso = date.toISOString();
  if (toTZ === 'UTC' || !toTZ) return iso;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: toTZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.000Z`;
  } catch {
    return iso;
  }
}

export function aggregateParentProgress(
  task: Task,
  allTasks: Task[]
): number {
  const children = allTasks.filter(t => t.parentId === task.id);
  if (children.length === 0) return task.progress;
  let totalDur = 0;
  let weighted = 0;
  for (const c of children) {
    const cDur = Math.max(1, c.duration);
    const cProgress = aggregateParentProgress(c, allTasks);
    totalDur += cDur;
    weighted += cDur * cProgress;
  }
  return totalDur === 0 ? 0 : Math.round(weighted / totalDur);
}
