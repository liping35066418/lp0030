import { create } from 'zustand';
import type {
  Project, Task, Dependency, TaskGroup, Tag, Snapshot, ViewScale, TreeNode, FlatTask,
} from '@/types/gantt';
import { projectApi, taskApi, metaApi } from '@/services/api';
import { flattenTree } from '@/lib/gantt-utils';

interface GanttState {
  projects: (Project & { taskCount: number })[];
  currentProject: Project | null;
  tasks: Task[];
  taskTree: TreeNode[];
  flatTasks: FlatTask[];
  dependencies: Dependency[];
  groups: TaskGroup[];
  tags: Tag[];
  snapshots: Snapshot[];
  selectedTaskId: string | null;
  hoveredTaskId: string | null;
  depCreateMode: { from: string | null; active: boolean };
  expandedIds: Set<string>;
  filterGroupId: string | null;
  searchText: string;
  criticalPathEnabled: boolean;

  viewScale: ViewScale;
  pixelPerUnit: number;
  axisStart: Date;
  axisEnd: Date;
  scrollLeft: number;
  scrollTop: number;
  rowHeight: number;
  sidebarWidth: number;
  isFullscreen: boolean;

  loading: boolean;
  error: string | null;
  toast: { type: 'info' | 'success' | 'error'; msg: string } | null;

  showProjectModal: boolean;
  showTaskModal: boolean;
  editingTask: Task | null;
  showSnapshotModal: boolean;
  showDepPanel: boolean;

  set: <K extends keyof GanttState>(key: K, value: GanttState[K]) => void;
  batchSet: (patch: Partial<GanttState>) => void;
  showToast: (type: 'info' | 'success' | 'error', msg: string) => void;

  fetchProjects: () => Promise<void>;
  fetchProjectDetail: (id: string) => Promise<void>;
  createProject: (data: Partial<Project>) => Promise<string | null>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  createTask: (data: Partial<Task> & { projectId: string; afterId?: string }) => Promise<string | null>;
  updateTask: (id: string, data: Partial<Task> & { cascade?: boolean }) => Promise<void>;
  batchUpdateTasks: (updates: { id: string; fields: Partial<Task> }[]) => Promise<void>;
  reorderTasks: (order: string[], parentId?: string | null) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  refreshCurrentProject: () => Promise<void>;

  addDependency: (body: Partial<Dependency> & { projectId: string }) => Promise<string | null>;
  removeDependency: (id: string) => Promise<void>;

  createGroup: (name: string, color?: string) => Promise<string | null>;
  createTag: (name: string, color?: string) => Promise<string | null>;

  createSnapshot: (name: string, description?: string) => Promise<string | null>;
  restoreSnapshot: (id: string) => Promise<void>;
  deleteSnapshot: (id: string) => Promise<void>;

  toggleExpand: (taskId: string) => void;
  setAxisRangeByTasks: () => void;
  setViewScale: (scale: ViewScale) => void;
  zoom: (delta: number) => void;
  setZoom: (value: number) => void;
}

