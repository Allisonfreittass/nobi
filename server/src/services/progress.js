// Monta o que as telas mostram sobre objetivos, sequências e estatísticas. Tudo calculado no servidor.
import { Goal, Checkin, Post, Streak, User } from '../models/index.js';
import { computeStreak, computeGroupStreak, todayStatus, streakInDays, needFor } from './streaks.js';
import { stageFromLevel } from './level.js';
import { publicUser } from './social.js';
import { addDays, range, weekStart, weekday, diffDays } from '../lib/dates.js';

export const weekStartsOn = (user) => (user?.prefs?.weekStart === 'sun' ? 0 : 1);

export const goalsQuery = (userId) => ({
  archivedAt: null,
  $or: [{ ownerId: userId, shared: null }, { 'shared.participants': userId }],
});

const createdDay = (goal) => (goal.createdAt ? new Date(goal.createdAt).toISOString().slice(0, 10) : null);

function groupByUser(checkins) {
  const m = new Map();
  for (const c of checkins) {
    const k = String(c.userId);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(c);
  }
  return m;
}

/** Pontos da semana (segunda a domingo; zera no domingo à noite). */
export function weeklyPoints(goal, checkins, today) {
  const ws = weekStart(today, 1);
  const we = addDays(ws, 6);
  const pts = new Map();
  const taskPts = Object.fromEntries((goal.shared?.tasks || []).map((t) => [t.key, t.pts]));
  for (const c of checkins) {
    if (c.date < ws || c.date > we) continue;
    const p = c.taskKey ? taskPts[c.taskKey] || 0 : 10;
    pts.set(String(c.userId), (pts.get(String(c.userId)) || 0) + p);
  }
  return pts;
}

