import { Router } from 'express';
import { addDays } from '../lib/dates.js';
import { Goal, Post, User, Follow, Comment, Club, Membership, Nudge, Pair } from '../models/index.js';
import { friendIds, followingIds, publicUser } from '../services/social.js';
import { clubSummary, visibleClubFilter } from '../services/clubs.js';
import { Checkin } from '../models/index.js';
import { goalsQuery, goalView, streakSummary, userGoals } from '../services/progress.js';

export const home = Router();

/** Topo do feed: anel dos amigos e desafio ativo. */
home.get('/', async (req, res) => {
  const me = req.user;
  const ids = await friendIds(me._id);
  const friends = await User.find({ _id: { $in: ids } }).lean();
  const postedToday = new Set((await Post.find({ userId: { $in: ids }, date: req.today }, { userId: 1 }).lean()).map((p) => String(p.userId)));
  const ring = await Promise.all(friends.map(async (f) => {
    const s = await streakSummary(f, req.today);
    // dourado = sequência ≥ 7; brasa = postou hoje; cinza = não postou (DESIGN.md §8.7)
    const ringState = s.golden ? 'golden' : postedToday.has(String(f._id)) ? 'posted' : 'none';
    return { ...publicUser(f), ring: ringState, streak: s.maxActiveDays };
  }));
  const order = { golden: 0, posted: 1, none: 2 };
  ring.sort((a, b) => order[a.ring] - order[b.ring] || b.streak - a.streak);

  const challenges = await Goal.find({ ...goalsQuery(me._id), 'shared.endsAt': { $gte: req.today } }).sort({ 'shared.endsAt': 1 }).lean();
  let challenge = null;
  if (challenges.length) {
    const v = await goalView(challenges[0], me, req.today);
    challenge = { id: v.id, title: v.title, day: v.shared.day, totalDays: v.shared.totalDays, mode: v.shared.mode, color: v.color };
    if (v.shared.ranking) {
      const mine = v.shared.ranking.find((r) => r.me);
      const ahead = v.shared.ranking[mine.position - 2];
      challenge.position = mine.position;
      challenge.points = mine.points;
      challenge.ahead = ahead ? { name: ahead.name.split(' ')[0], gap: ahead.points - mine.points } : null;
    } else {
      challenge.groupStreak = v.shared.groupStreak.current;
      challenge.doneTodayCount = v.shared.doneTodayCount;
      challenge.participantsCount = v.shared.participants.length;
    }
  }
  const goals = await userGoals(me, req.today);
  const dueToday = goals.filter((g) => g.status.activeToday && g.kind !== 'project' && !g.status.periodDone);
  res.json({ ring, challenge, pendingToday: dueToday.length, goalsToday: goals.length });
});

/**
 * "Primeiros passos" de quem chegou: objetivo, primeiro registro, seguir gente, entrar num clube, chamar um amigo.
 * Some quando tudo foi feito, quando a pessoa fecha ou depois de 30 dias de conta.
 */
const ONBOARDING_DAYS = 30;
home.get('/onboarding', async (req, res) => {
  const me = req.user;
  const old = Date.now() - new Date(me.createdAt).getTime() > ONBOARDING_DAYS * 86400000;
  if (me.onboardingDismissedAt || old) return res.json({ show: false });
  const [goal, checkin, following, club, invited] = await Promise.all([
    Goal.exists({ ownerId: me._id }),
    Checkin.exists({ userId: me._id }),
    followingIds(me._id),
    Membership.exists({ userId: me._id, status: 'active' }),
    Follow.exists({ followeeId: me._id, status: 'accepted' }),
  ]);
  const steps = [
    { id: 'goal', label: 'Criar seu primeiro objetivo', done: Boolean(goal), to: '/metas/novo' },
    { id: 'checkin', label: 'Fazer o primeiro registro', done: Boolean(checkin), to: '/metas' },
    { id: 'follow', label: 'Seguir 3 pessoas', done: following.length >= 3, to: '/comunidade' },
    { id: 'club', label: 'Entrar num clube', done: Boolean(club), to: '/comunidade' },
    { id: 'friend', label: 'Chamar um amigo', done: Boolean(invited), to: null }, // abre o convite
  ];
  if (steps.every((s) => s.done)) return res.json({ show: false, steps });
  // Clubes para começar: da cidade, depois do interesse, depois os maiores
  let clubs = [];
  if (!club) {
    const visible = await visibleClubFilter(me._id);
    const base = { ...visible, kind: { $in: ['official', 'open'] } };
    const city = me.city ? await Club.find({ ...base, city: me.city }).limit(3).lean() : [];
    const interest = me.interests?.length ? await Club.find({ ...base, interest: { $in: me.interests }, _id: { $nin: city.map((c) => c._id) } }).limit(3).lean() : [];
    clubs = [...city, ...interest];
    if (clubs.length < 3) clubs.push(...await Club.find({ ...base, _id: { $nin: clubs.map((c) => c._id) } }).limit(3 - clubs.length).lean());
    const friends = await friendIds(me._id);
    clubs = await Promise.all(clubs.slice(0, 3).map((c) => clubSummary(c, { userId: me._id, friends })));
  }
  res.json({ show: true, steps, clubs });
});

