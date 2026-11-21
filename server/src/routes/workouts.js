import { Router } from 'express';
import { WorkoutPlan, WorkoutSession, Goal } from '../models/index.js';
import { bad, notFound } from '../lib/http.js';
import { isDateStr } from '../lib/dates.js';
import {
  planProgress, nextDay, lastSets, planSummary, exerciseHistory, exerciseSummary, sessionVolume,
  parseDays, parseLoggedExercises, exerciseSlug,
} from '../services/workouts.js';

export const workouts = Router();

const MAX_ACTIVE = 10;

function sessionView(s) {
  return {
    id: String(s._id), date: s.date, dayKey: s.dayKey, dayName: s.dayName, minutes: s.minutes, note: s.note,
    exercises: s.exercises.map((e) => ({ key: e.key, name: e.name, sets: e.sets.map((x) => ({ reps: x.reps, load: x.load, done: x.done })) })),
    volume: Math.round(sessionVolume(s)),
  };
}

function planView(plan, sessions, today, goal) {
  const progress = planProgress(plan, sessions);
  const todaySession = sessions.find((s) => s.date === today);
  return {
    id: String(plan._id),
    name: plan.name,
    totalSessions: plan.totalSessions,
    dueAt: plan.dueAt,
    startedAt: plan.startedAt,
    completedAt: plan.completedAt,
    archivedAt: plan.archivedAt,
    days: plan.days,
    goal: goal ? { id: String(goal._id), title: goal.title, color: goal.color } : null,
    progress,
    next: todaySession ? plan.days.find((d) => d.key === todaySession.dayKey) || null : nextDay(plan, sessions),
    todaySessionId: todaySession ? String(todaySession._id) : null,
    lastDate: sessions.map((s) => s.date).sort().at(-1) || null,
  };
}

/** Objetivo que pode receber o check-in do treino: da pessoa, ativo, sem checklist e que não é projeto. */
async function checkGoal(goalId, userId) {
  if (!goalId) return null;
  const g = await Goal.findOne({ _id: goalId, archivedAt: null, $or: [{ ownerId: userId, shared: null }, { 'shared.participants': userId }] }).lean();
  if (!g || g.kind === 'project' || g.shared?.tasks?.length) throw bad('Escolha um objetivo de treino válido.');
  return g;
}

async function loadPlan(id, userId) {
  const p = await WorkoutPlan.findOne({ _id: id, userId });
  if (!p) throw notFound('Treino não encontrado.');
  return p;
}

function readPlanBody(b, { partial = false } = {}) {
  const out = {};
  if (!partial || b.name !== undefined) {
    out.name = String(b.name || '').trim().slice(0, 60);
    if (!out.name) throw bad('Dê um nome ao treino.');
  }
  if (!partial || b.totalSessions !== undefined) {
    const n = Math.round(Number(b.totalSessions));
    if (!Number.isFinite(n) || n < 1 || n > 365) throw bad('O treino dura de 1 a 365 treinos.');
    out.totalSessions = n;
  }
  if (!partial || b.days !== undefined) {
    const days = parseDays(b.days);
    if (!days?.length) throw bad('Crie pelo menos uma divisão (ex.: Treino A).');
    if (!days.some((d) => d.exercises.length)) throw bad('Adicione pelo menos um exercício.');
    out.days = days;
  }
  if (b.dueAt !== undefined) out.dueAt = isDateStr(b.dueAt) ? b.dueAt : null;
  return out;
}

// Ativos (incluindo os que já bateram o total e esperam ser arquivados)
workouts.get('/', async (req, res) => {
  const plans = await WorkoutPlan.find({ userId: req.user._id, archivedAt: null }).sort({ createdAt: -1 }).lean();
  const [sessions, goals] = await Promise.all([
    WorkoutSession.find({ planId: { $in: plans.map((p) => p._id) } }, { planId: 1, date: 1, dayKey: 1 }).lean(),
    Goal.find({ _id: { $in: plans.map((p) => p.goalId).filter(Boolean) }, archivedAt: null }, { title: 1, color: 1 }).lean(),
  ]);
  const gBy = new Map(goals.map((g) => [String(g._id), g]));
  res.json(plans.map((p) => planView(p, sessions.filter((s) => String(s.planId) === String(p._id)), req.today, gBy.get(String(p.goalId)))));
});

