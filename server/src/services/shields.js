// Escudo de sequência (gamificação sem culpa, DESIGN.md §8.5):
// - ganha 1 por semana fechada com 5+ dias ativos, guardando no máximo 3;
// - é usado sozinho quando um dia que contava passou sem registro e havia sequência viva;
// - o dia protegido conta como descanso: não quebra a sequência, mas também não soma.
import { ShieldUse, Checkin, Goal } from '../models/index.js';
import { addDays, weekStart, weekday } from '../lib/dates.js';
import { computeStreak, dayTotals, needFor } from './streaks.js';

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

/** Saldo no começo do dia `day` (ganhos e usos anteriores), respeitando o máximo guardado. */
export function balanceAt(day, earns, uses) {
  const events = [
    ...earns.filter((d) => d <= day).map((d) => ({ d, n: 1, o: 0 })),
    ...uses.filter((d) => d < day).map((d) => ({ d, n: -1, o: 1 })),
  ].sort((a, b) => (a.d === b.d ? a.o - b.o : a.d < b.d ? -1 : 1));
  let bal = 0;
  for (const e of events) bal = Math.max(0, Math.min(SHIELD_MAX, bal + e.n));
  return bal;
}

const createdDay = (g) => (g.createdAt ? new Date(g.createdAt).toISOString().slice(0, 10) : '0000-00-00');

/**
 * Aplica os escudos devidos (últimos 7 dias) e deixa o resultado em user._shields para o dia.
 * Retorna { shieldDates, available, earnedTotal, unseen, max }.
 */
export async function ensureShields(user, today) {
  if (user._shields?.today === today) return user._shields;
  const wso = user.prefs?.weekStart === 'sun' ? 0 : 1;
  const [uses, checkins, goals] = await Promise.all([
    ShieldUse.find({ userId: user._id }).lean(),
    Checkin.find({ userId: user._id }, { goalId: 1, date: 1, value: 1, taskKey: 1 }).lean(),
    Goal.find({ archivedAt: null, $or: [{ ownerId: user._id, shared: null }, { 'shared.participants': user._id }] }).lean(),
  ]);
  const activeDates = new Set(checkins.filter((c) => c.date <= today).map((c) => c.date));
  const earns = earnDates(activeDates, today, wso);
  const useDates = uses.map((u) => u.date);
  const unseen = uses.filter((u) => !u.seen).map((u) => u.date);
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
      return computeStreak(g, mine.filter((c) => c.date < day), day, wso, shields).current >= 1;
    });
    if (!broke || balanceAt(day, earns, useDates) <= 0) continue;
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
    available: balanceAt(addDays(today, 1), earns, useDates.filter((d) => d <= today)),
    earnedTotal: earns.length,
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
