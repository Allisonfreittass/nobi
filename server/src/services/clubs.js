import { Club, Membership, Post, Goal } from '../models/index.js';
import { CATEGORIES } from '../models/Goal.js';
import { addDays, weekStart } from '../lib/dates.js';

export const CATEGORY_LABEL = { treino: 'Treino', leitura: 'Leitura', estudo: 'Estudo', habito: 'Hábito', objetivo: 'Objetivo', projeto: 'Projeto' };
export const isCategory = (c) => CATEGORIES.includes(c);

export async function membershipOf(clubId, userId) {
  return Membership.findOne({ clubId, userId }).lean();
}
export const canModerate = (m) => Boolean(m && m.status === 'active' && (m.role === 'admin' || m.role === 'moderator'));

/** Clubes que a pessoa pode ver: todos os oficiais e os privados em que ela está. */
export async function visibleClubFilter(userId) {
  const mine = await Membership.find({ userId, status: 'active' }, { clubId: 1 }).lean();
  return { $or: [{ kind: 'official' }, { _id: { $in: mine.map((m) => m.clubId) } }] };
}

export async function clubSummary(club, { userId, friends = [] } = {}) {
  const [membersCount, mine] = await Promise.all([
    Membership.countDocuments({ clubId: club._id, status: 'active' }),
    userId ? membershipOf(club._id, userId) : null,
  ]);
  const friendsIn = friends.length ? await Membership.countDocuments({ clubId: club._id, status: 'active', userId: { $in: friends } }) : 0;
  return {
    id: String(club._id),
    slug: club.slug,
    name: club.name,
    category: club.category,
    interest: club.interest || CATEGORY_LABEL[club.category],
    tags: [club.interest || CATEGORY_LABEL[club.category], CATEGORY_LABEL[club.category]].filter((v, i, a) => a.indexOf(v) === i).join(' · '),
    city: club.city,
    region: club.region,
    kind: club.kind,
    membersCount,
    friendsIn,
    member: Boolean(mine && mine.status === 'active'),
    banned: mine?.status === 'banned',
    role: mine?.status === 'active' ? mine.role : null,
  };
}

/** Clubes em que um post Público entra: os da categoria do post em que a pessoa é membro ativa. */
export async function clubIdsForPost(userId, category) {
  if (!category) return [];
  const mine = await Membership.find({ userId, status: 'active' }, { clubId: 1 }).lean();
  if (!mine.length) return [];
  const clubs = await Club.find({ _id: { $in: mine.map((m) => m.clubId) }, category }, { _id: 1 }).lean();
  return clubs.map((c) => c._id);
}

/** Ranking semanal do clube: minutos postados no clube (ou posts), zera no domingo. */
export async function clubRanking(club, today) {
  const ws = weekStart(today, 1);
  const posts = await Post.find({ clubIds: club._id, date: { $gte: ws, $lte: addDays(ws, 6) } }, { userId: 1, metrics: 1 }).lean();
  const banned = new Set((await Membership.find({ clubId: club._id, status: 'banned' }, { userId: 1 }).lean()).map((m) => String(m.userId)));
  const agg = new Map();
  for (const p of posts) {
    const k = String(p.userId);
    if (banned.has(k)) continue;
    const cur = agg.get(k) || { minutes: 0, posts: 0 };
    cur.minutes += p.metrics?.minutes || 0;
    cur.posts += 1;
    agg.set(k, cur);
  }
  return [...agg.entries()].map(([userId, v]) => ({ userId, ...v })).sort((a, b) => b.minutes - a.minutes || b.posts - a.posts);
}

/** Desafios abertos a quem quiser (comunidade) ou aos membros de um clube. */
export function openChallengeFilter(today) {
  return { archivedAt: null, 'shared.endsAt': { $gte: today }, $or: [{ 'shared.public': true }, { 'shared.clubId': { $ne: null } }] };
}
