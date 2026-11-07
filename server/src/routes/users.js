import { Router } from 'express';
import mongoose from 'mongoose';
import { User, Follow, Post, Goal } from '../models/index.js';
import { bad, notFound } from '../lib/http.js';
import { relation, allowed, publicUser, blockedIds, followingIds } from '../services/social.js';
import { streakSummary, profileStats } from '../services/progress.js';
import { currentSeason, seasonInfo } from '../services/seasons.js';
import { achievementsView } from './me.js';
import { hydratePosts } from './posts.js';
import { notify } from '../services/push.js';
import { social } from '../services/pushMessages.js';

export const users = Router();

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

users.get('/check-username', async (req, res) => {
  const u = String(req.query.u || '').toLowerCase().trim();
  if (!/^[a-z0-9_.]{3,24}$/.test(u)) return res.json({ valid: false, available: false });
  const taken = await User.exists({ username: u, _id: { $ne: req.user._id } });
  res.json({ valid: true, available: !taken });
});

users.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 40);
  if (q.length < 2) return res.json([]);
  const blocked = await blockedIds(req.user._id);
  const re = new RegExp(escapeRe(q), 'i');
  const found = await User.find({ $or: [{ name: re }, { username: re }], _id: { $ne: req.user._id, $nin: blocked }, demo: { $ne: true } }).limit(20).lean();
  res.json(await withRelation(req.user._id, found));
});

users.get('/suggestions', async (req, res) => {
  const [following, blocked] = await Promise.all([followingIds(req.user._id), blockedIds(req.user._id)]);
  const exclude = [req.user._id, ...following, ...blocked];
  const pending = await Follow.find({ followerId: req.user._id }, { followeeId: 1 }).lean();
  exclude.push(...pending.map((p) => p.followeeId));
  // Quem me segue e eu não sigo de volta vem primeiro; depois perfis públicos com interesses em comum
  const demoIds = (await User.find({ demo: true }, { _id: 1 }).lean()).map((u) => u._id);
  exclude.push(...demoIds);
  const followers = await Follow.find({ followeeId: req.user._id, status: 'accepted', followerId: { $nin: exclude } }).limit(10).lean();
  const others = await User.find({
    _id: { $nin: [...exclude, ...followers.map((f) => f.followerId)] },
    'privacy.profile': 'public',
    ...(req.user.interests.length ? { interests: { $in: req.user.interests } } : {}),
  }).limit(10).lean();
  const back = await User.find({ _id: { $in: followers.map((f) => f.followerId) } }).lean();
  res.json(await withRelation(req.user._id, [...back, ...others]));
});

async function withRelation(meId, list) {
  return Promise.all(list.map(async (u) => ({ ...publicUser(u), bio: u.bio, relation: await relation(meId, u._id) })));
}

users.get('/follow-requests', async (req, res) => {
  const reqs = await Follow.find({ followeeId: req.user._id, status: 'pending' }).sort({ createdAt: -1 }).lean();
  const people = await User.find({ _id: { $in: reqs.map((r) => r.followerId) } }).lean();
  const by = new Map(people.map((p) => [String(p._id), p]));
  res.json(reqs.map((r) => ({ id: String(r._id), user: publicUser(by.get(String(r.followerId))), at: r.createdAt })).filter((r) => r.user));
});

users.post('/follow-requests/:id/:action', async (req, res) => {
  const f = await Follow.findOne({ _id: req.params.id, followeeId: req.user._id, status: 'pending' });
  if (!f) throw notFound();
  if (req.params.action === 'accept') { f.status = 'accepted'; await f.save(); }
  else if (req.params.action === 'decline') await f.deleteOne();
  else throw bad('Ação inválida.');
  res.json({ ok: true });
});

async function findUser(param) {
  const q = mongoose.isValidObjectId(param) ? { $or: [{ _id: param }, { username: param }] } : { username: String(param).toLowerCase() };
  const u = await User.findOne(q);
  if (!u) throw notFound('Perfil não encontrado.');
  return u;
}

