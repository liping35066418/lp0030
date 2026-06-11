export interface Project {
  id: string;
  name: string;
  description: string | null;
  timezone: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
export type TaskType = 'task' | 'milestone' | 'summary';

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

export type DependencyType = 'fs' | 'ff' | 'ss' | 'sf';

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
  data: string;
  createdAt: string;
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

export type ViewScale = 'day' | 'week' | 'month' | 'quarter';
