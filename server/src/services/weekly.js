// Resumo semanal: os números da semana da pessoa para o card de story (domingo).
import { Checkin, Goal, Achievement, XpGrant } from '../models/index.js';
import { addDays, weekStart, isDateStr, weekday } from '../lib/dates.js';
import { weekStartsOn, goalsQuery, streakSummary } from './progress.js';
import { catalogByCode } from './achievements.js';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const label = (a, b) => {
  const [, ma, da] = a.split('-').map(Number);
  const [, mb, db] = b.split('-').map(Number);
  return ma === mb ? `${da}–${db} ${MONTHS[mb - 1]}` : `${da} ${MONTHS[ma - 1]} – ${db} ${MONTHS[mb - 1]}`;
};

/** Qual semana mostrar: no domingo (fim da semana) mostra a atual; nos outros dias, a que acabou. */
export function weekToShow(today, wso) {
  const ws = weekStart(today, wso);
  const end = addDays(ws, 6);
  return today === end ? ws : addDays(ws, -7);
}

export async function weeklySummary(user, today, startParam) {
  const wso = weekStartsOn(user);
  const start = isDateStr(startParam) ? weekStart(startParam, wso) : weekToShow(today, wso);
  const end = addDays(start, 6);
  const [checkins, goals, earned, xp, summary] = await Promise.all([
    Checkin.find({ userId: user._id, date: { $gte: start, $lte: end } }).lean(),
    Goal.find({ ...goalsQuery(user._id), archivedAt: null }).lean(),
    Achievement.find({ userId: user._id, earnedAt: { $gte: new Date(`${start}T00:00:00Z`), $lte: new Date(`${addDays(end, 1)}T03:00:00Z`) } }).lean(),
    XpGrant.aggregate([{ $match: { userId: user._id, createdAt: { $gte: new Date(`${start}T00:00:00Z`), $lte: new Date(`${addDays(end, 1)}T03:00:00Z`) } } }, { $group: { _id: null, n: { $sum: '$amount' } } }]),
    streakSummary(user, end < today ? end : today),
  ]);
  const goalById = new Map(goals.map((g) => [String(g._id), g]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const mine = checkins.filter((c) => c.date === date);
    return { date, weekday: weekday(date), count: new Set(mine.map((c) => String(c.goalId))).size, future: date > today };
  });
  // Objetivo mais presente na semana
  const perGoal = new Map();
  for (const c of checkins) {
    const k = String(c.goalId);
    if (!perGoal.has(k)) perGoal.set(k, new Set());
    perGoal.get(k).add(c.date);
  }
  const [topId, topDays] = [...perGoal.entries()].sort((a, b) => b[1].size - a[1].size)[0] || [];
  const top = topId && goalById.get(topId);
  const sum = (k) => checkins.reduce((s, c) => s + (c[k] || 0), 0);
  return {
    start,
    end,
    label: label(start, end),
    complete: today >= end,
    days,
    activeDays: days.filter((d) => d.count > 0).length,
    checkins: checkins.length,
    minutes: sum('minutes'),
    pages: sum('pages'),
    km: Math.round(sum('km') * 10) / 10,
    xp: xp[0]?.n || 0,
    bestStreak: summary.maxDays,
    bestStreakGoal: summary.maxGoal?.title || null,
    golden: summary.golden,
    stage: summary.stage,
    level: user.level,
    topGoal: top ? { title: top.title, category: top.category, color: top.color, days: topDays.size } : null,
    achievements: earned.map((a) => catalogByCode[a.code]?.title).filter(Boolean),
  };
}
