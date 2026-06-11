import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';
import { generateId, nowISO } from '../utils.js';
import type { TaskGroup, Tag, Snapshot } from '../types.js';

const router = Router();

router.get('/groups/project/:projectId', (req: Request, res: Response): void => {
  try {
    const rows = db.prepare('SELECT * FROM task_groups WHERE projectId = ? ORDER BY orderIndex').all(req.params.projectId);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/groups', (req: Request, res: Response): void => {
  try {
    const { projectId, name, color = '#8b5cf6' } = req.body as Partial<TaskGroup> & { projectId: string };
    if (!projectId || !name) {
      res.status(400).json({ success: false, error: '缺少必要字段' });
      return;
    }
    const id = generateId();
    const row = db.prepare('SELECT COUNT(*) as c FROM task_groups WHERE projectId = ?').get(projectId) as { c: number };
    db.prepare(`
      INSERT INTO task_groups (id, projectId, name, color, orderIndex, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, projectId, name, color, row.c, nowISO());
    res.json({ success: true, data: { id } });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put('/groups/:id', (req: Request, res: Response): void => {
  try {
    const { name, color, orderIndex } = req.body as Partial<TaskGroup>;
    db.prepare(`
      UPDATE task_groups SET
        name = COALESCE(?, name),
        color = COALESCE(?, color),
        orderIndex = COALESCE(?, orderIndex)
      WHERE id = ?
    `).run(name, color, orderIndex, req.params.id);
    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete('/groups/:id', (req: Request, res: Response): void => {
  try {
    const tx = db.transaction(() => {
      db.prepare('UPDATE tasks SET groupId = NULL WHERE groupId = ?').run(req.params.id);
      db.prepare('DELETE FROM task_groups WHERE id = ?').run(req.params.id);
    });
    tx();
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/tags/project/:projectId', (req: Request, res: Response): void => {
  try {
    const rows = db.prepare('SELECT * FROM tags WHERE projectId = ?').all(req.params.projectId);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/tags', (req: Request, res: Response): void => {
  try {
    const { projectId, name, color = '#10b981' } = req.body as Partial<Tag> & { projectId: string };
    if (!projectId || !name) {
      res.status(400).json({ success: false, error: '缺少必要字段' });
      return;
    }
    const id = generateId();
    db.prepare(`
      INSERT INTO tags (id, projectId, name, color, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, projectId, name, color, nowISO());
    res.json({ success: true, data: { id } });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put('/tags/:id', (req: Request, res: Response): void => {
  try {
    const { name, color } = req.body as Partial<Tag>;
    db.prepare(`
      UPDATE tags SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?
    `).run(name, color, req.params.id);
    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete('/tags/:id', (req: Request, res: Response): void => {
  try {
    db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/snapshots/project/:projectId', (req: Request, res: Response): void => {
  try {
    const rows = db.prepare(
      'SELECT id, projectId, name, description, createdAt FROM snapshots WHERE projectId = ? ORDER BY createdAt DESC'
    ).all(req.params.projectId);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.get('/snapshots/:id', (req: Request, res: Response): void => {
  try {
    const row = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(req.params.id) as Snapshot | undefined;
    if (!row) {
      res.status(404).json({ success: false, error: '快照不存在' });
      return;
    }
    res.json({ success: true, data: { ...row, data: JSON.parse(row.data) } });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/snapshots', (req: Request, res: Response): void => {
  try {
    const { projectId, name, description = '' } = req.body as { projectId: string; name: string; description?: string };
    if (!projectId || !name) {
      res.status(400).json({ success: false, error: '缺少必要字段' });
      return;
    }
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    const tasks = db.prepare('SELECT * FROM tasks WHERE projectId = ?').all(projectId);
    const deps = db.prepare('SELECT * FROM dependencies WHERE projectId = ?').all(projectId);
    const groups = db.prepare('SELECT * FROM task_groups WHERE projectId = ?').all(projectId);
    const tags = db.prepare('SELECT * FROM tags WHERE projectId = ?').all(projectId);

    const snapshotData = JSON.stringify({ project, tasks, dependencies: deps, groups, tags, version: 1 });
    const id = generateId();
    db.prepare(`
      INSERT INTO snapshots (id, projectId, name, description, data, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, projectId, name, description, snapshotData, nowISO());
    res.json({ success: true, data: { id } });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/snapshots/:id/restore', (req: Request, res: Response): void => {
  try {
    const row = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(req.params.id) as Snapshot | undefined;
    if (!row) {
      res.status(404).json({ success: false, error: '快照不存在' });
      return;
    }
    const parsed = JSON.parse(row.data) as {
      project: unknown; tasks: unknown[]; dependencies: unknown[]; groups: unknown[]; tags: unknown[];
    };
    const now = nowISO();
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM dependencies WHERE projectId = ?').run(row.projectId);
      db.prepare('DELETE FROM tasks WHERE projectId = ?').run(row.projectId);
      db.prepare('DELETE FROM task_groups WHERE projectId = ?').run(row.projectId);
      db.prepare('DELETE FROM tags WHERE projectId = ?').run(row.projectId);

      const pFields = parsed.project as Record<string, unknown>;
      db.prepare(`
        UPDATE projects SET
          name = ?, description = ?, timezone = ?, startDate = ?, endDate = ?, updatedAt = ?
        WHERE id = ?
      `).run(pFields.name, pFields.description, pFields.timezone, pFields.startDate, pFields.endDate, now, row.projectId);

      const tIns = db.prepare(`
        INSERT INTO tasks (id, projectId, parentId, name, description, type, status,
          startDate, endDate, duration, progress, orderIndex, rowIndex, groupId, tags, color, assignee,
          createdAt, updatedAt)
        VALUES (@id, @projectId, @parentId, @name, @description, @type, @status,
          @startDate, @endDate, @duration, @progress, @orderIndex, @rowIndex, @groupId, @tags, @color, @assignee,
          @createdAt, @updatedAt)
      `);
      for (const t of parsed.tasks as Record<string, unknown>[]) {
        t.updatedAt = now;
        tIns.run(t);
      }
      const dIns = db.prepare(`
        INSERT INTO dependencies (id, projectId, fromTaskId, toTaskId, type, lag, createdAt)
        VALUES (@id, @projectId, @fromTaskId, @toTaskId, @type, @lag, @createdAt)
      `);
      for (const d of parsed.dependencies as Record<string, unknown>[]) dIns.run(d);
      const gIns = db.prepare(`
        INSERT INTO task_groups (id, projectId, name, color, orderIndex, createdAt)
        VALUES (@id, @projectId, @name, @color, @orderIndex, @createdAt)
      `);
      for (const g of parsed.groups as Record<string, unknown>[]) gIns.run(g);
      const tagIns = db.prepare(`
        INSERT INTO tags (id, projectId, name, color, createdAt)
        VALUES (@id, @projectId, @name, @color, @createdAt)
      `);
      for (const tag of parsed.tags as Record<string, unknown>[]) tagIns.run(tag);
    });
    tx();
    res.json({ success: true, message: '快照恢复成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete('/snapshots/:id', (req: Request, res: Response): void => {
  try {
    db.prepare('DELETE FROM snapshots WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '删除快照成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
