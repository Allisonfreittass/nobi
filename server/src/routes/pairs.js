// Sequência a dois (como o Friend Streak do Duolingo, no jeito Nobi: sem culpa).
// O dia conta quando os dois registram qualquer objetivo; dia protegido por escudo conta para quem usou.
import { Router } from 'express';
import mongoose from 'mongoose';
import { Pair, Checkin, ShieldUse, User, Nudge } from '../models/index.js';
import { bad, notFound, forbidden } from '../lib/http.js';
import { addDays } from '../lib/dates.js';
import { friendIds, blockedIds, publicUser } from '../services/social.js';
import { notify } from '../services/push.js';
import { social } from '../services/pushMessages.js';

export const pairs = Router();
export const MAX_PAIRS = 5;
const keyOf = (a, b) => [String(a), String(b)].sort().join(':');

/** Dias em que a pessoa "fez" (registro ou escudo), desde `from`. */
async function doneDays(userId, from) {
  const [c, s] = await Promise.all([
    Checkin.distinct('date', { userId, date: { $gte: from } }),
    ShieldUse.distinct('date', { userId, date: { $gte: from } }),
  ]);
  return new Set([...c, ...s]);
}

/** Sequência atual: dias seguidos em que os dois fizeram, terminando hoje (se os dois já fizeram) ou ontem. */
export function pairStreak(a, b, startedAt, today) {
  const both = (d) => a.has(d) && b.has(d);
  let day = both(today) ? today : addDays(today, -1);
  let n = 0;
  while (day >= startedAt && both(day)) { n += 1; day = addDays(day, -1); }
  return n;
}

async function view(p, meId, today) {
  const other = p.users.find((u) => String(u) !== String(meId));
  const [u, mine, theirs] = await Promise.all([
    User.findById(other).lean(),
    doneDays(meId, p.startedAt || today),
    doneDays(other, p.startedAt || today),
  ]);
  if (!u) return null;
  return {
    id: String(p._id), status: p.status, invitedByMe: String(p.invitedBy) === String(meId), startedAt: p.startedAt,
    partner: publicUser(u),
    streak: p.status === 'active' ? pairStreak(mine, theirs, p.startedAt, today) : 0,
    meToday: mine.has(today), partnerToday: theirs.has(today),
  };
}

pairs.get('/', async (req, res) => {
  const list = await Pair.find({ users: req.user._id }).sort({ status: 1, createdAt: 1 }).lean();
  res.json((await Promise.all(list.map((p) => view(p, req.user._id, req.today)))).filter(Boolean));
});

pairs.post('/', async (req, res) => {
  const to = String(req.body?.userId || '');
  if (!mongoose.isValidObjectId(to) || to === String(req.user._id)) throw bad('Escolha um amigo.');
  if (!(await friendIds(req.user._id)).map(String).includes(to)) throw bad('Sequência a dois é entre amigos (vocês se seguem).');
  if ((await blockedIds(req.user._id)).includes(to)) throw notFound();
  for (const id of [req.user._id, to]) {
    if (await Pair.countDocuments({ users: id }) >= MAX_PAIRS) throw bad(`Cada pessoa tem até ${MAX_PAIRS} sequências a dois.`);
  }
  try {
    const p = await Pair.create({ users: [req.user._id, to].map(String).sort(), key: keyOf(req.user._id, to), invitedBy: req.user._id });
    await notify(to, { ...social.pairInvite(req.user.name), url: '/notificacoes' }, { type: 'social', dedupeKey: `pair:inv:${p._id}` });
    res.status(201).json(await view(p.toObject(), req.user._id, req.today));
  } catch (e) {
    if (e.code === 11000) throw bad('Vocês já têm uma sequência a dois (ou um convite).');
    throw e;
  }
});

async function mine(id, userId) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const p = await Pair.findOne({ _id: id, users: userId });
  if (!p) throw notFound();
  return p;
}

pairs.post('/:id/accept', async (req, res) => {
  const p = await mine(req.params.id, req.user._id);
  if (p.status !== 'pending' || String(p.invitedBy) === String(req.user._id)) throw bad('Esse convite não é para você aceitar.');
  p.status = 'active';
  p.startedAt = req.today;
  await p.save();
  res.json(await view(p.toObject(), req.user._id, req.today));
});

// Recusar o convite ou encerrar a sequência: qualquer um dos dois pode
pairs.delete('/:id', async (req, res) => {
  const p = await mine(req.params.id, req.user._id);
  await p.deleteOne();
  res.json({ ok: true });
});

pairs.post('/:id/nudge', async (req, res) => {
  const p = await mine(req.params.id, req.user._id);
  if (p.status !== 'active') throw bad('A sequência ainda não começou.');
  const to = p.users.find((u) => String(u) !== String(req.user._id));
  if ((await doneDays(to, req.today)).has(req.today)) throw bad('Já fez hoje.');
  try {
    await Nudge.create({ fromId: req.user._id, toId: to, pairId: p._id, date: req.today });
  } catch (e) {
    if (e.code === 11000) throw bad('Você já cutucou hoje. Amanhã dá de novo.');
    throw e;
  }
  await notify(to, { ...social.pairNudge(req.user.name), url: '/' }, { type: 'social', dedupeKey: `pair:nudge:${p._id}:${req.today}` });
  res.json({ ok: true });
});

void forbidden;
