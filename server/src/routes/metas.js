// Visões da aba Metas (DESIGN.md 8.1): Hoje · Semana · Mês · Concluídas.
import { Router } from 'express';
import { Task, Goal, Checkin } from '../models/index.js';
import { addDays, weekStart, weekday, range } from '../lib/dates.js';
import { userGoals, weekStartsOn } from '../services/progress.js';
import { serializeTask } from '../services/tasks.js';
import { dayTotals, needFor } from '../services/streaks.js';

export const metas = Router();

const isHabit = (g) => g.kind === 'daily' || g.kind === 'count';
const goalBrief = (g) => ({ id: g.id, title: g.title, color: g.color, category: g.category, kind: g.kind });

/** Cumprimento dos hábitos por dia no intervalo: feitos / que contavam. Descanso = nenhum contava. */
function habitDays(goals, checkins, from, to, today) {
  const byGoal = new Map(goals.map((g) => [g.id, []]));
  for (const c of checkins) byGoal.get(String(c.goalId))?.push(c);
  const totals = new Map(goals.map((g) => [g.id, dayTotals(byGoal.get(g.id) || [])]));
  return range(from, to).map((date) => {
    let active = 0; let done = 0;
    for (const g of goals) {
      if (g.createdDay && g.createdDay > date) continue;
      const counts = !g.activeDays?.length || g.activeDays.includes(weekday(date));
      const ok = (totals.get(g.id).get(date) || 0) >= needFor(g);
      if (!counts && !ok) continue;
      active += 1; if (ok) done += 1;
    }
    return { date, weekday: weekday(date), active, done, rest: active === 0, future: date > today };
  });
}

function objectiveCard(g) {
  return {
    ...g, // objetivo completo: o menu ⋯ edita e arquiva a partir daqui
    pct: Math.round(((g.objectivePct ?? (g.kind === 'project' ? g.pct : 0)) || 0) * 100),
    done: g.taskProgress?.done || 0,
    total: g.taskProgress?.total || 0,
    dueAt: g.dueAt,
    pace: g.pace || null,
    nextStep: g.nextMilestone,
  };
}