users.get('/:username', async (req, res) => {
  const u = await findUser(req.params.username);
  if ((await blockedIds(req.user._id)).includes(String(u._id))) throw notFound('Perfil não encontrado.');
  const rel = await relation(req.user._id, u._id);
  const canProfile = allowed(rel, u.privacy.profile);
  const canStats = canProfile && allowed(rel, u.privacy.stats);
  const [summary, season, followers, following] = await Promise.all([
    streakSummary(u, req.today),
    currentSeason(req.today),
    Follow.countDocuments({ followeeId: u._id, status: 'accepted' }),
    Follow.countDocuments({ followerId: u._id, status: 'accepted' }),
  ]);
  const out = {
    ...publicUser(u),
    bio: canProfile ? u.bio : '',
    interests: canProfile ? u.interests : [],
    relation: rel,
    canSeeProfile: canProfile,
    canSeeStats: canStats,
    statsAudience: u.privacy.stats,
    stage: summary.stage,
    golden: summary.golden,
    followers,
    following,
    season: seasonInfo(season, req.today),
  };
  if (canStats) {
    out.stats = await profileStats(u, req.today);
    out.achievements = await achievementsView(u._id);
  }
  res.json(out);
});

users.get('/:username/posts', async (req, res) => {
  const u = await findUser(req.params.username);
  const rel = await relation(req.user._id, u._id);
  if (!allowed(rel, u.privacy.profile) || (await blockedIds(req.user._id)).includes(String(u._id))) return res.json([]);
  const audience = rel.self || rel.friends ? ['friends', 'public'] : ['public'];
  const posts = await Post.find({ userId: u._id, audience: { $in: audience } }).sort({ createdAt: -1 }).limit(30).lean();
  res.json(await hydratePosts(posts, req.user._id));
});

users.post('/:id/follow', async (req, res) => {
  const target = await findUser(req.params.id);
  if (String(target._id) === String(req.user._id)) throw bad('Você não pode seguir você.');
  if ((await blockedIds(req.user._id)).includes(String(target._id))) throw notFound('Perfil não encontrado.');
  const status = target.privacy.approveFollowers ? 'pending' : 'accepted';
  await Follow.updateOne(
    { followerId: req.user._id, followeeId: target._id },
    { $setOnInsert: { status } },
    { upsert: true },
  );
  if (status === 'pending') await notify(target._id, { ...social.followRequest(req.user.name), url: '/notificacoes' }, { type: 'social', dedupeKey: `social:fr:${req.user._id}` });
  res.json({ relation: await relation(req.user._id, target._id) });
});

// Quem convida já escolheu: aceitar o convite cria a amizade nos dois sentidos
users.post('/:username/invite', async (req, res) => {
  const inviter = await findUser(req.params.username);
  if (String(inviter._id) === String(req.user._id)) return res.json({ relation: await relation(req.user._id, inviter._id), self: true });
  if ((await blockedIds(req.user._id)).includes(String(inviter._id))) throw notFound('Convite não encontrado.');
  for (const [a, b] of [[req.user._id, inviter._id], [inviter._id, req.user._id]]) {
    await Follow.updateOne({ followerId: a, followeeId: b }, { $set: { status: 'accepted' } }, { upsert: true });
  }
  await notify(inviter._id, { ...social.inviteJoined(req.user.name), url: `/u/${req.user.username}` }, { type: 'social', dedupeKey: `social:ij:${req.user._id}` });
  res.json({ relation: await relation(req.user._id, inviter._id), inviter: publicUser(inviter) });
});

users.delete('/:id/follow', async (req, res) => {
  const target = await findUser(req.params.id);
  await Follow.deleteOne({ followerId: req.user._id, followeeId: target._id });
  res.json({ relation: await relation(req.user._id, target._id) });
});

users.post('/:id/block', async (req, res) => {
  const target = await findUser(req.params.id);
  if (String(target._id) === String(req.user._id)) throw bad('Você não pode bloquear você.');
  if (!req.user.blocked.some((b) => String(b) === String(target._id))) req.user.blocked.push(target._id);
  await req.user.save();
  await Follow.deleteMany({ $or: [{ followerId: req.user._id, followeeId: target._id }, { followerId: target._id, followeeId: req.user._id }] });
  await Goal.updateMany({ ownerId: req.user._id, 'shared.invited': target._id }, { $pull: { 'shared.invited': target._id } });
  res.json({ ok: true });
});
