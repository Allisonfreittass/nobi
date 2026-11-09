// Moderação da Equipe Nobi: denúncias de todo o app, clubes novos e contas suspensas.
import { Router } from 'express';
import mongoose from 'mongoose';
import { Report, Post, Comment, User, Club, Membership, ClubMessage } from '../models/index.js';
import { bad, notFound } from '../lib/http.js';
import { publicUser } from '../services/social.js';
import { clubSummary } from '../services/clubs.js';
import { hydratePosts } from './posts.js';
import { deleteImages } from '../services/storage.js';

export const admin = Router();

const REASON_ORDER = ['assedio', 'improprio', 'falso', 'spam', 'outro'];

async function deletePost(id) {
  const p = await Post.findById(id);
  if (!p) return;
  await Comment.deleteMany({ postId: p._id });
  await p.deleteOne();
  if (p.photo?.url) await deleteImages([p.photo.url]).catch(() => {});
}
async function deleteClub(id) {
  const c = await Club.findById(id);
  if (!c) return;
  await Promise.all([Membership.deleteMany({ clubId: c._id }), Post.updateMany({ clubIds: c._id }, { $pull: { clubIds: c._id } }), c.deleteOne()]);
}
async function suspend(userId, reason) {
  const now = new Date();
  await User.updateOne({ _id: userId }, { $set: { suspendedAt: now, suspendedReason: String(reason || '').slice(0, 200), sessionsValidAfter: now } });
}

