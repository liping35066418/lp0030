import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';
import {
  generateId, nowISO, addDays, calcDuration,
  detectCycle, computeTaskDatesByDeps,
  validateTaskTimeChange, buildTaskTree,
  aggregateParentProgress,
} from '../utils.js';
import type { Task, Dependency } from '../types.js';

const router = Router();

router.get('/project/:projectId', (req: Request, res: Response): void => {
  try {
    const { projectId } = req.params;
    const tasks = db.prepare('SELECT * FROM tasks WHERE projectId = ? ORDER BY orderIndex').all(projectId) as Task[];
    const dependencies = db.prepare('SELECT * FROM dependencies WHERE projectId = ?').all(projectId) as Dependency[];
    const { tree, flatOrdered } = buildTaskTree(tasks as never);
    res.json({ success: true, data: { tasks, taskTree: tree, flatOrdered, dependencies } });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/', (req: Request, res: Response): void => {
  try {
    const body = req.body as Partial<Task> & { projectId: string; afterId?: string };
    const {
      projectId, parentId = null, name, description = '',
      type = 'task', status = 'not_started',
      startDate, endDate,
      progress = 0, groupId = null, tags = '[]',
      color = '#3b82f6', assignee = null, afterId,
    } = body;

    if (!projectId || !name || !startDate || !endDate) {
      res.status(400).json({ success: false, error: '缺少必要字段' });
      return;
    }

    const duration = calcDuration(startDate, endDate);
    const now = nowISO();
    const id = generateId();

    const siblings = db.prepare(
      'SELECT * FROM tasks WHERE projectId = ? AND parentId IS ? ORDER BY orderIndex'
    ).all(projectId, parentId ?? null) as Task[];

    let insertOrder = siblings.length;
    let updatedPairs: Array<[number, string]> = [];
    if (afterId) {
      const after = siblings.find(s => s.id === afterId);
      if (after) {
        insertOrder = after.orderIndex + 1;
        updatedPairs = siblings
          .filter(s => s.orderIndex >= insertOrder)
          .map(s => [s.orderIndex + 1, s.id]);
      }
    }

    const tx = db.transaction(() => {
      for (const [o, sid] of updatedPairs) {
        db.prepare('UPDATE tasks SET orderIndex = ?, updatedAt = ? WHERE id = ?').run(o, now, sid);
      }
      const rowIdx = db.prepare('SELECT COUNT(*) as c FROM tasks WHERE projectId = ?').get(projectId) as { c: number };
      db.prepare(`
        INSERT INTO tasks (id, projectId, parentId, name, description, type, status,
          startDate, endDate, duration, progress, orderIndex, rowIndex, groupId, tags, color, assignee,
          createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, projectId, parentId, name, description, type, status, startDate, endDate, duration, progress,
        insertOrder, rowIdx.c, groupId, tags, color, assignee, now, now);
    });
    tx();

    res.json({ success: true, data: { id } });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
    if (!existing) {
      res.status(404).json({ success: false, error: '任务不存在' });
      return;
    }

    const body = req.body as Partial<Task> & { cascade?: boolean };
    const {
      name, description, type, status,
      startDate, endDate, progress,
      parentId, groupId, tags, color, assignee, orderIndex, rowIndex,
      cascade = true,
    } = body;

    let finalStart = startDate ?? existing.startDate;
    let finalEnd = endDate ?? existing.endDate;
    let finalDuration = existing.duration;

    if (startDate || endDate) {
      const allTasks = db.prepare('SELECT * FROM tasks WHERE projectId = ?').all(existing.projectId) as Task[];
      const deps = db.prepare('SELECT * FROM dependencies WHERE projectId = ?').all(existing.projectId) as Dependency[];

      if (startDate && !endDate) {
        const dur = existing.duration;
        finalEnd = addDays(startDate, dur - 1);
      } else if (!startDate && endDate) {
        const dur = calcDuration(existing.startDate, endDate);
        finalDuration = dur;
      } else if (startDate && endDate) {
        finalDuration = calcDuration(startDate, endDate);
      } else {
        finalDuration = existing.duration;
      }

      const validation = validateTaskTimeChange(
        { ...existing, startDate: finalStart, endDate: finalEnd },
        finalStart, finalEnd, allTasks, deps
      );
      if (!validation.valid) {
        res.status(400).json({ success: false, error: validation.errors.join('；') });
        return;
      }
      finalDuration = calcDuration(finalStart, finalEnd);
    }

    const now = nowISO();
    const finalProgress = progress ?? existing.progress;

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE tasks SET
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          type = COALESCE(?, type),
          status = COALESCE(?, status),
          startDate = ?,
          endDate = ?,
          duration = ?,
          progress = ?,
          parentId = COALESCE(?, parentId),
          orderIndex = COALESCE(?, orderIndex),
          rowIndex = COALESCE(?, rowIndex),
          groupId = COALESCE(?, groupId),
          tags = COALESCE(?, tags),
          color = COALESCE(?, color),
          assignee = COALESCE(?, assignee),
          updatedAt = ?
        WHERE id = ?
      `).run(name, description, type, status, finalStart, finalEnd, finalDuration, finalProgress,
        parentId, orderIndex, rowIndex, groupId, tags, color, assignee, now, id);

      if (cascade && (startDate || endDate || progress !== undefined)) {
        const allTasks = db.prepare('SELECT * FROM tasks WHERE projectId = ?').all(existing.projectId) as Task[];
        const deps = db.prepare('SELECT * FROM dependencies WHERE projectId = ?').all(existing.projectId) as Dependency[];
        const currentMap = new Map<string, Task>();
        const updatedTasks = allTasks.map(t => t.id === id
          ? { ...t, startDate: finalStart, endDate: finalEnd, duration: finalDuration, progress: finalProgress }
          : t);
        for (const t of updatedTasks) currentMap.set(t.id, t);

        const queue: string[] = deps.filter(d => d.fromTaskId === id).map(d => d.toTaskId);
        const visited = new Set<string>([id]);
        while (queue.length > 0) {
          const tid = queue.shift()!;
          if (visited.has(tid)) continue;
          visited.add(tid);
          const t = currentMap.get(tid);
          if (!t) continue;
          const computed = computeTaskDatesByDeps(t, Array.from(currentMap.values()), deps);
          if (computed) {
            const dur = calcDuration(computed.startDate, computed.endDate);
            currentMap.set(tid, { ...t, ...computed, duration: dur, updatedAt: now });
          }
          for (const od of deps.filter(d => d.fromTaskId === tid)) {
            if (!visited.has(od.toTaskId)) queue.push(od.toTaskId);
          }
        }

        const ancestors: string[] = [];
        let cur: string | null = existing.parentId;
        while (cur) {
          ancestors.push(cur);
          const t = currentMap.get(cur);
          cur = t?.parentId ?? null;
        }
        for (const aid of ancestors) {
          const at = currentMap.get(aid);
          if (!at) continue;
          const children = Array.from(currentMap.values()).filter(x => x.parentId === aid);
          if (children.length > 0) {
            const sorted = children.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
            const newStart = sorted[0].startDate;
            const sortedEnd = [...children].sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
            const newEnd = sortedEnd[0].endDate;
            const newDur = calcDuration(newStart, newEnd);
            const newProg = aggregateParentProgress(at, Array.from(currentMap.values()));
            currentMap.set(aid, { ...at, startDate: newStart, endDate: newEnd, duration: newDur, progress: newProg, updatedAt: now });
          }
        }

        const upStmt = db.prepare(`
          UPDATE tasks SET startDate = ?, endDate = ?, duration = ?, progress = ?, updatedAt = ? WHERE id = ?
        `);
        for (const [tid, t] of currentMap.entries()) {
          if (tid === id) continue;
          const orig = allTasks.find(x => x.id === tid);
          if (!orig) continue;
          if (orig.startDate !== t.startDate || orig.endDate !== t.endDate || orig.duration !== t.duration || orig.progress !== t.progress) {
            upStmt.run(t.startDate, t.endDate, t.duration, t.progress, t.updatedAt, tid);
          }
        }
      }
    });
    tx();

    res.json({ success: true, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/batch-update', (req: Request, res: Response): void => {
  try {
    const { updates } = req.body as { updates: Array<{ id: string; fields: Partial<Task> }> };
    if (!updates || updates.length === 0) {
      res.json({ success: true, message: '无更新' });
      return;
    }
    const now = nowISO();
    const tx = db.transaction(() => {
      for (const u of updates) {
        const { id, fields } = u;
        const keys = Object.keys(fields);
        if (keys.length === 0) continue;
        const sets = keys.map(k => `${k} = ?`).join(', ');
        const vals = keys.map(k => (fields as Record<string, unknown>)[k]);
        db.prepare(`UPDATE tasks SET ${sets}, updatedAt = ? WHERE id = ?`).run(...vals, now, id);
      }
    });
    tx();
    res.json({ success: true, message: '批量更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/reorder', (req: Request, res: Response): void => {
  try {
    const { projectId, parentId = null, order } = req.body as { projectId: string; parentId?: string | null; order: string[] };
    const now = nowISO();
    const tx = db.transaction(() => {
      order.forEach((id, idx) => {
        db.prepare('UPDATE tasks SET orderIndex = ?, parentId = COALESCE(?, parentId), updatedAt = ? WHERE id = ?')
          .run(idx, parentId, now, id);
      });
    });
    tx();
    res.json({ success: true, message: '重排成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/dependencies', (req: Request, res: Response): void => {
  try {
    const body = req.body as Partial<Dependency> & { projectId: string };
    const { projectId, fromTaskId, toTaskId, type = 'fs', lag = 0 } = body;
    if (!projectId || !fromTaskId || !toTaskId) {
      res.status(400).json({ success: false, error: '缺少必要字段' });
      return;
    }
    if (fromTaskId === toTaskId) {
      res.status(400).json({ success: false, error: '不能自引用' });
      return;
    }
    const deps = db.prepare('SELECT fromTaskId, toTaskId FROM dependencies WHERE projectId = ?').all(projectId) as Dependency[];
    const exists = deps.some(d => d.fromTaskId === fromTaskId && d.toTaskId === toTaskId);
    if (exists) {
      res.status(400).json({ success: false, error: '依赖已存在' });
      return;
    }
    if (detectCycle(deps, fromTaskId, toTaskId)) {
      res.status(400).json({ success: false, error: '检测到循环依赖，禁止创建' });
      return;
    }
    const id = generateId();
    db.prepare(`
      INSERT INTO dependencies (id, projectId, fromTaskId, toTaskId, type, lag, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, fromTaskId, toTaskId, type, lag, nowISO());
    res.json({ success: true, data: { id } });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete('/dependencies/:id', (req: Request, res: Response): void => {
  try {
    db.prepare('DELETE FROM dependencies WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: '删除依赖成功' });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.post('/validate-change', (req: Request, res: Response): void => {
  try {
    const { id, startDate, endDate } = req.body as { id: string; startDate: string; endDate: string };
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
    if (!task) {
      res.status(404).json({ success: false, error: '任务不存在' });
      return;
    }
    const allTasks = db.prepare('SELECT * FROM tasks WHERE projectId = ?').all(task.projectId) as Task[];
    const deps = db.prepare('SELECT * FROM dependencies WHERE projectId = ?').all(task.projectId) as Dependency[];
    const result = validateTaskTimeChange(task, startDate, endDate, allTasks, deps);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;
