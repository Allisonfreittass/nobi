// Tarefas e checklist de projeto (DESIGN.md 8.1 e 8.2).
import { Task, Goal } from '../models/index.js';

const createdDay = (g) => (g.createdAt ? new Date(g.createdAt).toISOString().slice(0, 10) : null);
export const goalStart = (g) => g.startsAt || createdDay(g);
export const goalDue = (g) => g.dueAt || g.deadline || null;

/** Marcos antigos (goal.milestones) viram tarefas, uma vez. */
export async function migrateMilestones(goal) {
  if (goal.tasksMigrated || !goal.milestones?.length) return false;
  const exists = await Task.exists({ goalId: goal._id });
  if (!exists) {
    await Task.insertMany(goal.milestones.map((m, i) => ({
      userId: goal.ownerId, goalId: goal._id, title: m.title, isMilestone: true, order: i,
      doneAt: m.done ? new Date(`${m.doneAt || createdDay(goal)}T12:00:00Z`) : null, doneDate: m.done ? (m.doneAt || createdDay(goal)) : null,
    })));
  }
  await Goal.updateOne({ _id: goal._id }, { $set: { tasksMigrated: true } });
  return true;
}

export function serializeTask(t, goal) {
  return {
    id: String(t._id),
    goalId: String(t.goalId),
    parentId: t.parentId ? String(t.parentId) : null,
    title: t.title,
    dueDate: t.dueDate || null,
    isMilestone: Boolean(t.isMilestone),
    priorityDate: t.priorityDate || null,
    order: t.order || 0,
    done: Boolean(t.doneAt),
    doneDate: t.doneDate || null,
    goal: goal ? { id: String(goal._id), title: goal.title, color: goal.color, category: goal.category, kind: goal.kind } : undefined,
  };
}

/** Árvore de 2 níveis, já ordenada. Etapa com subetapas conta como feita quando todas estão feitas. */
export function taskTree(tasks) {
  const byOrder = (a, b) => (a.order - b.order) || String(a.createdAt).localeCompare(String(b.createdAt));
  const tops = tasks.filter((t) => !t.parentId).sort(byOrder);
  return tops.map((t) => {
    const children = tasks.filter((c) => String(c.parentId) === String(t._id)).sort(byOrder).map((c) => serializeTask(c));
    const base = serializeTask(t);
    return { ...base, done: children.length ? children.every((c) => c.done) : base.done, children };
  });
}

/** Progresso = itens concluídos / total, contando subetapas (etapa-mãe derivada das filhas). */
export function treeProgress(tree) {
  let total = 0;
  let done = 0;
  for (const t of tree) {
    total += 1 + t.children.length;
    done += (t.done ? 1 : 0) + t.children.filter((c) => c.done).length;
  }
  return { total, done, pct: total ? done / total : 0 };
}

/** Ritmo (DESIGN.md 8.1): onde deveria estar hoje, de 0 a 100. */
export function pacePct(start, due, today) {
  if (!start || !due || due <= start) return null;
  const d = (a, b) => (new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000;
  return Math.max(0, Math.min(100, Math.round((d(start, today) / d(start, due)) * 100)));
}

export function daysLeft(due, today) {
  if (!due) return null;
  return Math.round((new Date(`${due}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86400000);
}