home.post('/onboarding/dismiss', async (req, res) => {
  req.user.onboardingDismissedAt = new Date();
  await req.user.save();
  res.json({ ok: true });
});

home.get('/challenges', async (req, res) => {
  const list = await Goal.find({ ...goalsQuery(req.user._id), shared: { $ne: null } }).sort({ createdAt: -1 }).lean();
  res.json(await Promise.all(list.map((g) => goalView(g, req.user, req.today))));
});

/** Notificações calculadas na hora. O lembrete de check-in aparece no máximo uma vez por dia (§8.9). */
home.get('/notifications', async (req, res) => {
  const me = req.user;
  const items = [];
  const since = new Date(Date.now() - 14 * 86400000);

  const requests = await Follow.find({ followeeId: me._id, status: 'pending' }).lean();
  const reqUsers = await User.find({ _id: { $in: requests.map((r) => r.followerId) } }).lean();
  const ru = new Map(reqUsers.map((u) => [String(u._id), u]));
  for (const r of requests) {
    const u = ru.get(String(r.followerId));
    if (u) items.push({ id: `follow:${r._id}`, type: 'follow-request', at: r.createdAt, user: publicUser(u), requestId: String(r._id) });
  }

  // Convites de sequência a dois (aparecem sempre)
  const pairInvites = await Pair.find({ users: me._id, status: 'pending', invitedBy: { $ne: me._id } }).lean();
  const pu2 = new Map((await User.find({ _id: { $in: pairInvites.map((p) => p.invitedBy) } }).lean()).map((u) => [String(u._id), u]));
  for (const p of pairInvites) {
    const by = pu2.get(String(p.invitedBy));
    if (by) items.push({ id: `pair:${p._id}`, type: 'pair-invite', at: p.createdAt, user: publicUser(by), pairId: String(p._id) });
  }

  // Convites para grupos privados: aparecem sempre, como pedidos para seguir
  const groupInvites = await Membership.find({ userId: me._id, status: 'invited' }).lean();
  if (groupInvites.length) {
    const [gClubs, gUsers] = await Promise.all([
      Club.find({ _id: { $in: groupInvites.map((m) => m.clubId) } }).lean(),
      User.find({ _id: { $in: groupInvites.map((m) => m.invitedBy).filter(Boolean) } }).lean(),
    ]);
    const gc = new Map(gClubs.map((c) => [String(c._id), c]));
    const gu = new Map(gUsers.map((u) => [String(u._id), u]));
    for (const m of groupInvites) {
      const c = gc.get(String(m.clubId));
      if (!c) continue;
      const by = gu.get(String(m.invitedBy));
      items.push({ id: `group:${m._id}`, type: 'group-invite', at: m.joinedAt, user: by ? publicUser(by) : null, club: { slug: c.slug, name: c.name, category: c.category } });
    }
  }

  if (me.prefs.notify.challenges) {
    // Cutucadas de hoje e ontem (as de dias passados perdem o sentido)
    const nudges = await Nudge.find({ toId: me._id, date: { $gte: addDays(req.today, -1) } }).sort({ createdAt: -1 }).limit(20).lean();
    const [nUsers, nGoals] = await Promise.all([
      User.find({ _id: { $in: nudges.map((n) => n.fromId) } }).lean(),
      Goal.find({ _id: { $in: nudges.map((n) => n.goalId) } }, { title: 1, shared: 1 }).lean(),
    ]);
    const nu = new Map(nUsers.map((u) => [String(u._id), u]));
    const ng = new Map(nGoals.map((x) => [String(x._id), x]));
    for (const n of nudges) {
      const by = nu.get(String(n.fromId));
      if (by && n.pairId) { items.push({ id: `nudge:${n._id}`, type: 'pair-nudge', at: n.createdAt, user: publicUser(by) }); continue; }
      const goal = ng.get(String(n.goalId));
      if (!by || !goal) continue;
      items.push({ id: `nudge:${n._id}`, type: 'nudge', at: n.createdAt, user: publicUser(by), goal: { id: String(goal._id), title: goal.title, challenge: Boolean(goal.shared?.endsAt) } });
    }

    const invites = await Goal.find({ 'shared.invited': me._id, archivedAt: null }).lean();
    const owners = await User.find({ _id: { $in: invites.map((g) => g.ownerId) } }).lean();
    const ow = new Map(owners.map((u) => [String(u._id), u]));
    for (const g of invites) {
      items.push({ id: `invite:${g._id}`, type: 'invite', at: g.updatedAt, user: publicUser(ow.get(String(g.ownerId))), goal: { id: String(g._id), title: g.title, mode: g.shared.mode } });
    }
  }

  if (me.prefs.notify.social) {
    const mine = await Post.find({ userId: me._id, updatedAt: { $gte: since } }).lean();
    const reactorIds = mine.flatMap((p) => p.reactions.filter((r) => String(r.userId) !== String(me._id) && r.at >= since).map((r) => r.userId));
    const comments = await Comment.find({ postId: { $in: mine.map((p) => p._id) }, userId: { $ne: me._id }, createdAt: { $gte: since } }).lean();
    const people = await User.find({ _id: { $in: [...reactorIds, ...comments.map((c) => c.userId)] } }).lean();
    const pu = new Map(people.map((u) => [String(u._id), u]));
    for (const p of mine) {
      for (const r of p.reactions) {
        if (String(r.userId) === String(me._id) || !(r.at >= since) || !pu.get(String(r.userId))) continue;
        items.push({ id: `boa:${p._id}:${r.userId}`, type: 'reaction', at: r.at, user: publicUser(pu.get(String(r.userId))), post: { id: String(p._id), title: p.title } });
      }
    }
    for (const c of comments) {
      if (!pu.get(String(c.userId))) continue;
      items.push({ id: `comment:${c._id}`, type: 'comment', at: c.createdAt, user: publicUser(pu.get(String(c.userId))), text: c.text, post: { id: String(c.postId) } });
    }

    // Marcações em posts ("treinei com @fulano")
    const taggedIn = await Post.find({ tags: me._id, userId: { $ne: me._id }, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(20).lean();
    const tUsers = new Map((await User.find({ _id: { $in: taggedIn.map((p) => p.userId) } }).lean()).map((u) => [String(u._id), u]));
    for (const p of taggedIn) {
      const by = tUsers.get(String(p.userId));
      if (by) items.push({ id: `tag:${p._id}`, type: 'tag', at: p.createdAt, user: publicUser(by), text: p.text, post: { id: String(p._id) } });
    }

    // Menções em comentários de posts de outras pessoas (no próprio post já chega como "comentou")
    const mentions = await Comment.find({ mentions: me._id, userId: { $ne: me._id }, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(30).lean();
    const mPosts = new Map((await Post.find({ _id: { $in: mentions.map((c) => c.postId) } }, { userId: 1 }).lean()).map((p) => [String(p._id), p]));
    const mUsers = new Map((await User.find({ _id: { $in: [...mentions.map((c) => c.userId), ...[...mPosts.values()].map((p) => p.userId)] } }).lean()).map((u) => [String(u._id), u]));
    for (const c of mentions) {
      const p = mPosts.get(String(c.postId));
      const by = mUsers.get(String(c.userId));
      if (!p || !by || String(p.userId) === String(me._id)) continue;
      items.push({ id: `mention:${c._id}`, type: 'mention', at: c.createdAt, user: publicUser(by), text: c.text, post: { id: String(c.postId), author: mUsers.get(String(p.userId))?.username || null } });
    }
  }

  if (me.prefs.notify.checkin && req.localTime && req.localTime >= me.prefs.reminderTime) {
    const goals = await userGoals(me, req.today);
    const left = goals.filter((g) => g.status.activeToday && g.kind !== 'project' && !g.status.periodDone);
    if (left.length) {
      const [h, m] = me.prefs.reminderTime.split(':').map(Number);
      const at = new Date(`${req.today}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
      items.push({ id: `reminder:${req.today}`, type: 'reminder', at, count: left.length, titles: left.slice(0, 3).map((g) => g.title) });
    }
  }

  items.sort((a, b) => new Date(b.at) - new Date(a.at));
  const unread = items.filter((i) => i.type === 'reminder' ? me.notificationsSeenAt.toISOString().slice(0, 10) < req.today : new Date(i.at) > me.notificationsSeenAt).length;
  res.json({ items: items.slice(0, 50), unread });
});
