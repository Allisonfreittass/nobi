import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, Goal, Checkin, Post, Comment, Follow, Achievement, Streak, XpGrant } from '../models/index.js';
import { bad, HttpError, pick } from '../lib/http.js';
import { streakSummary, profileStats } from '../services/progress.js';
import { currentSeason, seasonInfo } from '../services/seasons.js';
import { CATALOG } from '../services/achievements.js';
import { publicUser } from '../services/social.js';

export const me = Router();

export async function meView(user, today) {
  const [summary, season] = await Promise.all([streakSummary(user, today), currentSeason(today)]);
  return {
    ...publicUser(user),
    email: user.email || null,
    hasPassword: Boolean(user.passwordHash),
    bio: user.bio,
    interests: user.interests,
    xp: user.xp,
    levelProgress: (user.xp % 100) / 100,
    privacy: user.privacy,
    prefs: user.prefs,
    stage: summary.stage,
    golden: summary.golden,
    maxActiveDays: summary.maxActiveDays,
    season: seasonInfo(season, today),
  };
}

export async function achievementsView(userId) {
  const mine = await Achievement.find({ userId }).lean();
  const got = new Map(mine.map((a) => [a.code, a.earnedAt]));
  return {
    earned: mine.length,
    total: CATALOG.length,
    items: CATALOG.map((a) => ({ ...a, earnedAt: got.get(a.code) || null })),
  };
}

me.get('/', async (req, res) => res.json(await meView(req.user, req.today)));

me.patch('/', async (req, res) => {
  const b = req.body || {};
  const u = req.user;
  if (b.name !== undefined) {
    if (!String(b.name).trim()) throw bad('O nome não pode ficar vazio.');
    u.name = String(b.name).trim().slice(0, 60);
  }
  if (b.username !== undefined) {
    const name = String(b.username).toLowerCase().trim();
    if (!/^[a-z0-9_.]{3,24}$/.test(name)) throw bad('Use de 3 a 24 letras, números, ponto ou _.');
    if (name !== u.username && (await User.exists({ username: name }))) throw new HttpError(409, 'Esse @ já está em uso.');
    u.username = name;
  }
  if (b.bio !== undefined) u.bio = String(b.bio).slice(0, 120);
  if (Array.isArray(b.interests)) u.interests = b.interests.map(String).slice(0, 12);
  if (b.avatarUrl !== undefined) {
    const a = String(b.avatarUrl);
    if (a && a !== 'broto' && !/^data:image\/(png|jpeg|webp);base64,/.test(a)) throw bad('Imagem inválida.');
    if (a.length > 400000) throw bad('Imagem grande demais.');
    u.avatarUrl = a;
  }
  if (b.privacy) Object.assign(u.privacy, pick(b.privacy, ['profile', 'approveFollowers', 'stats']));
  if (b.prefs) {
    Object.assign(u.prefs, pick(b.prefs, ['theme', 'weekStart', 'mascotMotion', 'reminderTime']));
    if (b.prefs.notify) Object.assign(u.prefs.notify, pick(b.prefs.notify, ['checkin', 'social', 'challenges']));
  }
  await u.save();
  // Quem deixa de exigir aprovação aceita os pedidos pendentes
  if (b.privacy?.approveFollowers === false) await Follow.updateMany({ followeeId: u._id, status: 'pending' }, { status: 'accepted' });
  res.json(await meView(u, req.today));
});

me.patch('/account', async (req, res) => {
  const { currentPassword, email, newPassword } = req.body || {};
  const u = req.user;
  if (u.passwordHash && !(await bcrypt.compare(String(currentPassword || ''), u.passwordHash))) {
    throw new HttpError(401, 'Senha atual não confere.');
  }
  if (email !== undefined && email !== u.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('E-mail inválido.');
    if (await User.exists({ email: email.toLowerCase(), _id: { $ne: u._id } })) throw new HttpError(409, 'Esse e-mail já tem conta.');
    u.email = email;
  }
  if (newPassword) {
    if (newPassword.length < 8) throw bad('A nova senha precisa ter pelo menos 8 caracteres.');
    u.passwordHash = await bcrypt.hash(newPassword, 10);
  }
  await u.save();
  res.json(await meView(u, req.today));
});

me.get('/stats', async (req, res) => res.json(await profileStats(req.user, req.today)));
me.get('/achievements', async (req, res) => res.json(await achievementsView(req.user._id)));

me.get('/blocked', async (req, res) => {
  const users = await User.find({ _id: { $in: req.user.blocked } }).lean();
  res.json(users.map(publicUser));
});

me.delete('/blocked/:id', async (req, res) => {
  req.user.blocked = req.user.blocked.filter((id) => String(id) !== req.params.id);
  await req.user.save();
  res.json({ ok: true });
});

me.post('/notifications/seen', async (req, res) => {
  req.user.notificationsSeenAt = new Date();
  await req.user.save();
  res.json({ ok: true });
});

me.get('/export', async (req, res) => {
  const id = req.user._id;
  const [goals, checkins, posts, comments, follows, achievements] = await Promise.all([
    Goal.find({ $or: [{ ownerId: id }, { 'shared.participants': id }] }).lean(),
    Checkin.find({ userId: id }).lean(),
    Post.find({ userId: id }).lean(),
    Comment.find({ userId: id }).lean(),
    Follow.find({ $or: [{ followerId: id }, { followeeId: id }] }).lean(),
    Achievement.find({ userId: id }).lean(),
  ]);
  const { passwordHash, resetToken, resetTokenExpiresAt, ...profile } = req.user.toObject();
  res.setHeader('Content-Disposition', `attachment; filename="nobi-${req.user.username}.json"`);
  res.json({ exportedAt: new Date(), profile, goals, checkins, posts, comments, follows, achievements });
});

me.delete('/', async (req, res) => {
  const id = req.user._id;
  const { password } = req.body || {};
  if (req.user.passwordHash && !(await bcrypt.compare(String(password || ''), req.user.passwordHash))) {
    throw new HttpError(401, 'Senha não confere.');
  }
  const posts = await Post.find({ userId: id }, { _id: 1 }).lean();
  await Promise.all([
    Goal.deleteMany({ ownerId: id, shared: null }),
    Goal.updateMany({ 'shared.participants': id }, { $pull: { 'shared.participants': id, 'shared.invited': id } }),
    Goal.updateMany({ 'shared.invited': id }, { $pull: { 'shared.invited': id } }),
    Checkin.deleteMany({ userId: id }),
    Streak.deleteMany({ userId: id }),
    Comment.deleteMany({ $or: [{ userId: id }, { postId: { $in: posts.map((p) => p._id) } }] }),
    Post.deleteMany({ userId: id }),
    Post.updateMany({ 'reactions.userId': id }, { $pull: { reactions: { userId: id } } }),
    Follow.deleteMany({ $or: [{ followerId: id }, { followeeId: id }] }),
    Achievement.deleteMany({ userId: id }),
    XpGrant.deleteMany({ userId: id }),
    User.updateMany({ blocked: id }, { $pull: { blocked: id } }),
  ]);
  // Objetivos com amigos: passa a posse para quem ficou; apaga os que ficaram sem ninguém
  for (const g of await Goal.find({ ownerId: id, shared: { $ne: null } })) {
    if (g.shared.participants.length) await Goal.updateOne({ _id: g._id }, { ownerId: g.shared.participants[0] });
  }
  await Goal.deleteMany({ shared: { $ne: null }, 'shared.participants.0': { $exists: false } });
  await User.deleteOne({ _id: id });
  res.json({ ok: true });
});
