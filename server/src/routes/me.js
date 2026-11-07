import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User, Goal, Checkin, Post, Comment, Follow, Achievement, Streak, XpGrant } from '../models/index.js';
import { bad, HttpError, pick } from '../lib/http.js';
import { streakSummary, profileStats } from '../services/progress.js';
import { currentSeason, seasonInfo } from '../services/seasons.js';
import { CATALOG } from '../services/achievements.js';
import { weeklySummary } from '../services/weekly.js';
import { ensureShields } from '../services/shields.js';
import { ShieldUse, Task, Membership, Report } from '../models/index.js';
import { publicUser } from '../services/social.js';
import { handOverClubs } from '../services/clubs.js';
import { decodeDataUrl, isOurImage, saveImage, deleteImages, deleteUserImages } from '../services/storage.js';

export const me = Router();

export async function meView(user, today) {
  const [summary, season] = await Promise.all([streakSummary(user, today), currentSeason(today)]);
  const sh = user._shields || (await ensureShields(user, today));
  return {
    ...publicUser(user),
    email: user.email || null,
    hasPassword: Boolean(user.passwordHash),
    bio: user.bio,
    interests: user.interests,
    city: user.city || '',
    xp: user.xp,
    levelProgress: (user.xp % 100) / 100,
    privacy: user.privacy,
    prefs: user.prefs,
    stage: summary.stage,
    golden: summary.golden,
    maxActiveDays: summary.maxActiveDays,
    season: seasonInfo(season, today),
    shields: {
      available: sh.available,
      max: sh.max,
      earnedTotal: sh.earnedTotal,
      newlyEarned: Math.max(0, sh.earnedTotal - (user.shieldsEarnedSeen || 0)),
      protectedDays: sh.unseen, // dias que um escudo protegeu e a pessoa ainda não viu
    },
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

me.get('/', async (req, res) => {
  // Fotos antigas ficavam dentro do banco: move para o armazenamento na primeira abertura
  if (req.user.avatarUrl?.startsWith('data:')) {
    try {
      req.user.avatarUrl = await saveImage(decodeDataUrl(req.user.avatarUrl), 'avatars', req.user._id);
      await req.user.save();
    } catch (e) { console.warn('[avatar] não migrou:', e.message); }
  }
  res.json(await meView(req.user, req.today));
});

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
  if (b.city !== undefined) u.city = String(b.city).trim().slice(0, 60);
  if (Array.isArray(b.interests)) u.interests = b.interests.map(String).slice(0, 12);
  const oldAvatar = u.avatarUrl;
  if (b.avatarUrl !== undefined) {
    let a = String(b.avatarUrl);
    if (a.startsWith('data:')) a = await saveImage(decodeDataUrl(a), 'avatars', u._id); // versões antigas do app
    if (a && a !== 'broto' && !isOurImage(a)) throw bad('Imagem inválida.');
    u.avatarUrl = a;
  }
  if (b.privacy) Object.assign(u.privacy, pick(b.privacy, ['profile', 'approveFollowers', 'stats']));
  if (b.prefs) {
    Object.assign(u.prefs, pick(b.prefs, ['theme', 'weekStart', 'mascotMotion', 'reminderTime']));
    if (b.prefs.notify) Object.assign(u.prefs.notify, pick(b.prefs.notify, ['checkin', 'social', 'challenges']));
  }
  await u.save();
  if (oldAvatar && oldAvatar !== u.avatarUrl) await deleteImages([oldAvatar]); // foto antiga não fica guardada
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
    u.emailVerified = false;
  }
  if (newPassword) {
    if (newPassword.length < 8) throw bad('A nova senha precisa ter pelo menos 8 caracteres.');
    u.passwordHash = await bcrypt.hash(newPassword, 10);
  }
  await u.save();
  res.json(await meView(u, req.today));
});

me.get('/stats', async (req, res) => res.json(await profileStats(req.user, req.today)));
me.get('/weekly', async (req, res) => res.json(await weeklySummary(req.user, req.today, req.query.start)));
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

me.post('/shields/seen', async (req, res) => {
  const sh = await ensureShields(req.user, req.today);
  await ShieldUse.updateMany({ userId: req.user._id, seen: false }, { seen: true });
  req.user.shieldsEarnedSeen = sh.earnedTotal;
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
  const shields = await ShieldUse.find({ userId: id }).lean();
  const tasks = await Task.find({ userId: id }).lean();
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
  res.json({ exportedAt: new Date(), profile, goals, checkins, posts, comments, follows, achievements, tasks, shieldsUsed: shields.map((s) => s.date) });
});

me.delete('/', async (req, res) => {
  const id = req.user._id;
  const { password } = req.body || {};
  if (req.user.passwordHash && !(await bcrypt.compare(String(password || ''), req.user.passwordHash))) {
    throw new HttpError(401, 'Senha não confere.');
  }
  // Fotos primeiro: se o armazenamento falhar, a conta ainda existe e a pessoa pode tentar de novo
  try {
    await deleteUserImages(id);
  } catch (e) {
    console.error('[blob] exclusão de conta:', e.message);
    throw new HttpError(503, 'Não deu para apagar suas fotos agora. Tente de novo em instantes.');
  }
  await handOverClubs(id);
  const posts = await Post.find({ userId: id }, { _id: 1 }).lean();
  // Comentários da pessoa em posts de outros somem: desconta da contagem desses posts
  const mine = await Comment.aggregate([{ $match: { userId: id } }, { $group: { _id: '$postId', n: { $sum: 1 } } }]);
  if (mine.length) await Post.bulkWrite(mine.map((c) => ({ updateOne: { filter: { _id: c._id }, update: { $inc: { commentsCount: -c.n } } } })));
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
    ShieldUse.deleteMany({ userId: id }),
    Task.deleteMany({ userId: id }),
    Membership.deleteMany({ userId: id }),
    Report.deleteMany({ reporterId: id }),
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