metas.get('/', async (req, res) => {
  const user = req.user;
  const today = req.today;
  const view = ['hoje', 'semana', 'mes', 'concluidas'].includes(req.query.view) ? req.query.view : 'hoje';
  const goals = await userGoals(user, today);
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const withGoal = (t) => serializeTask(t, goalById.get(String(t.goalId)) && { _id: t.goalId, ...goalById.get(String(t.goalId)) });
  const ids = goals.map((g) => g.id);
  const visible = (t) => goalById.has(String(t.goalId));

  if (view === 'hoje') {
    const [priorities, overdue] = await Promise.all([
      Task.find({ userId: user._id, priorityDate: today }).sort({ createdAt: 1 }).lean(),
      Task.find({ userId: user._id, dueDate: { $lt: today }, doneAt: null, goalId: { $in: ids } }).sort({ dueDate: 1 }).limit(30).lean(),
    ]);
    // Rotina: hábitos (com horário primeiro, por horário)
    const routine = goals
      .filter((g) => g.kind !== 'project' && !g.shared?.tasks?.length)
      .sort((a, b) => (a.scheduleTime || '99:99').localeCompare(b.scheduleTime || '99:99') || a.title.localeCompare(b.title));
    const objectives = goals.filter((g) => g.kind === 'project' || (g.dueAt && g.taskProgress?.total)).map(objectiveCard);
    // Tarefas abertas de hoje que podem virar prioridade
    const candidates = await Task.find({ userId: user._id, doneAt: null, priorityDate: { $ne: today }, goalId: { $in: ids }, $or: [{ dueDate: { $lte: addDays(today, 7) } }, { dueDate: null }] }).sort({ dueDate: 1, order: 1 }).limit(40).lean();
    return res.json({
      view, today,
      priorities: priorities.filter(visible).map(withGoal),
      routine,
      overdue: overdue.map(withGoal),
      objectives,
      candidates: candidates.map(withGoal),
    });
  }

  const habits = goals.filter(isHabit).map((g) => ({ ...g, createdDay: g.createdAt ? new Date(g.createdAt).toISOString().slice(0, 10) : null }));

  if (view === 'semana') {
    const ws = weekStart(today, weekStartsOn(user));
    const we = addDays(ws, 6);
    const [checkins, weekTasks] = await Promise.all([
      Checkin.find({ userId: user._id, goalId: { $in: habits.map((g) => g.id) }, date: { $gte: ws, $lte: we } }).lean(),
      Task.find({ userId: user._id, goalId: { $in: ids }, $or: [{ dueDate: { $gte: ws, $lte: we } }, { doneDate: { $gte: ws, $lte: we } }] }).sort({ dueDate: 1 }).lean(),
    ]);
    const days = habitDays(habits, checkins, ws, we, today);
    const past = days.filter((d) => !d.future);
    const groups = new Map();
    for (const t of weekTasks) {
      const k = String(t.goalId);
      if (!groups.has(k)) groups.set(k, { goal: goalBrief(goalById.get(k)), tasks: [] });
      groups.get(k).tasks.push(withGoal(t));
    }
    const weekly = goals.filter((g) => g.kind === 'weekly').map((g) => ({ ...goalBrief(g), value: g.status.weekValue, need: g.status.need }));
    return res.json({
      view, today, start: ws, end: we,
      habits: { done: past.reduce((s, d) => s + d.done, 0), total: past.reduce((s, d) => s + d.active, 0), days },
      weekly,
      taskGroups: [...groups.values()],
    });
  }

  if (view === 'mes') {
    const ms = `${today.slice(0, 7)}-01`;
    const me = addDays(`${addDays(ms, 32).slice(0, 7)}-01`, -1);
    const [checkins, doneTasks, dueTasks] = await Promise.all([
      Checkin.find({ userId: user._id, goalId: { $in: habits.map((g) => g.id) }, date: { $gte: ms, $lte: today } }).lean(),
      Task.find({ userId: user._id, goalId: { $in: ids }, doneDate: { $gte: ms, $lte: me } }).lean(),
      Task.find({ userId: user._id, goalId: { $in: ids }, doneAt: null, dueDate: { $gte: today, $lte: me } }).sort({ dueDate: 1 }).lean(),
    ]);
    const days = habitDays(habits, checkins, ms, today, today);
    const total = days.reduce((s, d) => s + d.active, 0);
    const done = days.reduce((s, d) => s + d.done, 0);
    return res.json({
      view, today, start: ms, end: me,
      habitsPct: total ? Math.round((done / total) * 100) : null,
      habitsDone: done, habitsTotal: total,
      tasksDone: doneTasks.length,
      milestones: doneTasks.filter((t) => t.isMilestone).map(withGoal),
      dueThisMonth: dueTasks.map(withGoal),
      objectives: goals.filter((g) => g.kind === 'project' || (g.dueAt && g.taskProgress?.total)).map(objectiveCard),
    });
  }

  // Concluídas: últimos 30 dias
  const from = addDays(today, -29);
  const [doneTasks, checkinCount] = await Promise.all([
    Task.find({ userId: user._id, doneDate: { $gte: from, $lte: today } }).sort({ doneAt: -1 }).limit(200).lean(),
    Checkin.countDocuments({ userId: user._id, date: { $gte: from, $lte: today } }),
  ]);
  const archived = await Goal.find({ _id: { $in: doneTasks.map((t) => t.goalId) } }, { title: 1, color: 1, category: 1, kind: 1 }).lean();
  const anyGoal = new Map(archived.map((g) => [String(g._id), g]));
  const byDate = new Map();
  for (const t of doneTasks) {
    if (!byDate.has(t.doneDate)) byDate.set(t.doneDate, []);
    byDate.get(t.doneDate).push(serializeTask(t, anyGoal.get(String(t.goalId))));
  }
  return res.json({ view, today, from, checkins: checkinCount, days: [...byDate.entries()].map(([date, tasks]) => ({ date, tasks })) });
});