/** Um alvo pode ter várias denúncias: agrupa e mostra o conteúdo denunciado. */
admin.get('/reports', async (req, res) => {
  const status = req.query.status === 'done' ? 'done' : 'open';
  const rows = await Report.find({ status }).sort({ updatedAt: -1 }).limit(300).lean();
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.targetType}:${r.targetId}`;
    const g = groups.get(k) || { key: k, targetType: r.targetType, targetId: String(r.targetId), reports: [], reasons: {}, lastAt: r.updatedAt || r.createdAt, resolution: r.resolution };
    g.reports.push({ id: String(r._id), reason: r.reason, details: r.details, createdAt: r.createdAt, clubId: r.clubId ? String(r.clubId) : null });
    g.reasons[r.reason] = (g.reasons[r.reason] || 0) + 1;
    groups.set(k, g);
  }
  const list = [...groups.values()];
  const ids = (t) => list.filter((g) => g.targetType === t).map((g) => g.targetId).filter((id) => mongoose.isValidObjectId(id));
  const messages = await ClubMessage.find({ _id: { $in: ids('message') } }).lean();
  const messageAuthors = new Map((await User.find({ _id: { $in: messages.map((x) => x.userId) } }).lean()).map((u) => [String(u._id), u]));
  const messageClubs = new Map((await Club.find({ _id: { $in: messages.map((x) => x.clubId) } }, { name: 1, slug: 1 }).lean()).map((c) => [String(c._id), c]));
  const [posts, users, comments, clubs] = await Promise.all([
    Post.find({ _id: { $in: ids('post') } }).lean(),
    User.find({ _id: { $in: ids('user') } }).lean(),
    Comment.find({ _id: { $in: ids('comment') } }).lean(),
    Club.find({ _id: { $in: ids('club') } }).lean(),
  ]);
  const hp = new Map((await hydratePosts(posts.map((p) => ({ ...p })), req.user._id)).map((p) => [p.id, p]));
  // Autor suspenso some de hydratePosts; aqui a moderação ainda precisa ver o post
  for (const p of posts) if (!hp.has(String(p._id))) hp.set(String(p._id), { id: String(p._id), text: p.text, title: p.title, category: p.category, user: null, userId: String(p.userId) });
  const commentAuthors = new Map((await User.find({ _id: { $in: comments.map((c) => c.userId) } }).lean()).map((u) => [String(u._id), u]));
  const userCounts = new Map(await Promise.all(users.map(async (u) => [String(u._id), { posts: await Post.countDocuments({ userId: u._id }), reportsAgainst: await Report.countDocuments({ targetType: 'user', targetId: u._id }) }])));
  const out = await Promise.all(list.map(async (g) => {
    const id = g.targetId;
    let target = null;
    if (g.targetType === 'post' && hp.get(id)) target = { post: hp.get(id) };
    if (g.targetType === 'user') {
      const u = users.find((x) => String(x._id) === id);
      if (u) target = { user: { ...publicUser(u), bio: u.bio, suspendedAt: u.suspendedAt, createdAt: u.createdAt, ...userCounts.get(id) } };
    }
    if (g.targetType === 'comment') {
      const c = comments.find((x) => String(x._id) === id);
      if (c) target = { comment: { id, text: c.text, postId: String(c.postId), user: publicUser(commentAuthors.get(String(c.userId))) } };
    }
    if (g.targetType === 'message') {
      const x = messages.find((y) => String(y._id) === id);
      if (x && !x.deletedAt) target = { message: { id, text: x.text, user: publicUser(messageAuthors.get(String(x.userId))), club: messageClubs.get(String(x.clubId)) ? { name: messageClubs.get(String(x.clubId)).name, slug: messageClubs.get(String(x.clubId)).slug } : null } };
    }
    if (g.targetType === 'club') {
      const c = clubs.find((x) => String(x._id) === id);
      if (c) target = { club: { ...(await clubSummary(c)), description: c.description, createdBy: String(c.createdBy || '') } };
    }
    const top = Object.keys(g.reasons).sort((a, b) => REASON_ORDER.indexOf(a) - REASON_ORDER.indexOf(b));
    return { ...g, count: g.reports.length, topReason: top[0], target, gone: !target };
  }));
  // Mais denunciado e mais grave primeiro
  out.sort((a, b) => b.count - a.count || REASON_ORDER.indexOf(a.topReason) - REASON_ORDER.indexOf(b.topReason) || new Date(b.lastAt) - new Date(a.lastAt));
  res.json(out);
});

/**
 * Resolve todas as denúncias de um alvo de uma vez.
 * action: keep | delete-post | delete-comment | delete-club | suspend
 */
admin.post('/reports/resolve', async (req, res) => {
  const { targetType, targetId, action } = req.body || {};
  if (!mongoose.isValidObjectId(targetId)) throw bad('Alvo inválido.');
  const allowed = { post: ['keep', 'delete-post', 'suspend'], comment: ['keep', 'delete-comment', 'suspend'], message: ['keep', 'delete-message', 'suspend'], user: ['keep', 'suspend'], club: ['keep', 'delete-club'] };
  if (!allowed[targetType]?.includes(action)) throw bad('Ação inválida.');
  let resolution = 'mantido';
  if (action === 'delete-post') { await deletePost(targetId); resolution = 'post apagado'; }
  if (action === 'delete-comment') {
    const c = await Comment.findById(targetId);
    if (c) { await c.deleteOne(); await Post.updateOne({ _id: c.postId }, { $inc: { commentsCount: -1 } }); }
    resolution = 'comentário apagado';
  }
  if (action === 'delete-message') {
    await ClubMessage.updateOne({ _id: targetId }, { $set: { deletedAt: new Date(), deletedBy: req.user._id } });
    resolution = 'mensagem apagada';
  }
  if (action === 'delete-club') {
    const c = await Club.findById(targetId).lean();
    if (c?.kind === 'official') throw bad('Clube oficial não se apaga por aqui.');
    await deleteClub(targetId);
    resolution = 'clube encerrado';
  }
  if (action === 'suspend') {
    let userId = targetId;
    if (targetType === 'post') userId = (await Post.findById(targetId).lean())?.userId;
    if (targetType === 'comment') userId = (await Comment.findById(targetId).lean())?.userId;
    if (targetType === 'message') userId = (await ClubMessage.findById(targetId).lean())?.userId;
    if (!userId) throw notFound('Conta não encontrada.');
    if (String(userId) === String(req.user._id)) throw bad('Você não pode suspender a própria conta.');
    await suspend(userId, req.body.reason || 'denúncias');
    resolution = 'conta suspensa';
    // As outras denúncias contra a mesma pessoa saem da fila junto
    await Report.updateMany({ targetType: 'user', targetId: userId, status: 'open' }, { $set: { status: 'done', resolution } });
  }
  await Report.updateMany({ targetType, targetId, status: 'open' }, { $set: { status: 'done', resolution } });
  res.json({ ok: true, resolution });
});

/** Clubes abertos criados pela comunidade, mais novos primeiro. */
admin.get('/clubs', async (req, res) => {
  const list = await Club.find({ kind: 'open' }).sort({ createdAt: -1 }).limit(100).lean();
  const creators = new Map((await User.find({ _id: { $in: list.map((c) => c.createdBy) } }).lean()).map((u) => [String(u._id), u]));
  res.json(await Promise.all(list.map(async (c) => ({
    ...(await clubSummary(c)), description: c.description, createdAt: c.createdAt,
    creator: publicUser(creators.get(String(c.createdBy))),
    openReports: await Report.countDocuments({ status: 'open', $or: [{ targetType: 'club', targetId: c._id }, { clubId: c._id }] }),
  }))));
});

admin.delete('/clubs/:id', async (req, res) => {
  const c = await Club.findById(req.params.id).lean();
  if (!c) throw notFound('Clube não encontrado.');
  if (c.kind === 'official') throw bad('Clube oficial não se apaga por aqui.');
  await deleteClub(c._id);
  await Report.updateMany({ targetType: 'club', targetId: c._id, status: 'open' }, { $set: { status: 'done', resolution: 'clube encerrado' } });
  res.json({ ok: true });
});

admin.get('/suspended', async (_req, res) => {
  const list = await User.find({ suspendedAt: { $ne: null } }).sort({ suspendedAt: -1 }).limit(100).lean();
  res.json(list.map((u) => ({ ...publicUser(u), suspendedAt: u.suspendedAt, reason: u.suspendedReason })));
});

admin.post('/users/:id/unsuspend', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  await User.updateOne({ _id: req.params.id }, { $set: { suspendedAt: null, suspendedReason: '' } });
  res.json({ ok: true });
});

admin.get('/summary', async (_req, res) => {
  const [openReports, newClubs, suspended] = await Promise.all([
    Report.countDocuments({ status: 'open' }),
    Club.countDocuments({ kind: 'open', createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
    User.countDocuments({ suspendedAt: { $ne: null } }),
  ]);
  res.json({ openReports, newClubs, suspended });
});
