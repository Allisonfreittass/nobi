import { Router } from 'express';
import { Task, Goal, Checkin, User } from '../models/index.js';
import { bad, notFound } from '../lib/http.js';
import { isDateStr } from '../lib/dates.js';
import { serializeTask, taskTree, treeProgress } from '../services/tasks.js';
import { refreshStreakCache, weekStartsOn, goalView } from '../services/progress.js';
import { award, grantXp } from '../services/achievements.js';
import { XP } from '../services/level.js';

export const tasks = Router();

const MAX_PRIORITIES = 3;
const isMember = (g, uid) => String(g.ownerId) === String(uid) || g.shared?.participants?.some((p) => String(p) === String(uid));

async function loadGoal(id, user) {
  const g = await Goal.findById(id);
  if (!g || g.archivedAt || !isMember(g, user._id)) throw notFound('Objetivo não encontrado.');
  return g;
}
async function loadTask(id, user) {
  const t = await Task.findOne({ _id: id, userId: user._id });
  if (!t) throw notFound('Tarefa não encontrada.');
  return t;
}

// Criar etapa / subetapa / item: no máximo 2 níveis (DESIGN.md 8.2)
tasks.post('/goal/:goalId', async (req, res) => {
  const g = await loadGoal(req.params.goalId, req.user);
  const b = req.body || {};
  const title = String(b.title || '').trim();
  if (!title) throw bad('Dê um nome à etapa.');
  let parentId = null;
  if (b.parentId) {
    const parent = await Task.findOne({ _id: b.parentId, goalId: g._id, userId: req.user._id });
    if (!parent) throw notFound('Etapa não encontrada.');
    if (parent.parentId) throw bad('Subetapa não pode ter subetapa. Dois níveis no máximo.');
    parentId = parent._id;
  }
  const last = await Task.findOne({ goalId: g._id, userId: req.user._id, parentId }).sort({ order: -1 }).lean();
  let priorityDate = null;
  if (b.priority) {
    const n = await Task.countDocuments({ userId: req.user._id, priorityDate: req.today });
    if (n >= MAX_PRIORITIES) throw bad('Você já tem 3 prioridades hoje.');
    priorityDate = req.today;
  }
  const t = await Task.create({
    userId: req.user._id, goalId: g._id, parentId, title: title.slice(0, 120), order: (last?.order ?? -1) + 1,
    isMilestone: Boolean(b.isMilestone) && !parentId, dueDate: isDateStr(b.dueDate) ? b.dueDate : (b.priority ? req.today : null), priorityDate,
  });
  res.status(201).json(serializeTask(t.toObject(), g));
});

tasks.patch('/:id', async (req, res) => {
  const t = await loadTask(req.params.id, req.user);
  const g = await Goal.findById(t.goalId);
  const b = req.body || {};
  let celebration = null;
  const earned = [];
  if (b.title !== undefined) {
    if (!String(b.title).trim()) throw bad('Dê um nome à etapa.');
    t.title = String(b.title).trim().slice(0, 120);
  }
  if (b.dueDate !== undefined) t.dueDate = isDateStr(b.dueDate) ? b.dueDate : null;
  if (b.isMilestone !== undefined && !t.parentId) t.isMilestone = Boolean(b.isMilestone);
  if (b.priority !== undefined) {
    if (b.priority) {
      const n = await Task.countDocuments({ userId: req.user._id, priorityDate: req.today, _id: { $ne: t._id } });
      if (n >= MAX_PRIORITIES) throw bad('Você já tem 3 prioridades hoje. Conclua ou tire uma antes.');
      t.priorityDate = req.today;
      if (!t.dueDate || t.dueDate < req.today) t.dueDate = req.today;
    } else t.priorityDate = null;
  }
  const wasDone = Boolean(t.doneAt);
  if (b.done !== undefined) {
    t.doneAt = b.done ? (t.doneAt || new Date()) : null;
    t.doneDate = b.done ? (t.doneDate || req.today) : null;
  }
  await t.save();

  if (!wasDone && t.doneAt && g) {
    await grantXp(req.user._id, `task:${t._id}`, t.isMilestone ? XP.milestone : XP.checkin);
    // Avançar no projeto conta para a sequência do projeto ("dias em que avançou")
    if (g.kind === 'project') {
      await Checkin.updateOne({ goalId: g._id, userId: req.user._id, date: req.today, taskKey: '' }, { $setOnInsert: { value: 1 } }, { upsert: true });
      await refreshStreakCache(g, req.user._id, req.today, weekStartsOn(req.user));
    }
    const all = await Task.find({ goalId: g._id, userId: req.user._id }).lean();
    const prog = treeProgress(taskTree(all));
    const finished = g.kind === 'project' && prog.total > 0 && prog.done === prog.total;
    // Marco concluído: a própria tarefa, ou a etapa-mãe quando a última subetapa fecha
    let milestone = t.isMilestone ? t : null;
    if (!milestone && t.parentId) {
      const parent = all.find((x) => String(x._id) === String(t.parentId));
      const siblings = all.filter((x) => String(x.parentId) === String(t.parentId));
      if (parent?.isMilestone && siblings.every((x) => x.doneAt)) milestone = parent;
    }
    if (milestone) {
      const a = await award(req.user._id, 'marco');
      if (a) earned.push(a);
      await grantXp(req.user._id, `milestone:${milestone._id}`, XP.milestone);
      celebration = { kind: 'milestone', title: milestone.title, goalId: String(g._id), goalTitle: g.title, category: g.category, finished, taskId: String(milestone._id) };
    }
    if (finished) {
      const a = await award(req.user._id, 'projeto-concluido');
      if (a) earned.push(a);
      if (!celebration) celebration = { kind: 'milestone', title: 'Todas as etapas', goalId: String(g._id), goalTitle: g.title, category: g.category, finished: true, taskId: String(t._id) };
    }
  }
  const fresh = await User.findById(req.user._id);
  res.json({
    task: serializeTask(t.toObject(), g),
    goal: g ? await goalView(g.toObject(), fresh, req.today) : null,
    celebration,
    achievements: earned,
  });
});

tasks.delete('/:id', async (req, res) => {
  const t = await loadTask(req.params.id, req.user);
  await Task.deleteMany({ $or: [{ _id: t._id }, { parentId: t._id }] });
  res.json({ ok: true });
});

// Reordenar irmãos (mesma etapa-mãe): ids na nova ordem
tasks.post('/reorder', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, 200) : [];
  const list = await Task.find({ _id: { $in: ids }, userId: req.user._id }).lean();
  if (list.length !== ids.length) throw bad('Lista inválida.');
  const parents = new Set(list.map((t) => String(t.parentId || '')));
  const goalsSet = new Set(list.map((t) => String(t.goalId)));
  if (parents.size > 1 || goalsSet.size > 1) throw bad('Só dá para reordenar dentro da mesma etapa.');
  await Task.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: i } } } })));
  res.json({ ok: true });
});
