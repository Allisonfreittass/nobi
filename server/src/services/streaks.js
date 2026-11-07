// Regras de sequência (DESIGN.md §8.3–8.6). Funções puras: recebem check-ins e devolvem números.
import { addDays, weekday, weekStart, range } from '../lib/dates.js';

export const streakUnit = (goal) => (goal.kind === 'weekly' ? 'weeks' : 'days');

/** Quanto precisa somar no período para contar. Projeto: qualquer avanço. Desafio com checklist: 1 tarefa. */
export function needFor(goal) {
  if (goal.kind === 'project' || goal.shared?.tasks?.length) return 1;
  return Math.max(1, goal.target?.amount || 1);
}

export function dayTotals(checkins) {
  const totals = new Map();
  for (const c of checkins) {
    const v = c.taskKey ? 1 : (c.value ?? 1);
    totals.set(c.date, (totals.get(c.date) || 0) + v);
  }
  return totals;
}

const isRestDay = (goal, d) => goal.kind !== 'weekly' && goal.activeDays?.length > 0 && !goal.activeDays.includes(weekday(d));

function periodsFor(goal, firstDate, today, weekStartsOn) {
  if (!firstDate || firstDate > today) return [];
  if (goal.kind === 'weekly') {
    const out = [];
    for (let w = weekStart(firstDate, weekStartsOn); w <= today; w = addDays(w, 7)) out.push(w);
    return out;
  }
  return range(firstDate, today);
}

function periodTotal(goal, totals, period) {
  if (goal.kind !== 'weekly') return totals.get(period) || 0;
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += totals.get(addDays(period, i)) || 0;
  return sum;
}

/**
 * Percorre os períodos em ordem. O período atual (hoje / esta semana) ainda está em aberto:
 * se não foi feito, não quebra a sequência. Dias de descanso também não quebram.
 */
function walk(periods, isDone, isSkippable) {
  let run = 0;
  let best = 0;
  let lastDone = null;
  periods.forEach((p, i) => {
    if (isDone(p)) {
      run += 1;
      best = Math.max(best, run);
      lastDone = p;
    } else if (i === periods.length - 1 || isSkippable(p)) {
      // em aberto ou descanso: mantém
    } else {
      run = 0;
    }
  });
  return { current: run, best, lastDate: lastDone };
}

const firstDateOf = (checkins) => checkins.reduce((min, c) => (!min || c.date < min ? c.date : min), null);

/** Sequência individual de um objetivo. */
export function computeStreak(goal, checkins, today, weekStartsOn = 1) {
  const totals = dayTotals(checkins);
  const need = needFor(goal);
  const periods = periodsFor(goal, firstDateOf(checkins), today, weekStartsOn);
  const res = walk(periods, (p) => periodTotal(goal, totals, p) >= need, (p) => isRestDay(goal, p));
  return { ...res, unit: streakUnit(goal) };
}

/** Quantas pessoas precisam marcar para o grupo contar: metade ou mais (não pune o grupo por uma pessoa). */
export const groupQuorum = (n) => Math.max(1, Math.ceil(n / 2));

/** Sequência do grupo no modo "Juntos". checkinsByUser: Map<userId, checkins[]>. */
export function computeGroupStreak(goal, checkinsByUser, today, weekStartsOn = 1) {
  const members = [...checkinsByUser.values()];
  const totals = members.map(dayTotals);
  const need = needFor(goal);
  const quorum = groupQuorum(goal.shared?.participants?.length || members.length);
  const all = members.flat();
  const periods = periodsFor(goal, firstDateOf(all), today, weekStartsOn);
  const isDone = (p) => totals.filter((t) => periodTotal(goal, t, p) >= need).length >= quorum;
  return { ...walk(periods, isDone, (p) => isRestDay(goal, p)), unit: streakUnit(goal), quorum };
}

/** Situação de hoje para o card do objetivo: quanto já foi, se bateu, e os últimos 7 dias. */
export function todayStatus(goal, checkins, today, weekStartsOn = 1) {
  const totals = dayTotals(checkins);
  const need = needFor(goal);
  const todayValue = totals.get(today) || 0;
  const ws = weekStart(today, weekStartsOn);
  const weekValue = periodTotal({ kind: 'weekly' }, totals, ws);
  const doneToday = goal.kind === 'weekly' ? todayValue > 0 : todayValue >= need;
  const periodDone = goal.kind === 'weekly' ? weekValue >= need : doneToday;
  const last7 = range(addDays(today, -6), today).map((date) => {
    const v = totals.get(date) || 0;
    const ok = goal.kind === 'weekly' ? v > 0 : v >= need;
    let state = ok ? 'done' : isRestDay(goal, date) ? 'rest' : 'miss';
    if (date === today && !ok) state = 'today';
    return { date, state };
  });
  return { todayValue, weekValue, need, doneToday, periodDone, last7, activeToday: !isRestDay(goal, today) };
}

/**
 * Converte para dias quando precisa comparar (Broto dourado = maior sequência ativa ≥ 7 dias).
 * Meta semanal só conta a partir de 2 semanas seguidas: uma semana com 4 treinos não é "7 dias seguidos".
 */
export const streakInDays = (s) => (s.unit === 'weeks' ? (s.current >= 2 ? s.current * 7 : 0) : s.current);

export const CELEBRATE = { days: [7, 30, 100, 365], weeks: [4, 12, 52] };