// Histórico: todos os programas (arquivados e ativos) com o resumo de cada um, base da comparação.
// O app mostra os arquivados na lista e deixa comparar com os ativos também.
workouts.get('/historico', async (req, res) => {
  const plans = await WorkoutPlan.find({ userId: req.user._id }).sort({ archivedAt: -1, createdAt: -1 }).lean();
  const sessions = await WorkoutSession.find({ planId: { $in: plans.map((p) => p._id) } }).lean();
  res.json(plans.map((p) => {
    const mine = sessions.filter((s) => String(s.planId) === String(p._id));
    return { ...planView(p, mine, req.today, null), summary: planSummary(p, mine) };
  }));
});

// Exercícios já registrados, de todos os programas: para escolher qual evolução ver
workouts.get('/exercicios', async (req, res) => {
  const sessions = await WorkoutSession.find({ userId: req.user._id }).lean();
  res.json(exerciseSummary(sessions).map(({ slug, name, sessions: n, bestLoad, lastLoad, firstLoad, lastDate }) => ({ slug, name, sessions: n, bestLoad, lastLoad, firstLoad, lastDate })));
});

workouts.get('/exercicios/:slug', async (req, res) => {
  const slug = exerciseSlug(req.params.slug);
  const [sessions, plans] = await Promise.all([
    WorkoutSession.find({ userId: req.user._id }).lean(),
    WorkoutPlan.find({ userId: req.user._id }, { name: 1 }).lean(),
  ]);
  const points = exerciseHistory(slug, sessions, new Map(plans.map((p) => [String(p._id), p])));
  if (!points.length) throw notFound('Exercício sem registros.');
  const name = sessions.flatMap((s) => s.exercises).filter((e) => exerciseSlug(e.name) === slug).at(-1)?.name || slug;
  res.json({ slug, name, points });
});

workouts.post('/', async (req, res) => {
  const b = req.body || {};
  const fields = readPlanBody(b);
  if (await WorkoutPlan.countDocuments({ userId: req.user._id, archivedAt: null }) >= MAX_ACTIVE) {
    throw bad(`Você já tem ${MAX_ACTIVE} treinos ativos. Arquive um para criar outro.`);
  }
  const goal = await checkGoal(b.goalId, req.user._id);
  const p = await WorkoutPlan.create({ ...fields, userId: req.user._id, goalId: goal?._id || null, startedAt: req.today });
  res.status(201).json(planView(p.toObject(), [], req.today, goal));
});

workouts.get('/:id', async (req, res) => {
  const p = await loadPlan(req.params.id, req.user._id);
  const sessions = await WorkoutSession.find({ planId: p._id }).sort({ date: -1 }).lean();
  const goal = p.goalId ? await Goal.findOne({ _id: p.goalId, archivedAt: null }, { title: 1, color: 1 }).lean() : null;
  res.json({
    ...planView(p.toObject(), sessions, req.today, goal),
    sessions: sessions.map(sessionView),
    last: lastSets(sessions),
    summary: planSummary(p, sessions),
  });
});

workouts.patch('/:id', async (req, res) => {
  const p = await loadPlan(req.params.id, req.user._id);
  const b = req.body || {};
  Object.assign(p, readPlanBody(b, { partial: true }));
  let goal = null;
  if (b.goalId !== undefined) {
    goal = await checkGoal(b.goalId, req.user._id);
    p.goalId = goal?._id || null;
  } else if (p.goalId) {
    goal = await Goal.findOne({ _id: p.goalId, archivedAt: null }, { title: 1, color: 1 }).lean();
  }
  const sessions = await WorkoutSession.find({ planId: p._id }, { date: 1, dayKey: 1 }).lean();
  // Aumentar o total "reabre" o programa
  p.completedAt = sessions.length >= p.totalSessions ? (p.completedAt || req.today) : null;
  await p.save();
  res.json(planView(p.toObject(), sessions, req.today, goal));
});

