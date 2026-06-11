import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';
import { generateId, nowISO, buildTaskTree } from '../utils.js';
import type { Project } from '../types.js';

const router = Router();

router.get('/', (_req: Request, res: Response): void => {
  try {
    const rows = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.projectId = p.id) as taskCount
      FROM projects p ORDER BY p.updatedAt DESC
    `).all() as Array<Project & { taskCount: number }>;
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as Project | undefined;
    if (!project) {
      res.status(404).json({ success: false, error: '项目不存在' });
      return;
    }
    const tasks = db.prepare('SELECT * FROM tasks WHERE projectId = ? ORDER BY orderIndex').all(req.params.id);
    const dependencies = db.prepare('SELECT * FROM dependencies WHERE projectId = ?').all(req.params.id);
    const groups = db.prepare('SELECT * FROM task_groups WHERE projectId = ? ORDER BY orderIndex').all(req.params.id);
    const tags = db.prepare('SELECT * FROM tags WHERE projectId = ?').all(req.params.id);
    const snapshots = db.prepare('SELECT id, projectId, name, description, createdAt FROM snapshots WHERE projectId = ? ORDER BY createdAt DESC').all(req.params.id);
    const { tree, flatOrdered } = buildTaskTree(tasks as never);
    res.json({
      success: true,
      data: { project, tasks, taskTree: tree, flatOrdered, dependencies, groups, tags, snapshots }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/', (req: Request, res: Response): void => {
  try {
    const { name, description = '', timezone = 'UTC', startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) {
      res.status(400).json({ success: false, error: '缺少必要字段' });
      return;
    }
    const id = generateId();
    const now = nowISO();
    db.prepare(`
      INSERT INTO projects (id, name, description, timezone, startDate, endDate, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description, timezone, startDate, endDate, now, now);

    const pStart = new Date(startDate);
    const pEnd = new Date(startDate);
    pEnd.setDate(pStart.getDate() + 13);
    const sampleTasks = [
      { name: '项目启动阶段', parentId: null, offset: 0, dur: 3, type: 'summary', color: '#6366f1' },
      { name: '需求调研', parentId: null, offset: 0, dur: 2, type: 'task', color: '#8b5cf6' },
      { name: '需求评审', parentId: null, offset: 2, dur: 1, type: 'milestone', color: '#f59e0b' },
      { name: '设计阶段', parentId: null, offset: 3, dur: 5, type: 'summary', color: '#10b981' },
      { name: 'UI/UX设计', parentId: null, offset: 3, dur: 3, type: 'task', color: '#14b8a6' },
      { name: '技术方案设计', parentId: null, offset: 3, dur: 2, type: 'task', color: '#06b6d4' },
      { name: '开发阶段', parentId: null, offset: 8, dur: 5, type: 'summary', color: '#f59e0b' },
      { name: '前端开发', parentId: null, offset: 8, dur: 5, type: 'task', color: '#3b82f6' },
      { name: '后端开发', parentId: null, offset: 8, dur: 4, type: 'task', color: '#ef4444' },
      { name: '测试上线', parentId: null, offset: 13, dur: 1, type: 'milestone', color: '#10b981' },
    ];
    const insertedIds: string[] = [];
    const stmt = db.prepare(`
      INSERT INTO tasks (id, projectId, parentId, name, description, type, status, startDate, endDate, duration, progress, orderIndex, rowIndex, groupId, tags, color, assignee, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, '', ?, 'not_started', ?, ?, ?, 0, ?, ?, NULL, '[]', ?, NULL, ?, ?)
    `);
    sampleTasks.forEach((st, idx) => {
      const tid = generateId();
      insertedIds.push(tid);
      const sd = new Date(startDate);
      sd.setDate(sd.getDate() + st.offset);
      const ed = new Date(sd);
      ed.setDate(ed.getDate() + st.dur - 1);
      const dur = st.dur;
      stmt.run(tid, id, null, st.name, st.type, sd.toISOString(), ed.toISOString(), dur, idx, idx, st.color, now, now);
    });
    const depStmt = db.prepare(`INSERT INTO dependencies (id, projectId, fromTaskId, toTaskId, type, lag, createdAt) VALUES (?, ?, ?, ?, 'fs', 0, ?)`);
    const pairs: Array<[number, number]> = [[1,2],[2,3],[3,4],[4,5],[4,6],[5,7],[6,8],[7,9],[8,9],[9,10]];
    for (const [a, b] of pairs) {
      depStmt.run(generateId(), id, insertedIds[a - 1], insertedIds[b - 1], now);
    }
    res.json({ success: true, data: { id } });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { name, description, timezone, startDate, endDate } = req.body;
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as Project | undefined;
    if (!existing) {
      res.status(404).json({ success: false, error: '项目不存在' });
      return;
    }
    db.prepare(`
      UPDATE projects SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        timezone = COALESCE(?, timezone),
        startDate = COALESCE(?, startDate),
        endDate = COALESCE(?, endDate),
        updatedAt = ?
      WHERE id = ?
    `).run(name, description, timezone, startDate, endDate, nowISO(), req.params.id);
    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
