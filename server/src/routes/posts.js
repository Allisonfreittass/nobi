import { Router } from 'express';
import { Post, Comment, Checkin, Goal, User } from '../models/index.js';
import { bad, notFound, forbidden } from '../lib/http.js';
import { addDays } from '../lib/dates.js';
import { friendIds, followingIds, blockedIds, publicUser, relation, allowed } from '../services/social.js';
import { award } from '../services/achievements.js';
import { computeStreak } from '../services/streaks.js';
import { weekStartsOn } from '../services/progress.js';
import { isOurImage, deleteImages } from '../services/storage.js';
import { notify } from '../services/push.js';
import { social } from '../services/pushMessages.js';

export const posts = Router();

const AUDIENCES = ['friends', 'public'];
const UNIT_WORD = { treino: 'treino', leitura: 'leitura', estudo: 'estudo', habito: 'hábito', objetivo: 'objetivo', projeto: 'projeto' };

/** Junta autor, objetivo e o estado das reações para a tela. */
export async function hydratePosts(list, meId) {
  const userIds = [...new Set(list.map((p) => String(p.userId)))];
  const reactorIds = [...new Set(list.flatMap((p) => p.reactions.map((r) => String(r.userId))))];
  const [authors, reactors, goalsList] = await Promise.all([
    User.find({ _id: { $in: userIds } }).lean(),
    User.find({ _id: { $in: reactorIds } }, { name: 1 }).lean(),
    Goal.find({ _id: { $in: list.map((p) => p.goalId).filter(Boolean) } }, { title: 1 }).lean(),
  ]);
  const a = new Map(authors.map((u) => [String(u._id), u]));
  const r = new Map(reactors.map((u) => [String(u._id), u.name.split(' ')[0]]));
  const g = new Map(goalsList.map((x) => [String(x._id), x.title]));
  return list.map((p) => {
    const others = p.reactions.filter((x) => String(x.userId) !== String(meId));
    return {
      id: String(p._id),
      user: publicUser(a.get(String(p.userId))),
      mine: String(p.userId) === String(meId),
      audience: p.audience,
      kind: p.kind,
      category: p.category,
      title: p.title,
      goalTitle: g.get(String(p.goalId)) || null,
      metrics: p.metrics || {},
      text: p.text,
      photo: p.photo || null,
      reactionsCount: p.reactions.length,
      reacted: p.reactions.some((x) => String(x.userId) === String(meId)),
      reactorNames: others.slice(-2).map((x) => r.get(String(x.userId))).filter(Boolean),
      commentsCount: p.commentsCount,
      createdAt: p.createdAt,
    };
  }).filter((p) => p.user);
}

/** Variação de minutos (ou valor) deste objetivo no mês, contra o mesmo trecho do mês anterior. */
async function deltaVsLastMonth(goalId, userId, today) {
  const month = today.slice(0, 7);
  const lastMonth = addDays(`${month}-01`, -1).slice(0, 7);
  const day = today.slice(8, 10);
  const rows = await Checkin.find({ goalId, userId, date: { $gte: `${lastMonth}-01`, $lte: today } }).lean();
  const sum = (from, to) => rows.filter((c) => c.date >= from && c.date <= to).reduce((s, c) => s + (c.minutes || c.value || 0), 0);
  const now = sum(`${month}-01`, today);
  const before = sum(`${lastMonth}-01`, `${lastMonth}-${day}`);
  return before > 0 ? Math.round(((now - before) / before) * 100) : null;
}

