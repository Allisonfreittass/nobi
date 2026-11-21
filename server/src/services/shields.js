// Escudo de sequência (gamificação sem culpa, DESIGN.md §8.5):
// - ganha 1 por semana fechada com 5+ dias ativos, guardando no máximo 3;
// - é usado sozinho quando um dia que contava passou sem registro e havia sequência viva;
// - o dia protegido conta como descanso: não quebra a sequência, mas também não soma.
import { ShieldUse, Checkin, User } from '../models/index.js';
import { addDays, weekStart, weekday } from '../lib/dates.js';
import { computeStreak, dayTotals, needFor, countBefore } from './streaks.js';
import { loadStreakData, resolveGoalMarks, markFrom, markInWindow, markIsOld } from './history.js';

export const SHIELD_MAX = 3;
export const SHIELD_MIN_DAYS = 5;
const LOOKBACK_DAYS = 7;

/** Datas em que um escudo foi ganho: o dia seguinte ao fim de cada semana com 5+ dias ativos. */
export function earnDates(activeDates, today, wso = 1) {
  const sorted = [...activeDates].sort();
  if (!sorted.length) return [];
  const out = [];
  for (let w = weekStart(sorted[0], wso); addDays(w, 6) < today; w = addDays(w, 7)) {
    let n = 0;
    for (let i = 0; i < 7; i++) if (activeDates.has(addDays(w, i))) n += 1;
    if (n >= SHIELD_MIN_DAYS) out.push(addDays(w, 7));
  }
  return out;
}

/**
 * Saldo no começo do dia `day` (ganhos e usos anteriores), respeitando o máximo guardado.
 * start: saldo já contado antes do primeiro evento da lista (marco).
 */
export function balanceAt(day, earns, uses, start = 0) {
  const events = [
    ...earns.filter((d) => d <= day).map((d) => ({ d, n: 1, o: 0 })),
    ...uses.filter((d) => d < day).map((d) => ({ d, n: -1, o: 1 })),
  ].sort((a, b) => (a.d === b.d ? a.o - b.o : a.d < b.d ? -1 : 1));
  let bal = start;
  for (const e of events) bal = Math.max(0, Math.min(SHIELD_MAX, bal + e.n));
  return bal;
}

const createdDay = (g) => (g.createdAt ? new Date(g.createdAt).toISOString().slice(0, 10) : '0000-00-00');

/**
 * Marco dos escudos: ganhos e saldo com tudo antes de `from` (início de semana) já contado.
 * activeDates: dias com registro antes de `from` (com base, só a partir de base.from).
 */
export function shieldMark(activeDates, useDates, from, wso = 1, base = null) {
  const earns = earnDates(activeDates, from, wso); // só semanas que terminam antes de `from`
  const all = [...(base?.earnAtF ? [base.from] : []), ...earns].filter((d) => d < from);
  const uses = useDates.filter((d) => d < from && (!base || d >= base.from));
  return {
    from,
    wso,
    bal: balanceAt(from, all, uses, base?.bal || 0),
    earnAtF: earns.includes(from),
    nEarn: (base?.nEarn || 0) + earns.length,
    nUses: countBefore(useDates, from),
  };
}

/** Marco dos escudos que vale hoje: o guardado, andado para frente, ou refeito do histórico. */
async function resolveShieldMark(user, data, today, wso, useDates) {
  const m = user.shieldMark;
  const usable = m && m.wso === wso && markInWindow(m.from, today) && m.nUses === countBefore(useDates, m.from);
  if (usable && !markIsOld(m.from, today)) return m;
  const target = markFrom(today, wso);
  let next;
  if (usable) {
    next = shieldMark(new Set(data.checkins.filter((c) => c.date >= m.from && c.date < target).map((c) => c.date)), useDates, target, wso, m);
  } else {
    const old = await Checkin.distinct('date', { userId: user._id, date: { $lt: data.since } });
    const dates = new Set([...old, ...data.checkins.filter((c) => c.date < target).map((c) => c.date)]);
    next = shieldMark(dates, useDates, target, wso);
  }
  await User.updateOne({ _id: user._id }, { $set: { shieldMark: next } });
  return next;
}

/**
 * Aplica os escudos devidos (últimos 7 dias) e deixa o resultado em user._shields para o dia.
 * Retorna { shieldDates, available, earnedTotal, unseen, max }.
 * data: o que loadStreakData já leu desta pessoa (senão lê aqui).
 */
export async function ensureShields(user, today, data = null) {
  if (user._shields?.today === today) return user._shields;
  const wso = user.prefs?.weekStart === 'sun' ? 0 : 1;
  data = data || (await loadStreakData([user], today)).get(String(user._id));
  const { uses, goals, checkins } = data;
  const useDates = uses.map((u) => u.date);
  const unseen = uses.filter((u) => !u.seen).map((u) => u.date);
  const [marks, sm] = await Promise.all([
    resolveGoalMarks(user, data, today, new Set(useDates)),
    resolveShieldMark(user, data, today, wso, useDates),
  ]);
  // Ganhos: os do marco mais os das semanas da janela
  const recentEarns = earnDates(new Set(checkins.filter((c) => c.date >= sm.from && c.date <= today).map((c) => c.date)), today, wso);
  const earns = [...(sm.earnAtF ? [sm.from] : []), ...recentEarns];
  const balance = (day, list) => balanceAt(day, earns, list.filter((d) => d >= sm.from), sm.bal);
  const byGoal = new Map();
  for (const c of checkins) {
    const k = String(c.goalId);
    if (!byGoal.has(k)) byGoal.set(k, []);
    byGoal.get(k).push(c);
  }

  for (let i = LOOKBACK_DAYS; i >= 1; i -= 1) {
    const day = addDays(today, -i);
    if (useDates.includes(day)) continue;
    const shields = new Set(useDates);
    const broke = goals.some((g) => {
      if (g.kind === 'weekly' || g.shared?.tasks?.length || createdDay(g) >= day) return false;
      if (g.activeDays?.length && !g.activeDays.includes(weekday(day))) return false;
      const mine = byGoal.get(String(g._id)) || [];
      if ((dayTotals(mine).get(day) || 0) >= needFor(g)) return false; // fez nesse dia
      // Havia sequência viva até a véspera?
      return computeStreak(g, mine.filter((c) => c.date < day), day, wso, shields, marks.get(String(g._id))).current >= 1;
    });
    if (!broke || balance(day, useDates) <= 0) continue;
    try {
      await ShieldUse.create({ userId: user._id, date: day });
      useDates.push(day);
      unseen.push(day);
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }

  user._shields = {
    today,
    shieldDates: new Set(useDates),
    available: balance(addDays(today, 1), useDates.filter((d) => d <= today)),
    earnedTotal: sm.nEarn + recentEarns.length,
    unseen: unseen.sort(),
    max: SHIELD_MAX,
  };
  return user._shields;
}

/** Só as datas protegidas, sem aplicar nada (para recalcular o cache de sequência). */
export async function shieldDatesOf(userId) {
  const rows = await ShieldUse.find({ userId }, { date: 1 }).lean();
  return new Set(rows.map((r) => r.date));
}
