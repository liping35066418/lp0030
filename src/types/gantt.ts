export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
export type TaskType = 'task' | 'milestone' | 'summary';
export type DependencyType = 'fs' | 'ff' | 'ss' | 'sf';
export type ViewScale = 'day' | 'week' | 'month' | 'quarter';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  timezone: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
}

export interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  startDate: string;
  endDate: string;
  duration: number;
  progress: number;
  orderIndex: number;
  rowIndex: number;
  groupId: string | null;
  tags: string;
  color: string;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Dependency {
  id: string;
  projectId: string;
  fromTaskId: string;
  toTaskId: string;
  type: DependencyType;
  lag: number;
  createdAt: string;
}

export interface TaskGroup {
  id: string;
  projectId: string;
  name: string;
  color: string;
  orderIndex: number;
  createdAt: string;
}

export interface Tag {
  id: string;
  projectId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Snapshot {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  createdAt: string;
  data?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface TreeNode extends Task {
  children: TreeNode[];
  level: number;
  expanded: boolean;
}

export interface FlatTask extends Task {
  level: number;
  _y?: number;
  children?: TreeNode[];
}

export interface DraggingState {
  type: 'move' | 'resize-left' | 'resize-right' | 'row' | null;
  taskId: string | null;
  startX: number;
  startY: number;
  startDate?: string;
  endDate?: string;
  startRowIndex?: number;
}

export interface DragOverState {
  taskId: string | null;
  position: 'before' | 'after' | 'inside' | null;
}

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; dot: string }> = {
  not_started: { label: '未开始', color: 'bg-slate-400', dot: '#94a3b8' },
  in_progress: { label: '进行中', color: 'bg-blue-500', dot: '#3b82f6' },
  completed: { label: '已完成', color: 'bg-emerald-500', dot: '#10b981' },
  blocked: { label: '被阻塞', color: 'bg-amber-500', dot: '#f59e0b' },
  cancelled: { label: '已取消', color: 'bg-rose-500', dot: '#f43f5e' },
};

export const TYPE_CONFIG: Record<TaskType, { label: string; icon: string }> = {
  task: { label: '任务', icon: '◼' },
  milestone: { label: '里程碑', icon: '◆' },
  summary: { label: '阶段', icon: '▤' },
};

export const DEP_TYPE_CONFIG: Record<DependencyType, { label: string; desc: string }> = {
  fs: { label: 'FS', desc: '完成→开始' },
  ff: { label: 'FF', desc: '完成→完成' },
  ss: { label: 'SS', desc: '开始→开始' },
  sf: { label: 'SF', desc: '开始→完成' },
};

export const VIEW_SCALE_CONFIG: Record<ViewScale, { label: string; unitDays: number; minZoom: number; maxZoom: number }> = {
  day: { label: '日', unitDays: 1, minZoom: 20, maxZoom: 120 },
  week: { label: '周', unitDays: 7, minZoom: 60, maxZoom: 240 },
  month: { label: '月', unitDays: 30, minZoom: 120, maxZoom: 400 },
  quarter: { label: '季', unitDays: 90, minZoom: 240, maxZoom: 600 },
};