workouts.post('/:id/arquivar', async (req, res) => {
  const p = await loadPlan(req.params.id, req.user._id);
  if (!p.archivedAt) { p.archivedAt = new Date(); await p.save(); }
  res.json({ ok: true });
});

workouts.post('/:id/restaurar', async (req, res) => {
  const p = await loadPlan(req.params.id, req.user._id);
  if (await WorkoutPlan.countDocuments({ userId: req.user._id, archivedAt: null }) >= MAX_ACTIVE) {
    throw bad(`Você já tem ${MAX_ACTIVE} treinos ativos. Arquive um antes.`);
  }
  p.archivedAt = null;
  await p.save();
  res.json({ ok: true });
});

// Exclui de vez o programa e as sessões dele. Os check-ins no objetivo ficam (são do objetivo).
workouts.delete('/:id', async (req, res) => {
  const p = await loadPlan(req.params.id, req.user._id);
  await WorkoutSession.deleteMany({ planId: p._id });
  await WorkoutPlan.deleteOne({ _id: p._id });
  res.json({ ok: true });
});

/**
 * Salva o treino de hoje. Uma sessão por dia: salvar de novo atualiza. A resposta diz se é a primeira
 * vez hoje (`firstToday`), para o app fazer o check-in no objetivo ligado só uma vez.
 */
workouts.post('/:id/sessoes', async (req, res) => {
  const p = await loadPlan(req.params.id, req.user._id);
  if (p.archivedAt) throw bad('Este treino está arquivado. Restaure para registrar.');
  const b = req.body || {};
  const day = p.days.find((d) => d.key === b.dayKey) || p.days[0];
  const exercises = parseLoggedExercises(b.exercises);
  if (!exercises.some((e) => e.sets.some((s) => s.done && s.reps > 0))) throw bad('Marque pelo menos uma série feita.');
  const minutes = Math.min(600, Math.max(0, Math.round(Number(b.minutes) || 0)));
  const existed = await WorkoutSession.exists({ planId: p._id, date: req.today });
  const s = await WorkoutSession.findOneAndUpdate(
    { planId: p._id, date: req.today },
    { $set: { userId: req.user._id, dayKey: day?.key || '', dayName: day?.name || '', exercises, minutes, note: String(b.note || '').slice(0, 280) } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();
  const sessions = await WorkoutSession.find({ planId: p._id }, { date: 1, dayKey: 1 }).lean();
  const finishedNow = !p.completedAt && sessions.length >= p.totalSessions;
  if (finishedNow) { p.completedAt = req.today; await p.save(); }
  const goal = p.goalId ? await Goal.findOne({ _id: p.goalId, archivedAt: null }, { title: 1, color: 1 }).lean() : null;
  res.status(existed ? 200 : 201).json({
    session: sessionView(s),
    plan: planView(p.toObject(), sessions, req.today, goal),
    firstToday: !existed,
    finishedNow,
  });
});

workouts.delete('/:id/sessoes/:sid', async (req, res) => {
  const p = await loadPlan(req.params.id, req.user._id);
  const r = await WorkoutSession.deleteOne({ _id: req.params.sid, planId: p._id });
  if (!r.deletedCount) throw notFound('Sessão não encontrada.');
  const sessions = await WorkoutSession.find({ planId: p._id }, { date: 1, dayKey: 1 }).lean();
  if (p.completedAt && sessions.length < p.totalSessions) { p.completedAt = null; await p.save(); }
  res.json({ ok: true });
});
