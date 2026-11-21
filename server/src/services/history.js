// Janela de check-ins. As telas leem só os registros recentes; o que veio antes fica resumido em
// marcos guardados (Streak.mark por objetivo, User.shieldMark para os escudos). Um marco é o
// estado da contagem com tudo antes de `from` já fechado, então somar a janela a ele dá
// exatamente o mesmo resultado da conta com o histórico inteiro (regras do DESIGN.md §8).
//
// O marco fica entre 2 e 8 semanas atrás de hoje: escudos só são gastos nos últimos 7 dias e
// registros novos caem em hoje, então nada antes de `from` muda. O que pode mudar o passado
// (importar do Strava, apagar um objetivo) chama forgetMarks.
import { Checkin, Goal, ShieldUse, Streak, User } from '../models/index.js';
import { addDays, weekStart } from '../lib/dates.js';
import { ruleKey, streakMark, countBefore } from './streaks.js';

export const WINDOW_DAYS = 91; // quanto cada leitura busca para trás
export const MARK_MIN_LAG = 14; // o marco fica ao menos 2 semanas atrás de hoje
const MARK_LAG = 28; // onde um marco novo é posto (início da semana de 4 semanas atrás)
const MARK_MAX_LAG = 56; // mais velho que isso, o marco anda para frente com a janela

const wsoOf = (user) => (user?.prefs?.weekStart === 'sun' ? 0 : 1);
export const windowStart = (today) => addDays(today, -WINDOW_DAYS);
export const markFrom = (today, wso) => weekStart(addDays(today, -MARK_LAG), wso);

/** O marco ainda vale para esta conta (mesmas regras, dentro da janela, escudos antigos iguais)? */
export const markInWindow = (from, today) => Boolean(from) && from >= windowStart(today) && from <= addDays(today, -MARK_MIN_LAG);
export const markIsOld = (from, today) => from < addDays(today, -MARK_MAX_LAG);

export function markUsable(mark, goal, today, wso, shieldDates) {
  return Boolean(mark) && mark.rule === ruleKey(goal, wso) && markInWindow(mark.from, today) && mark.sh === countBefore(shieldDates, mark.from);
}

const goalsOf = (userId) => ({ archivedAt: null, $or: [{ ownerId: userId, shared: null }, { 'shared.participants': userId }] });

/**
 * Lê de uma vez, para uma ou várias pessoas: escudos usados, check-ins da janela (todos os
 * objetivos), objetivos ativos e marcos. Devolve Map<userId, dados>.
 */
export async function loadStreakData(users, today, { sort = null } = {}) {
  const ids = users.map((u) => u._id);
  const since = windowStart(today);
  const single = ids.length === 1;
  const goalsQ = single ? Goal.find(goalsOf(ids[0])) : Goal.find({ archivedAt: null, $or: [{ ownerId: { $in: ids }, shared: null }, { 'shared.participants': { $in: ids } }] });
  if (sort) goalsQ.sort(sort);
  const [uses, checkins, goals, streaks] = await Promise.all([
    ShieldUse.find(single ? { userId: ids[0] } : { userId: { $in: ids } }).lean(),
    Checkin.find({ userId: single ? ids[0] : { $in: ids }, date: { $gte: since } }).lean(),
    goalsQ.lean(),
    Streak.find({ userId: single ? ids[0] : { $in: ids }, mark: { $exists: true } }, { goalId: 1, userId: 1, mark: 1 }).lean(),
  ]);
  const out = new Map(ids.map((id) => [String(id), { since, uses: [], checkins: [], goals: [], marks: new Map() }]));
  for (const u of uses) out.get(String(u.userId))?.uses.push(u);
  for (const c of checkins) out.get(String(c.userId))?.checkins.push(c);
  for (const s of streaks) out.get(String(s.userId))?.marks.set(String(s.goalId), s.mark);
  for (const g of goals) {
    if (single) { out.get(String(ids[0])).goals.push(g); continue; }
    if (!g.shared) out.get(String(g.ownerId))?.goals.push(g);
    else for (const p of g.shared.participants || []) out.get(String(p))?.goals.push(g);
  }
  return out;
}

const byGoal = (checkins) => {
  const m = new Map();
  for (const c of checkins) {
    const k = String(c.goalId);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(c);
  }
  return m;
};

/**
 * Marcos válidos para todos os objetivos de data.goals (Map<goalId, mark>). Quem não tem marco
 * (ou tem um que não vale mais) lê o histórico antigo uma vez; marcos velhos andam com a janela.
 * Guarda o resultado em data, para as outras contas da mesma requisição.
 */
export function resolveGoalMarks(user, data, today, shieldDates) {
  if (!data.resolved) data.resolved = computeGoalMarks(user, data, today, shieldDates);
  return data.resolved;
}

async function computeGoalMarks(user, data, today, shieldDates) {
  const wso = wsoOf(user);
  const target = markFrom(today, wso);
  const recent = byGoal(data.checkins);
  const out = new Map();
  const stale = [];
  const writes = [];
  for (const g of data.goals) {
    const id = String(g._id);
    const m = data.marks.get(id);
    if (!markUsable(m, g, today, wso, shieldDates)) stale.push(g);
    else if (markIsOld(m.from, today)) {
      const next = streakMark(g, recent.get(id) || [], target, wso, shieldDates, m);
      out.set(id, next);
      writes.push([g._id, next]);
    } else out.set(id, m);
  }
  if (stale.length) {
    const old = byGoal(await Checkin.find(
      { userId: user._id, goalId: { $in: stale.map((g) => g._id) }, date: { $lt: data.since } },
      { goalId: 1, date: 1, value: 1, taskKey: 1 },
    ).lean());
    for (const g of stale) {
      const id = String(g._id);
      const next = streakMark(g, [...(old.get(id) || []), ...(recent.get(id) || [])], target, wso, shieldDates);
      out.set(id, next);
      writes.push([g._id, next]);
    }
  }
  if (writes.length) {
    await Streak.bulkWrite(writes.map(([goalId, mark]) => ({ updateOne: { filter: { goalId, userId: user._id }, update: { $set: { mark } }, upsert: true } })));
  }
  return out;
}

/**
 * O passado mudou (registros antigos importados ou apagados): o marco dos escudos desta pessoa
 * (e o do objetivo, se informado) deixa de valer e é refeito do histórico na próxima leitura.
 */
export async function forgetMarks(userId, { goalId = null } = {}) {
  await Promise.all([
    goalId ? Streak.updateOne({ goalId, userId }, { $unset: { mark: 1 } }) : null,
    User.updateOne({ _id: userId }, { $unset: { shieldMark: 1 } }),
  ]);
}