export const useGanttStore = create<GanttState>((set, get) => ({
  projects: [],
  currentProject: null,
  tasks: [],
  taskTree: [],
  flatTasks: [],
  dependencies: [],
  groups: [],
  tags: [],
  snapshots: [],
  selectedTaskId: null,
  hoveredTaskId: null,
  depCreateMode: { from: null, active: false },
  expandedIds: new Set(),
  filterGroupId: null,
  searchText: '',
  criticalPathEnabled: false,

  viewScale: 'week',
  pixelPerUnit: 120,
  axisStart: new Date(),
  axisEnd: new Date(Date.now() + 60 * 86400000),
  scrollLeft: 0,
  scrollTop: 0,
  rowHeight: 44,
  sidebarWidth: 300,
  isFullscreen: false,

  loading: false,
  error: null,
  toast: null,

  showProjectModal: false,
  showTaskModal: false,
  editingTask: null,
  showSnapshotModal: false,
  showDepPanel: false,

  set: (key, value) => set({ [key]: value } as Partial<GanttState>),
  batchSet: (patch) => set(patch),
  showToast: (type, msg) => {
    set({ toast: { type, msg } });
    window.setTimeout(() => {
      const cur = get().toast;
      if (cur?.msg === msg) set({ toast: null });
    }, 2800);
  },

  fetchProjects: async () => {
    try {
      set({ loading: true });
      const data = await projectApi.list();
      set({ projects: data, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      get().showToast('error', (e as Error).message);
    }
  },

  fetchProjectDetail: async (id) => {
    try {
      set({ loading: true });
      const data = await projectApi.detail(id);
      const expandedIds = new Set<string>();
      function walk(arr: TreeNode[]) {
        for (const n of arr) {
          if (n.expanded) expandedIds.add(n.id);
          if (n.children?.length > 0) walk(n.children);
        }
      }
      walk(data.taskTree);
      const flat = flattenTree(data.taskTree);
      set({
        currentProject: data.project,
        tasks: data.tasks,
        taskTree: data.taskTree,
        flatTasks: flat,
        dependencies: data.dependencies,
        groups: data.groups,
        tags: data.tags,
        snapshots: data.snapshots,
        expandedIds,
        loading: false,
      });
      get().setAxisRangeByTasks();
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      get().showToast('error', (e as Error).message);
    }
  },

  createProject: async (data) => {
    try {
      set({ loading: true });
      const r = await projectApi.create(data);
      set({ loading: false });
      get().showToast('success', '项目创建成功');
      await get().fetchProjects();
      return r.id;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      get().showToast('error', (e as Error).message);
      return null;
    }
  },

  updateProject: async (id, data) => {
    try {
      await projectApi.update(id, data);
      get().showToast('success', '项目更新成功');
      await get().fetchProjects();
      if (get().currentProject?.id === id) await get().fetchProjectDetail(id);
    } catch (e) {
      get().showToast('error', (e as Error).message);
    }
  },

  deleteProject: async (id) => {
    try {
      await projectApi.remove(id);
      get().showToast('success', '项目已删除');
      if (get().currentProject?.id === id) {
        set({ currentProject: null, tasks: [], taskTree: [], flatTasks: [], dependencies: [], groups: [], tags: [], snapshots: [] });
      }
      await get().fetchProjects();
    } catch (e) {
      get().showToast('error', (e as Error).message);
    }
  },

  createTask: async (data) => {
    try {
      const r = await taskApi.create(data);
      get().showToast('success', '任务已创建');
      await get().refreshCurrentProject();
      return r.id;
    } catch (e) {
      get().showToast('error', (e as Error).message);
      return null;
    }
  },

  updateTask: async (id, data) => {
    try {
      await taskApi.update(id, data);
      if (!data.cascade || data.cascade) {
        await get().refreshCurrentProject();
      }
    } catch (e) {
      get().showToast('error', (e as Error).message);
      throw e;
    }
  },

  batchUpdateTasks: async (updates) => {
    try {
      await taskApi.batchUpdate(updates);
      await get().refreshCurrentProject();
    } catch (e) {
      get().showToast('error', (e as Error).message);
    }
  },

  reorderTasks: async (order, parentId) => {
    const proj = get().currentProject;
    if (!proj) return;
    try {
      await taskApi.reorder(proj.id, order, parentId);
      await get().refreshCurrentProject();
    } catch (e) {
      get().showToast('error', (e as Error).message);
    }
  },

  deleteTask: async (id) => {
    try {
      await taskApi.remove(id);
      get().showToast('success', '任务已删除');
      await get().refreshCurrentProject();
    } catch (e) {
      get().showToast('error', (e as Error).message);
    }
  },

  refreshCurrentProject: async () => {
    const proj = get().currentProject;
    if (!proj) return;
    try {
      const data = await projectApi.detail(proj.id);
      const curExpanded = get().expandedIds;
      function walk(arr: TreeNode[]): TreeNode[] {
        return arr.map(n => {
          const expanded = curExpanded.has(n.id) || curExpanded.size === 0 ? n.expanded : false;
          const forceExp = curExpanded.size > 0 ? curExpanded.has(n.id) : n.expanded;
          return { ...n, expanded: forceExp, children: walk(n.children ?? []) };
        });
      }
      const tree = walk(data.taskTree);
      const flat = flattenTree(tree);
      set({
        tasks: data.tasks,
        taskTree: tree,
        flatTasks: flat,
        dependencies: data.dependencies,
        groups: data.groups,
        tags: data.tags,
        snapshots: data.snapshots,
        currentProject: data.project,
      });
    } catch (e) {
      get().showToast('error', (e as Error).message);
    }
  },

  addDependency: async (body) => {
    try {
      const r = await taskApi.addDependency(body);
      get().showToast('success', '依赖已创建');
      await get().refreshCurrentProject();
      return r.id;
    } catch (e) {
      get().showToast('error', (e as Error).message);
      return null;
    }
  },

  removeDependency: async (id) => {
    try {
      await taskApi.removeDependency(id);
      get().showToast('success', '依赖已移除');
      await get().refreshCurrentProject();
    } catch (e) {
      get().showToast('error', (e as Error).message);
    }
  },

  createGroup: async (name, color) => {
    const proj = get().currentProject;
    if (!proj) return null;
    try {
      const r = await metaApi.groups.create({ projectId: proj.id, name, color });
      get().showToast('success', '分组已创建');
      await get().refreshCurrentProject();
      return r.id;
    } catch (e) {
      get().showToast('error', (e as Error).message);
      return null;
    }
  },

  createTag: async (name, color) => {
    const proj = get().currentProject;
    if (!proj) return null;
    try {
      const r = await metaApi.tags.create({ projectId: proj.id, name, color });
      get().showToast('success', '标签已创建');
      await get().refreshCurrentProject();
      return r.id;
    } catch (e) {
      get().showToast('error', (e as Error).message);
      return null;
    }
  },

  createSnapshot: async (name, description) => {
    const proj = get().currentProject;
    if (!proj) return null;
    try {
      const r = await metaApi.snapshots.create({ projectId: proj.id, name, description });
      get().showToast('success', '快照已保存');
      await get().refreshCurrentProject();
      return r.id;
    } catch (e) {
      get().showToast('error', (e as Error).message);
      return null;
    }
  },

  restoreSnapshot: async (id) => {
    try {
      await metaApi.snapshots.restore(id);
      get().showToast('success', '快照已恢复');
      await get().refreshCurrentProject();
    } catch (e) {
      get().showToast('error', (e as Error).message);
    }
  },

  deleteSnapshot: async (id) => {
    try {
      await metaApi.snapshots.remove(id);
      get().showToast('success', '快照已删除');
      await get().refreshCurrentProject();
    } catch (e) {
      get().showToast('error', (e as Error).message);
    }
  },

  toggleExpand: (taskId) => {
    const set2 = new Set(get().expandedIds);
    if (set2.has(taskId)) set2.delete(taskId); else set2.add(taskId);
    const cur = get().expandedIds;
    void cur;
    function walk(arr: TreeNode[]): TreeNode[] {
      return arr.map(n => {
        let expanded = n.expanded;
        if (n.id === taskId) expanded = !n.expanded;
        return { ...n, expanded, children: walk(n.children ?? []) };
      });
    }
    set({
      expandedIds: set2,
      taskTree: walk(get().taskTree),
      flatTasks: flattenTree(walk(get().taskTree)),
    });
  },

  setAxisRangeByTasks: () => {
    const proj = get().currentProject;
    const tasks = get().tasks;
    if (!proj) return;
    let minD = new Date(proj.startDate);
    let maxD = new Date(proj.endDate);
    if (tasks.length > 0) {
      for (const t of tasks) {
        const s = new Date(t.startDate);
        const e = new Date(t.endDate);
        if (s < minD) minD = s;
        if (e > maxD) maxD = e;
      }
    }
    const scale = get().viewScale;
    const pad = scale === 'day' ? 3 : scale === 'week' ? 2 : scale === 'month' ? 1 : 1;
    const ms = 86400000;
    const start = new Date(minD.getTime() - pad * 7 * ms);
    const end = new Date(maxD.getTime() + pad * 7 * ms);
    set({ axisStart: start, axisEnd: end });
  },

  setViewScale: (scale) => {
    const mapping = { day: 60, week: 120, month: 200, quarter: 320 } as const;
    set({ viewScale: scale, pixelPerUnit: mapping[scale] });
    get().setAxisRangeByTasks();
  },

  zoom: (delta) => {
    const cfg = { day: { min: 20, max: 120 }, week: { min: 60, max: 240 }, month: { min: 120, max: 400 }, quarter: { min: 240, max: 600 } } as const;
    const c = cfg[get().viewScale];
    const cur = get().pixelPerUnit;
    const next = Math.max(c.min, Math.min(c.max, cur + delta));
    set({ pixelPerUnit: next });
  },

  setZoom: (value) => {
    set({ pixelPerUnit: value });
  },
}));
