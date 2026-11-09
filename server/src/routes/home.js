import { Router } from 'express';
import { Goal, Post, User, Follow, Comment, Club, Membership } from '../models/index.js';
import { friendIds, publicUser } from '../services/social.js';
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