async function sharedView(goal, userId, today, wso, all) {
  const byUser = groupByUser(all);
  const members = await User.find({ _id: { $in: goal.shared.participants } }).lean();
  const need = needFor(goal);
  const participants = members.map((m) => {
    const mine = byUser.get(String(m._id)) || [];
    const st = todayStatus(goal, mine, today, wso);
    return { ...publicUser(m), doneToday: st.doneToday, todayValue: st.todayValue, weekValue: st.weekValue };
  });
  const out = {
    mode: goal.shared.mode,
    participants,
    invitedCount: goal.shared.invited?.length || 0,
    startsAt: goal.shared.startsAt || null,
    endsAt: goal.shared.endsAt || null,
    tasks: goal.shared.tasks || [],
    doneTodayCount: participants.filter((p) => p.doneToday).length,
    need,
  };
  if (goal.shared.endsAt && goal.shared.startsAt) {
    out.totalDays = diffDays(goal.shared.startsAt, goal.shared.endsAt) + 1;
    out.day = Math.min(out.totalDays, Math.max(1, diffDays(goal.shared.startsAt, today) + 1));
    out.daysLeft = Math.max(0, diffDays(today, goal.shared.endsAt));
    out.ended = today > goal.shared.endsAt;
  }
  if (goal.shared.mode === 'together') {
    const map = new Map(goal.shared.participants.map((p) => [String(p), byUser.get(String(p)) || []]));
    out.groupStreak = computeGroupStreak(goal, map, today, wso);
  } else {
    const pts = weeklyPoints(goal, all, today);
    out.ranking = participants
      .map((p) => ({ ...p, points: pts.get(p.id) || 0 }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .map((p, i) => ({ ...p, position: i + 1, me: p.id === String(userId) }));
  }
  if (goal.shared.tasks?.length) {
    const mineToday = all.filter((c) => String(c.userId) === String(userId) && c.date === today);
    out.myTasksToday = mineToday.map((c) => c.taskKey).filter(Boolean);
  }
  return out;
}

export function serializeGoal(goal) {
  return {
    id: String(goal._id),
    ownerId: String(goal.ownerId),
    title: goal.title,
    category: goal.category,
    kind: goal.kind,
    target: goal.target,
    activeDays: goal.activeDays,
    color: goal.color,
    milestones: (goal.milestones || []).map((m) => ({ id: String(m._id), title: m.title, done: m.done, doneAt: m.doneAt })),
    deadline: goal.deadline || null,
    createdAt: goal.createdAt,
  };
}

/** Visão completa de um objetivo para um usuário. */
export async function goalView(goal, user, today, { all, postsCount } = {}) {
  const wso = weekStartsOn(user);
  const allCheckins = all ?? (await Checkin.find({ goalId: goal._id }).lean());
  const mine = allCheckins.filter((c) => String(c.userId) === String(user._id));
  const streak = computeStreak(goal, mine, today, wso);
  const status = todayStatus(goal, mine, today, wso);
  const ms = goal.milestones || [];
  let pct;
  if (goal.kind === 'project') pct = ms.length ? ms.filter((m) => m.done).length / ms.length : 0;
  else if (goal.kind === 'weekly') pct = status.weekValue / status.need;
  else pct = status.todayValue / status.need;
  const view = {
    ...serializeGoal(goal),
    streak,
    status,
    pct: Math.min(1, pct),
    nextMilestone: ms.find((m) => !m.done)?.title || null,
    // "Isso fecha seu Nº dia seguido": valor da sequência se registrar agora
    wouldBe: status.periodDone ? streak.current : streak.current + 1,
    postsCount: postsCount ?? (await Post.countDocuments({ goalId: goal._id, userId: user._id })),
  };
  if (goal.shared) view.shared = await sharedView(goal, user._id, today, wso, allCheckins);
  return view;
}

/** Todos os objetivos ativos do usuário, já com sequência e situação de hoje. */
export async function userGoals(user, today) {
  const goals = await Goal.find(goalsQuery(user._id)).sort({ createdAt: 1 }).lean();
  const ids = goals.map((g) => g._id);
  const [checkins, counts] = await Promise.all([
    Checkin.find({ goalId: { $in: ids } }).lean(),
    Post.aggregate([{ $match: { userId: user._id, goalId: { $in: ids } } }, { $group: { _id: '$goalId', n: { $sum: 1 } } }]),
  ]);
  const byGoal = new Map(ids.map((id) => [String(id), []]));
  for (const c of checkins) byGoal.get(String(c.goalId))?.push(c);
  const countBy = new Map(counts.map((c) => [String(c._id), c.n]));
  return Promise.all(goals.map((g) => goalView(g, user, today, { all: byGoal.get(String(g._id)), postsCount: countBy.get(String(g._id)) || 0 })));
}

/** Resumo leve: só as sequências, para anel de amigos e Broto. */
export async function streakSummary(user, today) {
  const goals = await Goal.find(goalsQuery(user._id)).lean();
  const checkins = await Checkin.find({ userId: user._id, goalId: { $in: goals.map((g) => g._id) } }).lean();
  return summarize(user, goals, checkins, today);
}

/** Mesmo resumo, a partir de dados já carregados (sem ir ao banco). */
export function summarize(user, goals, checkins, today) {
  const wso = weekStartsOn(user);
  let maxActiveDays = 0; // para o Broto dourado (semanas viram 7 dias cada)
  let maxDays = 0; // para mostrar "N dias seguidos" (só objetivos medidos em dias)
  let maxGoal = null;
  for (const g of goals) {
    const s = computeStreak(g, checkins.filter((c) => String(c.goalId) === String(g._id)), today, wso);
    maxActiveDays = Math.max(maxActiveDays, streakInDays(s));
    if (s.unit === 'days' && s.current > maxDays) {
      maxDays = s.current;
      maxGoal = { id: String(g._id), title: g.title, category: g.category, current: s.current, unit: s.unit };
    }
  }
  return { maxActiveDays, maxDays, maxGoal, golden: maxActiveDays >= 7, stage: stageFromLevel(user.level || 1), level: user.level || 1 };
}

/** Atualiza o cache de sequência (coleção streaks). */
export async function refreshStreakCache(goal, userId, today, wso = 1) {
  const mine = await Checkin.find({ goalId: goal._id, userId }).lean();
  const s = computeStreak(goal, mine, today, wso);
  await Streak.updateOne(
    { goalId: goal._id, userId },
    { $set: { current: s.current, best: s.best, unit: s.unit, lastDate: s.lastDate } },
    { upsert: true },
  );
  return s;
}

/**
 * Consistência: dias (ou semanas) feitos ÷ dias que contavam, no intervalo [from, to].
 * Hoje só entra se já foi feito, para não baixar a porcentagem de manhã.
 */
export function consistency(goals, checkinsByGoal, from, to, today) {
  let done = 0;
  let total = 0;
  for (const g of goals) {
    const start = [from, createdDay(g)].filter(Boolean).sort().pop();
    const mine = checkinsByGoal.get(String(g._id)) || [];
    const totals = new Map();
    for (const c of mine) totals.set(c.date, (totals.get(c.date) || 0) + (c.taskKey ? 1 : c.value ?? 1));
    const need = needFor(g);
    if (g.kind === 'weekly') {
      for (let w = weekStart(start, 1); w <= to; w = addDays(w, 7)) {
        let sum = 0;
        for (let i = 0; i < 7; i++) sum += totals.get(addDays(w, i)) || 0;
        const ok = sum >= need;
        if (addDays(w, 6) >= today && !ok) continue; // semana em aberto
        total += 1; if (ok) done += 1;
      }
      continue;
    }
    for (const d of range(start, to)) {
      const active = !g.activeDays?.length || g.activeDays.includes(weekday(d));
      const ok = (totals.get(d) || 0) >= need;
      if (d === today && !ok) continue;
      if (!active && !ok) continue;
      total += 1; if (ok) done += 1;
    }
  }
  return total ? Math.round((done / total) * 100) : null;
}

/** Estatísticas do perfil: sequência, consistência, mapa do mês, consistência 12 semanas. */
export async function profileStats(user, today) {
  const goals = await Goal.find({ $or: [{ ownerId: user._id, shared: null }, { 'shared.participants': user._id }] }).lean();
  const checkins = await Checkin.find({ userId: user._id }).lean();
  const byGoal = new Map();
  for (const c of checkins) {
    const k = String(c.goalId);
    if (!byGoal.has(k)) byGoal.set(k, []);
    byGoal.get(k).push(c);
  }
  const active = goals.filter((g) => !g.archivedAt);
  const summary = await streakSummary(user, today);

  const last30 = consistency(active, byGoal, addDays(today, -29), today, today);
  const prev30 = consistency(active, byGoal, addDays(today, -59), addDays(today, -30), today);

  const from12 = addDays(weekStart(today, 1), -7 * 11);
  const weeks = [];
  for (let w = from12; w <= today; w = addDays(w, 7)) {
    weeks.push({ weekStart: w, pct: consistency(active, byGoal, w, addDays(w, 6) > today ? today : addDays(w, 6), today) });
  }
  const c12 = consistency(active, byGoal, from12, today, today);
  const cPrev12 = consistency(active, byGoal, addDays(from12, -84), addDays(from12, -1), today);

  // Mapa do mês: quantos objetivos teve registro em cada dia
  const monthStart = `${today.slice(0, 8)}01`;
  const perDay = new Map();
  for (const c of checkins) {
    if (c.date.slice(0, 7) !== today.slice(0, 7)) continue;
    const s = perDay.get(c.date) || new Set();
    s.add(String(c.goalId));
    perDay.set(c.date, s);
  }
  const monthDays = [];
  for (let d = monthStart; d.slice(0, 7) === today.slice(0, 7); d = addDays(d, 1)) {
    const n = perDay.get(d)?.size || 0;
    monthDays.push({ date: d, count: n, level: d > today ? null : n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : 3 });
  }
  // Variação de registros vs. o mesmo período do mês anterior
  const lastMonth = addDays(monthStart, -1).slice(0, 7);
  const dayOfMonth = Number(today.slice(8, 10));
  const thisCount = checkins.filter((c) => c.date.slice(0, 7) === today.slice(0, 7)).length;
  const lastCount = checkins.filter((c) => c.date.slice(0, 7) === lastMonth && Number(c.date.slice(8, 10)) <= dayOfMonth).length;

  const challenges = goals.filter((g) => g.shared?.endsAt).length;
  return {
    streak: summary.maxDays,
    streakGoal: summary.maxGoal,
    golden: summary.golden,
    consistency: last30,
    consistencyDelta: last30 != null && prev30 != null ? last30 - prev30 : null,
    consistency12: c12,
    consistency12Delta: c12 != null && cPrev12 != null ? c12 - cPrev12 : null,
    weeks12: weeks,
    challenges,
    month: { key: today.slice(0, 7), firstWeekday: weekday(monthStart), days: monthDays, delta: lastCount >= 5 ? Math.round(((thisCount - lastCount) / lastCount) * 100) : null },
  };
}
