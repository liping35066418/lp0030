import type { ApiResponse, Project, Task, Dependency, TaskGroup, Tag, Snapshot, ValidationResult, TreeNode } from '@/types/gantt';

const BASE = '/api';

async function request<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  });
  const data = (await res.json()) as ApiResponse<T>;
  if (!data.success) throw new Error(data.error || '请求失败');
  return data.data as T;
}

export const projectApi = {
  list: () => request<(Project & { taskCount: number })[]>('/projects'),
  detail: (id: string) => request<{
    project: Project;
    tasks: Task[];
    taskTree: TreeNode[];
    flatOrdered: (Task & { level: number })[];
    dependencies: Dependency[];
    groups: TaskGroup[];
    tags: Tag[];
    snapshots: Snapshot[];
  }>(`/projects/${id}`),
  create: (body: Partial<Project>) => request<{ id: string }>('/projects', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Project>) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string) => request(`/projects/${id}`, { method: 'DELETE' }),
};

export const taskApi = {
  byProject: (projectId: string) => request<{
    tasks: Task[];
    taskTree: TreeNode[];
    flatOrdered: (Task & { level: number })[];
    dependencies: Dependency[];
  }>(`/tasks/project/${projectId}`),
  create: (body: Partial<Task> & { projectId: string; afterId?: string }) =>
    request<{ id: string }>('/tasks', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Task> & { cascade?: boolean }) =>
    request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  batchUpdate: (updates: { id: string; fields: Partial<Task> }[]) =>
    request('/tasks/batch-update', { method: 'POST', body: JSON.stringify({ updates }) }),
  reorder: (projectId: string, order: string[], parentId?: string | null) =>
    request('/tasks/reorder', { method: 'POST', body: JSON.stringify({ projectId, order, parentId }) }),
  remove: (id: string) => request(`/tasks/${id}`, { method: 'DELETE' }),
  addDependency: (body: Partial<Dependency> & { projectId: string }) =>
    request<{ id: string }>('/tasks/dependencies', { method: 'POST', body: JSON.stringify(body) }),
  removeDependency: (id: string) => request(`/tasks/dependencies/${id}`, { method: 'DELETE' }),
  validateChange: (id: string, startDate: string, endDate: string) =>
    request<ValidationResult>('/tasks/validate-change', { method: 'POST', body: JSON.stringify({ id, startDate, endDate }) }),
};

export const metaApi = {
  groups: {
    list: (projectId: string) => request<TaskGroup[]>(`/meta/groups/project/${projectId}`),
    create: (body: { projectId: string; name: string; color?: string }) =>
      request<{ id: string }>('/meta/groups', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<TaskGroup>) =>
      request(`/meta/groups/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: string) => request(`/meta/groups/${id}`, { method: 'DELETE' }),
  },
  tags: {
    list: (projectId: string) => request<Tag[]>(`/meta/tags/project/${projectId}`),
    create: (body: { projectId: string; name: string; color?: string }) =>
      request<{ id: string }>('/meta/tags', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Tag>) =>
      request(`/meta/tags/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: string) => request(`/meta/tags/${id}`, { method: 'DELETE' }),
  },
  snapshots: {
    list: (projectId: string) => request<Snapshot[]>(`/meta/snapshots/project/${projectId}`),
    detail: (id: string) => request<Snapshot & { data: unknown }>(`/meta/snapshots/${id}`),
    create: (body: { projectId: string; name: string; description?: string }) =>
      request<{ id: string }>('/meta/snapshots', { method: 'POST', body: JSON.stringify(body) }),
    restore: (id: string) => request(`/meta/snapshots/${id}/restore`, { method: 'POST' }),
    remove: (id: string) => request(`/meta/snapshots/${id}`, { method: 'DELETE' }),
  },
};
