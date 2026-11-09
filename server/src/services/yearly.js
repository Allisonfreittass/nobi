// "Ano no Nobi": a retrospectiva do ano da pessoa (como o Year in Sport do Strava), para o card de story.
import { Checkin, Goal, Achievement, Post, User, Collectible } from '../models/index.js';
import { addDays } from '../lib/dates.js';
import { catalogByCode } from './achievements.js';
import { ACCESSORIES, accessoriesFromAchievements } from './collectibles.js';
import { publicUser } from './social.js';

/** Qual ano mostrar: em janeiro, o ano que acabou; no resto, o ano corrente (em andamento). */
export function yearToShow(today) {
  const [y, m] = today.split('-').map(Number);
  return m === 1 ? y - 1 : y;
}

/** Maior trecho de dias seguidos com registro dentro do conjunto. */
export function longestRun(dates) {
  const sorted = [...dates].sort();
  let best = 0; let run = 0; let prev = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export async function yearSummary(user, today, yearParam) {
  const year = Number(yearParam) || yearToShow(today);
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const from = new Date(`${start}T00:00:00-03:00`);
  const to = new Date(`${year + 1}-01-01T00:00:00-03:00`);
  const [checkins, achievements, posts, seasonal] = await Promise.all([
    Checkin.find({ userId: user._id, date: { $gte: start, $lte: end > today ? today : end } }).lean(),
    Achievement.find({ userId: user._id, earnedAt: { $gte: from, $lt: to } }).lean(),
    Post.find({ userId: user._id, createdAt: { $gte: from, $lt: to } }, { reactions: 1, commentsCount: 1 }).lean(),
    Collectible.find({ userId: user._id, earnedAt: { $gte: from, $lt: to } }).lean(),
  ]);
  const dates = new Set(checkins.map((c) => c.date));
  const months = Array.from({ length: 12 }, (_, i) => {
    const prefix = `${year}-${String(i + 1).padStart(2, '0')}`;
    return [...dates].filter((d) => d.startsWith(prefix)).length;
  });
  const perGoal = new Map();
  for (const c of checkins) {
    const k = String(c.goalId);
    if (!perGoal.has(k)) perGoal.set(k, new Set());
    perGoal.get(k).add(c.date);
  }
  const ranked = [...perGoal.entries()].sort((a, b) => b[1].size - a[1].size);
  const goals = new Map((await Goal.find({ _id: { $in: ranked.slice(0, 3).map(([id]) => id) } }, { title: 1, category: 1, color: 1 }).lean()).map((g) => [String(g._id), g]));
  const topGoals = ranked.slice(0, 3).map(([id, d]) => ({ title: goals.get(id)?.title, category: goals.get(id)?.category, days: d.size })).filter((g) => g.title);
  // Torcida: quem mais disse "Boa!" nos seus posts
  const cheer = new Map();
  for (const p of posts) for (const r of p.reactions) if (String(r.userId) !== String(user._id)) cheer.set(String(r.userId), (cheer.get(String(r.userId)) || 0) + 1);
  const [topCheerId, topCheerCount] = [...cheer.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  const topCheer = topCheerId ? await User.findById(topCheerId).lean() : null;
  const sum = (k) => checkins.reduce((s, c) => s + (c[k] || 0), 0);
  const accessories = [
    ...accessoriesFromAchievements(achievements.map((a) => a.code)),
    ...seasonal.map((c) => ACCESSORIES.find((a) => a.id === c.item)).filter(Boolean),
  ].map((a) => ({ id: a.id, name: a.name }));
  const bestMonth = months.indexOf(Math.max(...months));
  return {
    year,
    complete: today > end,
    activeDays: dates.size,
    checkins: checkins.length,
    minutes: sum('minutes'),
    pages: sum('pages'),
    km: Math.round(sum('km') * 10) / 10,
    longestRun: longestRun(dates),
    months,
    bestMonth: months[bestMonth] ? bestMonth : null,
    topGoals,
    posts: posts.length,
    boaReceived: posts.reduce((s, p) => s + p.reactions.filter((r) => String(r.userId) !== String(user._id)).length, 0),
    topCheer: topCheer ? { ...publicUser(topCheer), count: topCheerCount } : null,
    achievements: achievements.map((a) => catalogByCode[a.code]?.title).filter(Boolean),
    accessories,
    level: user.level,
  };
}
