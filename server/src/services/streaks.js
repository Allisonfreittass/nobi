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
 * start: estado já contado antes do primeiro período (marco). open = false: todos os períodos já fecharam.
 */
function walk(periods, isDone, isSkippable, start = null, open = true) {
  let run = start?.run || 0;
  let best = start?.best || 0;
  let lastDone = start?.lastDate || null;
  periods.forEach((p, i) => {
    if (isDone(p)) {
      run += 1;
      best = Math.max(best, run);
      lastDone = p;
    } else if ((open && i === periods.length - 1) || isSkippable(p)) {
      // em aberto ou descanso: mantém
    } else {
      run = 0;
    }
  });
  return { current: run, best, lastDate: lastDone };
}

const firstDateOf = (checkins) => checkins.reduce((min, c) => (!min || c.date < min ? c.date : min), null);

function streakRules(goal, checkins, shieldDates) {
  const totals = dayTotals(checkins);
  const need = needFor(goal);
  const shielded = (p) => goal.kind !== 'weekly' && Boolean(shieldDates?.has(p));
  return {
    isDone: (p) => periodTotal(goal, totals, p) >= need,
    isSkippable: (p) => isRestDay(goal, p) || shielded(p),
  };
}

/**
 * Sequência individual de um objetivo. shieldDates: dias protegidos por escudo, que contam
 * como descanso (não quebram e não somam). Não vale para meta semanal.
 * mark (opcional, de streakMark): o que já foi contado antes de mark.from. Com ele, só os
 * check-ins a partir de mark.from importam e o resultado é o mesmo da conta com o histórico inteiro.
 */
export function computeStreak(goal, checkins, today, weekStartsOn = 1, shieldDates = null, mark = null) {
  const { isDone, isSkippable } = streakRules(goal, checkins, shieldDates);
  const started = mark?.started ? mark : null;
  const periods = periodsFor(goal, started ? mark.from : firstDateOf(checkins), today, weekStartsOn);
  const res = walk(periods, isDone, isSkippable, started);
  return { ...res, unit: streakUnit(goal) };
}

/** O que muda a conta de um objetivo: se mudar, o marco guardado não vale mais. */
export const ruleKey = (goal, weekStartsOn = 1) => [goal.kind, needFor(goal), (goal.activeDays || []).join(','), weekStartsOn].join('|');

export const countBefore = (dates, from) => {
  let n = 0;
  for (const d of dates || []) if (d < from) n += 1;
  return n;
};

/**
 * Marco de sequência: o estado da contagem (sequência, melhor, último dia feito) com todos os
 * períodos antes de `from` já fechados. `from` precisa ser início de semana (weekStartsOn) e estar
 * no passado. base: um marco anterior; aí bastam os check-ins a partir de base.from.
 * sh: quantos dias protegidos havia antes de `from` (se mudar, o marco não vale).
 */
export function streakMark(goal, checkins, from, weekStartsOn = 1, shieldDates = null, base = null) {
  const { isDone, isSkippable } = streakRules(goal, checkins, shieldDates);
  const until = addDays(from, -1);
  const out = { from, rule: ruleKey(goal, weekStartsOn), sh: countBefore(shieldDates, from) };
  const started = base?.started ? base : null;
  const first = started ? base.from : firstDateOf(checkins.filter((c) => c.date < from));
  if (!first) return { ...out, started: false, run: 0, best: 0, lastDate: null };
  const res = walk(periodsFor(goal, first, until, weekStartsOn), isDone, isSkippable, started, false);
  return { ...out, started: true, run: res.current, best: res.best, lastDate: res.lastDate };
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