// Postar é sempre uma escolha do usuário, feita no momento (DESIGN.md §8.1–8.2).
posts.post('/', async (req, res) => {
  const b = req.body || {};
  if (!AUDIENCES.includes(b.audience)) throw bad('Escolha Amigos ou Público.');
  const text = String(b.text || '').slice(0, 500);
  let photo = null;
  if (b.photo) {
    if (!isOurImage(b.photo.url)) throw bad('Foto inválida.');
    const dim = (n) => Math.min(10000, Math.max(1, Math.round(Number(n) || 1)));
    photo = { url: b.photo.url, w: dim(b.photo.w), h: dim(b.photo.h) };
  }
  let goal = null;
  let checkin = null;
  if (b.checkinId) {
    checkin = await Checkin.findOne({ _id: b.checkinId, userId: req.user._id }).lean();
    if (!checkin) throw notFound('Registro não encontrado.');
    goal = await Goal.findById(checkin.goalId).lean();
  } else if (b.goalId) {
    goal = await Goal.findById(b.goalId).lean();
  }
  if (!goal) throw bad('Escolha o que compartilhar.');
  const member = String(goal.ownerId) === String(req.user._id) || goal.shared?.participants?.some((p) => String(p) === String(req.user._id));
  if (!member) throw forbidden();

  const mine = await Checkin.find({ goalId: goal._id, userId: req.user._id }).lean();
  const streak = computeStreak(goal, mine, req.today, weekStartsOn(req.user));
  const metrics = { streak: streak.current, streakUnit: streak.unit };
  let kind = 'checkin';
  let title = '';
  if (checkin) {
    if (checkin.minutes) metrics.minutes = checkin.minutes;
    if (checkin.pages) metrics.pages = checkin.pages;
    if (checkin.km) {
      metrics.km = checkin.km;
      const prevMax = Math.max(0, ...mine.filter((c) => String(c._id) !== String(checkin._id)).map((c) => c.km || 0));
      if (prevMax > 0 && checkin.km > prevMax) { kind = 'record'; title = 'Recorde'; }
    }
    metrics.deltaVsLastMonth = await deltaVsLastMonth(goal._id, req.user._id, req.today);
  }
  if (b.start) {
    // "Fulano começou a meditar": só com o objetivo recém-criado e uma vez
    kind = 'start';
    title = `Começou: ${goal.title}`;
    if (await Post.exists({ goalId: goal._id, userId: req.user._id, kind: 'start' })) throw bad('Você já contou que começou.');
  } else if (b.celebration?.kind === 'streak') {
    kind = 'milestone';
    const n = Number(b.celebration.count) || streak.current;
    title = `${n} ${streak.unit === 'weeks' ? 'semanas' : 'dias'} seguidos de ${UNIT_WORD[goal.category]}`;
  } else if (b.celebration?.kind === 'milestone') {
    kind = 'milestone';
    title = `Marco: ${String(b.celebration.title || '').slice(0, 80)}`;
  }
  const post = await Post.create({
    userId: req.user._id, goalId: goal._id, checkinId: checkin?._id, audience: b.audience,
    kind, category: goal.category, title, metrics, text, photo, date: req.today,
  });
  const earned = await award(req.user._id, 'primeiro-post');
  if (kind === 'milestone' && title) {
    const friends = await friendIds(req.user._id);
    await Promise.all(friends.slice(0, 50).map((f) => notify(f, { ...social.friendMilestone(req.user.name, title), url: `/u/${req.user.username}` }, { type: 'social', dedupeKey: `social:fm:${post._id}` })));
  }
  const [view] = await hydratePosts([post.toObject()], req.user._id);
  res.status(201).json({ post: view, achievements: earned ? [earned] : [] });
});

posts.delete('/:id', async (req, res) => {
  const p = await Post.findOne({ _id: req.params.id, userId: req.user._id });
  if (!p) throw notFound();
  await Comment.deleteMany({ postId: p._id });
  await p.deleteOne();
  if (p.photo?.url) await deleteImages([p.photo.url]);
  res.json({ ok: true });
});

async function visiblePost(id, meId) {
  const p = await Post.findById(id);
  if (!p) throw notFound('Post não encontrado.');
  if ((await blockedIds(meId)).includes(String(p.userId))) throw notFound('Post não encontrado.');
  const rel = await relation(meId, p.userId);
  if (!allowed(rel, p.audience)) throw notFound('Post não encontrado.');
  return p;
}

posts.post('/:id/react', async (req, res) => {
  const p = await visiblePost(req.params.id, req.user._id);
  const i = p.reactions.findIndex((r) => String(r.userId) === String(req.user._id));
  if (i >= 0) p.reactions.splice(i, 1);
  else p.reactions.push({ userId: req.user._id, type: 'boa' });
  await p.save();
  if (i < 0) {
    const [received] = await Post.aggregate([{ $match: { userId: p.userId } }, { $project: { n: { $size: '$reactions' } } }, { $group: { _id: null, n: { $sum: '$n' } } }]);
    if ((received?.n || 0) >= 10) await award(p.userId, 'boa-10');
    if (String(p.userId) !== String(req.user._id)) {
      const hour = new Date().toISOString().slice(0, 13);
      const goalTitle = p.goalId ? (await Goal.findById(p.goalId, { title: 1 }).lean())?.title : null;
      await notify(p.userId, { ...social.reaction(req.user.name, p.reactions.length, p.title || goalTitle), url: `/u/${(await User.findById(p.userId, { username: 1 }).lean())?.username || ''}` }, { type: 'social', dedupeKey: `social:boa:${p._id}:${hour}` });
    }
    const given = await Post.countDocuments({ 'reactions.userId': req.user._id, userId: { $ne: req.user._id } });
    if (given >= 10) await award(req.user._id, 'torcida');
  }
  const [view] = await hydratePosts([p.toObject()], req.user._id);
  res.json(view);
});

posts.get('/:id/comments', async (req, res) => {
  const p = await visiblePost(req.params.id, req.user._id);
  const list = await Comment.find({ postId: p._id }).sort({ createdAt: 1 }).limit(100).lean();
  const people = await User.find({ _id: { $in: list.map((c) => c.userId) } }).lean();
  const by = new Map(people.map((u) => [String(u._id), u]));
  res.json(list.map((c) => ({ id: String(c._id), text: c.text, createdAt: c.createdAt, user: publicUser(by.get(String(c.userId))), mine: String(c.userId) === String(req.user._id) })).filter((c) => c.user));
});

posts.post('/:id/comments', async (req, res) => {
  const p = await visiblePost(req.params.id, req.user._id);
  const text = String(req.body?.text || '').trim();
  if (!text) throw bad('Escreva algo.');
  const c = await Comment.create({ postId: p._id, userId: req.user._id, text: text.slice(0, 280) });
  await Post.updateOne({ _id: p._id }, { $inc: { commentsCount: 1 } });
  if (String(p.userId) !== String(req.user._id)) {
    await notify(p.userId, { ...social.comment(req.user.name, c.text), url: '/notificacoes' }, { type: 'social', dedupeKey: `social:comment:${c._id}` });
  }
  res.status(201).json({ id: String(c._id), text: c.text, createdAt: c.createdAt, user: publicUser(req.user), mine: true });
});

posts.delete('/:id/comments/:cid', async (req, res) => {
  const c = await Comment.findOne({ _id: req.params.cid, postId: req.params.id });
  if (!c) throw notFound();
  const p = await Post.findById(req.params.id);
  if (String(c.userId) !== String(req.user._id) && String(p?.userId) !== String(req.user._id)) throw forbidden();
  await c.deleteOne();
  await Post.updateOne({ _id: req.params.id }, { $inc: { commentsCount: -1 } });
  res.json({ ok: true });
});

export const feed = Router();

/** Feed: meus posts, de amigos (Amigos ou Público) e de quem eu sigo (só Público). */
feed.get('/', async (req, res) => {
  const me = req.user._id;
  const [friends, following, blocked] = await Promise.all([friendIds(me), followingIds(me), blockedIds(me)]);
  const q = {
    userId: { $nin: blocked },
    $or: [{ userId: me }, { userId: { $in: friends } }, { userId: { $in: following }, audience: 'public' }],
  };
  if (req.query.before) q.createdAt = { $lt: new Date(String(req.query.before)) };
  const list = await Post.find(q).sort({ createdAt: -1 }).limit(20).lean();
  res.json({ posts: await hydratePosts(list, me), next: list.length === 20 ? list[list.length - 1].createdAt : null });
});

/** Explorar: posts públicos de quem eu ainda não acompanho. */
feed.get('/explore', async (req, res) => {
  const me = req.user._id;
  const [following, blocked] = await Promise.all([followingIds(me), blockedIds(me)]);
  const publicUsers = await User.find({ 'privacy.profile': 'public', demo: { $ne: true }, _id: { $nin: [me, ...following, ...blocked] } }, { _id: 1 }).lean();
  const list = await Post.find({ audience: 'public', userId: { $in: publicUsers.map((u) => u._id) } }).sort({ createdAt: -1 }).limit(30).lean();
  res.json(await hydratePosts(list, me));
});
