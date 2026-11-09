import { Router } from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { Club, Membership, Post, User, Goal, Report, ClubEvent } from '../models/index.js';
import { isDateStr } from '../lib/dates.js';
import { notify } from '../services/push.js';
import { social } from '../services/pushMessages.js';
import { bad, notFound, forbidden, HttpError } from '../lib/http.js';
import { friendIds, publicUser, blockedIds, relation } from '../services/social.js';
import { clubSummary, membershipOf, canModerate, visibleClubFilter, clubRanking, openChallengeFilter, isCategory, CATEGORY_LABEL, INTEREST_ORDER, MAX_OPEN_CLUBS } from '../services/clubs.js';
import { hydratePosts } from './posts.js';
import { goalView } from '../services/progress.js';
import { award } from '../services/achievements.js';

void award; void HttpError;

export const clubs = Router();
export const community = Router();
export const reports = Router();

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'clube';

async function loadClub(slug, userId) {
  const club = await Club.findOne({ slug: String(slug).toLowerCase() }).lean();
  if (!club) throw notFound('Clube não encontrado.');
  const m = await membershipOf(club._id, userId);
  if (club.kind === 'private' && m?.status !== 'active') throw notFound('Clube não encontrado.');
  return { club, m };
}
function requireMod(m) { if (!canModerate(m)) throw forbidden('Só moderadores podem fazer isso.'); }

async function challengeCard(g, user, today) {
  const v = await goalView(g, user, today);
  return {
    id: v.id, title: v.title, color: v.color, category: v.category, description: g.shared?.description || '',
    participants: v.shared.participants.length, joined: v.shared.participants.some((p) => p.id === String(user._id)),
    daysLeft: v.shared.daysLeft, mode: v.shared.mode,
    myPosition: v.shared.ranking?.find((r) => r.me)?.position || null,
    clubId: g.shared?.clubId ? String(g.shared.clubId) : null,
  };
}

// --- Comunidade: Clubes e Desafios ---
community.get('/', async (req, res) => {
  const me = req.user;
  const friends = await friendIds(me._id);
  const visible = await visibleClubFilter(me._id);
  const mine = await Membership.find({ userId: me._id, status: 'active' }).lean();
  const myClubs = await Club.find({ _id: { $in: mine.map((m) => m.clubId) } }).lean();
  const myCards = await Promise.all(myClubs.map(async (c) => {
    const seen = mine.find((m) => String(m.clubId) === String(c._id))?.lastSeenAt || new Date(0);
    const [summary, newPosts, active] = await Promise.all([
      clubSummary(c, { userId: me._id, friends }),
      Post.countDocuments({ clubIds: c._id, createdAt: { $gt: seen }, userId: { $ne: me._id } }),
      Goal.exists({ 'shared.clubId': c._id, 'shared.endsAt': { $gte: req.today }, archivedAt: null }),
    ]);
    return { ...summary, newPosts, activeChallenge: Boolean(active) };
  }));

  // Perto de você: mesma cidade ou mesma região das cidades conhecidas
  let nearby = { label: null, clubs: [] };
  if (me.city) {
    const sameCity = await Club.find({ ...visible, city: me.city }).lean();
    const regions = [...new Set(sameCity.map((c) => c.region).filter(Boolean))];
    const list = await Club.find({ ...visible, $or: [{ city: me.city }, ...(regions.length ? [{ region: { $in: regions } }] : [])] }).limit(12).lean();
    nearby = { label: regions[0] || me.city, clubs: await Promise.all(list.map((c) => clubSummary(c, { userId: me._id, friends }))) };
  }
  const interests = await Club.aggregate([{ $match: { kind: { $in: ['official', 'open'] } } }, { $group: { _id: { interest: '$interest', category: '$category' }, n: { $sum: 1 } } }, { $sort: { n: -1 } }]);
  res.json({
    myClubs: myCards,
    nearby,
    needsCity: !me.city,
    interests: interests
      .map((i) => ({ interest: i._id.interest || CATEGORY_LABEL[i._id.category], category: i._id.category, count: i.n }))
      .sort((a, b) => INTEREST_ORDER.indexOf(a.category) - INTEREST_ORDER.indexOf(b.category) || b.count - a.count || a.interest.localeCompare(b.interest)),
  });
});

/** Próximos eventos: dos meus clubes e dos clubes da minha cidade. */
community.get('/events', async (req, res) => {
  const me = req.user;
  const mine = (await Membership.find({ userId: me._id, status: 'active' }, { clubId: 1 }).lean()).map((m) => m.clubId);
  const near = me.city ? (await Club.find({ kind: { $in: ['official', 'open'] }, city: me.city }, { _id: 1 }).lean()).map((c) => c._id) : [];
  const list = await ClubEvent.find({ clubId: { $in: [...mine, ...near] }, canceledAt: null, date: { $gte: req.today } }).sort({ date: 1, time: 1 }).limit(10).lean();
  const clubsById = new Map((await Club.find({ _id: { $in: list.map((e) => e.clubId) } }).lean()).map((c) => [String(c._id), c]));
  const views = await eventViews(list, me._id);
  const mineSet = new Set(mine.map(String));
  res.json(views.map((v, i) => {
    const c = clubsById.get(String(list[i].clubId));
    return { ...v, club: c ? { slug: c.slug, name: c.name, category: c.category, member: mineSet.has(String(c._id)) } : null };
  }).filter((v) => v.club));
});

community.get('/challenges', async (req, res) => {
  const list = await Goal.find(openChallengeFilter(req.today)).sort({ 'shared.endsAt': 1 }).limit(30).lean();
  const myClubs = new Set((await Membership.find({ userId: req.user._id, status: 'active' }, { clubId: 1 }).lean()).map((m) => String(m.clubId)));
  const clubsById = new Map((await Club.find({ _id: { $in: list.map((g) => g.shared.clubId).filter(Boolean) } }).lean()).map((c) => [String(c._id), c]));
  const cards = [];
  for (const g of list) {
    const club = g.shared.clubId ? clubsById.get(String(g.shared.clubId)) : null;
    if (club && club.kind === 'private' && !myClubs.has(String(club._id))) continue;
    const card = await challengeCard(g, req.user, req.today);
    cards.push({ ...card, club: club ? { slug: club.slug, name: club.name, member: myClubs.has(String(club._id)) } : null });
  }
  const featured = cards.find((c) => !c.club) || null;
  res.json({ featured, list: cards.filter((c) => c !== featured) });
});

community.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 40);
  if (q.length < 2) return res.json({ clubs: [], challenges: [], people: [] });
  const re = new RegExp(escapeRe(q), 'i');
  const visible = await visibleClubFilter(req.user._id);
  const friends = await friendIds(req.user._id);
  const blocked = await blockedIds(req.user._id);
  const [cl, ch, people] = await Promise.all([
    Club.find({ ...visible, $and: [{ $or: [{ name: re }, { interest: re }, { city: re }, { region: re }] }] }).limit(10).lean(),
    Goal.find({ ...openChallengeFilter(req.today), title: re }).limit(10).lean(),
    User.find({ $or: [{ name: re }, { username: re }], _id: { $ne: req.user._id, $nin: blocked }, demo: { $ne: true }, suspendedAt: null }).limit(10).lean(),
  ]);
  res.json({
    clubs: await Promise.all(cl.map((c) => clubSummary(c, { userId: req.user._id, friends }))),
    challenges: await Promise.all(ch.map((g) => challengeCard(g, req.user, req.today))),
    people: await Promise.all(people.map(async (u) => ({ ...publicUser(u), bio: u.bio, relation: await relation(req.user._id, u._id) }))),
  });
});

// --- Clubes ---
clubs.get('/', async (req, res) => {
  const visible = await visibleClubFilter(req.user._id);
  const filter = { ...visible };
  if (req.query.interest) filter.interest = String(req.query.interest);
  if (req.query.category && isCategory(req.query.category)) filter.category = req.query.category;
  const list = await Club.find(filter).sort({ name: 1 }).limit(50).lean();
  const friends = await friendIds(req.user._id);
  res.json(await Promise.all(list.map((c) => clubSummary(c, { userId: req.user._id, friends }))));
});

// Criar clube: aberto (qualquer pessoa entra; quem cria vira admin) ou grupo privado de amigos
clubs.post('/', async (req, res) => {
  const b = req.body || {};
  const open = b.kind === 'open';
  const word = open ? 'clube' : 'grupo';
  const name = String(b.name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (name.length < 3) throw bad(`Dê um nome ao ${word} (3 letras ou mais).`);
  if (!isCategory(b.category)) throw bad(`Escolha a categoria do ${word}.`);
  const text = (v, max) => String(v || '').trim().slice(0, max);
  let invite = [];
  const fields = { name, category: b.category, description: text(b.description, 300), createdBy: req.user._id };
  if (open) {
    const mine = await Club.countDocuments({ createdBy: req.user._id, kind: 'open' });
    if (mine >= MAX_OPEN_CLUBS) throw bad(`Cada pessoa cria até ${MAX_OPEN_CLUBS} clubes abertos.`);
    if (await Club.exists({ kind: { $in: ['official', 'open'] }, name: new RegExp(`^${escapeRe(name)}$`, 'i') })) throw bad('Já existe um clube com esse nome. Que tal entrar nele?');
    const city = text(b.city, 60);
    // Região herdada dos clubes da mesma cidade, para aparecer em "Perto de você" da região
    const sameCity = city ? await Club.findOne({ city: new RegExp(`^${escapeRe(city)}$`, 'i'), region: { $nin: [null, ''] } }, { region: 1 }).lean() : null;
    Object.assign(fields, { kind: 'open', interest: text(b.interest, 30) || CATEGORY_LABEL[b.category], city: city || 'Online', region: sameCity?.region || '', rules: text(b.rules, 1500) });
  } else {
    const friends = new Set((await friendIds(req.user._id)).map(String));
    invite = [...new Set((b.invite || []).map(String))].filter((id) => friends.has(id));
    fields.kind = 'private';
  }
  let slug = slugify(name);
  if (await Club.exists({ slug })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const club = await Club.create({ ...fields, slug });
  // Amigos escolhidos recebem convite e decidem se entram
  await Membership.insertMany([{ clubId: club._id, userId: req.user._id, role: 'admin' }, ...invite.map((u) => ({ clubId: club._id, userId: u, status: 'invited', invitedBy: req.user._id }))]);
  res.status(201).json(await clubSummary(club.toObject(), { userId: req.user._id }));
});

clubs.get('/:slug', async (req, res) => {
  const { club, m } = await loadClub(req.params.slug, req.user._id);
  const friends = await friendIds(req.user._id);
  const summary = await clubSummary(club, { userId: req.user._id, friends });
  const inside = await Membership.find({ clubId: club._id, status: 'active', userId: { $in: friends } }).limit(5).lean();
  const people = await User.find({ _id: { $in: inside.map((x) => x.userId) } }).lean();
  const openReports = canModerate(m) ? await Report.countDocuments({ clubId: club._id, status: 'open' }) : 0;
  res.json({ ...summary, description: club.description, rules: club.rules, pinned: club.pinned, friendsInside: people.map(publicUser), canModerate: canModerate(m), openReports });
});

clubs.post('/:slug/join', async (req, res) => {
  const club = await Club.findOne({ slug: String(req.params.slug).toLowerCase() }).lean();
  if (!club || club.kind === 'private') throw notFound('Clube não encontrado.');
  const m = await membershipOf(club._id, req.user._id);
  if (m?.status === 'banned') throw forbidden('Você não pode entrar neste clube.');
  await Membership.updateOne({ clubId: club._id, userId: req.user._id }, { $setOnInsert: { role: 'member', status: 'active', joinedAt: new Date(), lastSeenAt: new Date() } }, { upsert: true });
  res.json(await clubSummary(club, { userId: req.user._id }));
});

// --- Convites de grupo privado ---
// Ninguém entra sem querer: amigo recebe convite (aceita ou recusa) e quem tem o link toca em "Entrar".
const newInviteCode = () => crypto.randomBytes(6).toString('base64url');
async function ensureInviteCode(club) {
  if (club.inviteCode) return club.inviteCode;
  for (;;) {
    const code = newInviteCode();
    try {
      const r = await Club.findOneAndUpdate({ _id: club._id, inviteCode: { $exists: false } }, { $set: { inviteCode: code } }, { new: true }).lean();
      return r ? r.inviteCode : (await Club.findById(club._id, { inviteCode: 1 }).lean()).inviteCode;
    } catch (e) { if (e.code !== 11000) throw e; } // código repetido: tenta outro
  }
}
async function privateMember(slug, userId) {
  const { club, m } = await loadClub(slug, userId);
  if (club.kind !== 'private') throw bad('Clubes abertos não precisam de convite: compartilhe o link.');
  if (m?.status !== 'active') throw forbidden('Só quem está no grupo convida.');
  return { club, m };
}

// Entrar pelo link (antes das rotas /:slug para não confundir "link" com um slug)
clubs.post('/link/:code/join', async (req, res) => {
  const club = await Club.findOne({ inviteCode: String(req.params.code), kind: 'private' }).lean();
  if (!club) throw notFound('Esse convite não vale mais. Peça um link novo.');
  const m = await membershipOf(club._id, req.user._id);
  if (m?.status === 'banned') throw forbidden('Você não pode entrar neste grupo.');
  if (m?.status !== 'active') {
    await Membership.updateOne({ clubId: club._id, userId: req.user._id }, { $set: { status: 'active', role: 'member', joinedAt: new Date(), lastSeenAt: new Date() } }, { upsert: true });
  }
  res.json({ ...(await clubSummary(club, { userId: req.user._id })), already: m?.status === 'active' });
});

clubs.get('/:slug/link', async (req, res) => {
  const { club } = await privateMember(req.params.slug, req.user._id);
  res.json({ code: await ensureInviteCode(club) });
});

clubs.post('/:slug/link/reset', async (req, res) => {
  const { club, m } = await privateMember(req.params.slug, req.user._id);
  requireMod(m);
  for (;;) {
    try {
      const code = newInviteCode();
      await Club.updateOne({ _id: club._id }, { $set: { inviteCode: code } });
      return res.json({ code });
    } catch (e) { if (e.code !== 11000) throw e; }
  }
});

/** Amigos para convidar, com a situação de cada um no grupo. */
clubs.get('/:slug/invitable', async (req, res) => {
  const { club } = await privateMember(req.params.slug, req.user._id);
  const ids = await friendIds(req.user._id);
  const [people, rows] = await Promise.all([
    User.find({ _id: { $in: ids }, suspendedAt: null }).sort({ name: 1 }).lean(),
    Membership.find({ clubId: club._id, userId: { $in: ids } }, { userId: 1, status: 1 }).lean(),
  ]);
  const state = new Map(rows.map((r) => [String(r.userId), r.status]));
  res.json(people.filter((u) => state.get(String(u._id)) !== 'banned').map((u) => ({ ...publicUser(u), state: state.get(String(u._id)) || null })));
});

clubs.post('/:slug/invite', async (req, res) => {
  const { club } = await privateMember(req.params.slug, req.user._id);
  const friends = new Set((await friendIds(req.user._id)).map(String));
  const wanted = [...new Set((req.body?.invite || []).map(String))].filter((id) => friends.has(id));
  if (!wanted.length) throw bad('Escolha pelo menos 1 amigo.');
  // Quem já está, já foi convidado ou foi banido não é mexido
  const existing = new Set((await Membership.find({ clubId: club._id, userId: { $in: wanted } }, { userId: 1 }).lean()).map((x) => String(x.userId)));
  const add = wanted.filter((id) => !existing.has(id));
  if (add.length) await Membership.insertMany(add.map((u) => ({ clubId: club._id, userId: u, status: 'invited', invitedBy: req.user._id })));
  res.json({ invited: add.length });
});

// Responder ao convite (a pessoa ainda não vê o grupo, então não passa por loadClub)
clubs.post('/:slug/invite/:answer', async (req, res) => {
  const club = await Club.findOne({ slug: String(req.params.slug).toLowerCase(), kind: 'private' }).lean();
  const m = club ? await Membership.findOne({ clubId: club._id, userId: req.user._id, status: 'invited' }) : null;
  if (!m) throw notFound('Convite não encontrado.');
  if (req.params.answer === 'accept') {
    m.status = 'active';
    m.joinedAt = new Date();
    m.lastSeenAt = new Date();
    await m.save();
    return res.json(await clubSummary(club, { userId: req.user._id }));
  }
  if (req.params.answer !== 'decline') throw bad('Resposta inválida.');
  await m.deleteOne();
  res.json({ ok: true });
});

clubs.delete('/:slug/membership', async (req, res) => {
  const { club, m } = await loadClub(req.params.slug, req.user._id);
  if (!m || m.status !== 'active') return res.json({ ok: true });
  if (m.role === 'admin') {
    const otherAdmins = await Membership.countDocuments({ clubId: club._id, role: 'admin', status: 'active', userId: { $ne: req.user._id } });
    if (!otherAdmins) {
      const next = await Membership.findOne({ clubId: club._id, status: 'active', userId: { $ne: req.user._id } }).sort({ role: -1, joinedAt: 1 }); // moderador primeiro
      if (next) { next.role = 'admin'; await next.save(); }
    }
  }
  await Membership.deleteOne({ _id: m._id });
  // Clube criado por alguém que ficou sem ninguém dentro deixa de existir
  if (club.kind !== 'official' && !(await Membership.exists({ clubId: club._id, status: 'active' }))) {
    await Club.deleteOne({ _id: club._id });
    await Membership.deleteMany({ clubId: club._id });
    await Post.updateMany({ clubIds: club._id }, { $pull: { clubIds: club._id } });
    return res.json({ ok: true, deleted: true });
  }
  res.json({ ok: true });
});

clubs.get('/:slug/feed', async (req, res) => {
  const { club, m } = await loadClub(req.params.slug, req.user._id);
  const blocked = await blockedIds(req.user._id);
  const banned = (await Membership.find({ clubId: club._id, status: 'banned' }, { userId: 1 }).lean()).map((x) => x.userId);
  // Só Público: posts de Amigos nunca vazam para o clube
  const q = { clubIds: club._id, audience: 'public', userId: { $nin: [...blocked, ...banned] } };
  if (req.query.before) q.createdAt = { $lt: new Date(String(req.query.before)) };
  const list = await Post.find(q).sort({ createdAt: -1 }).limit(20).lean();
  if (m?.status === 'active') await Membership.updateOne({ _id: m._id }, { lastSeenAt: new Date() });
  const friends = new Set((await friendIds(req.user._id)).map(String));
  const posts = (await hydratePosts(list, req.user._id)).map((p) => ({ ...p, isFriend: friends.has(p.user.id) }));
  res.json({ posts, next: list.length === 20 ? list[list.length - 1].createdAt : null });
});

clubs.get('/:slug/ranking', async (req, res) => {
  const { club } = await loadClub(req.params.slug, req.user._id);
  const rows = (await clubRanking(club, req.today)).slice(0, 50);
  const people = await User.find({ _id: { $in: rows.map((r) => r.userId) } }).lean();
  const by = new Map(people.map((u) => [String(u._id), u]));
  res.json(rows.map((r, i) => ({ position: i + 1, minutes: r.minutes, posts: r.posts, user: publicUser(by.get(r.userId)), me: r.userId === String(req.user._id) })).filter((r) => r.user));
});

clubs.get('/:slug/members', async (req, res) => {
  const { club, m } = await loadClub(req.params.slug, req.user._id);
  const status = canModerate(m) && req.query.banned ? 'banned' : 'active';
  const rows = await Membership.find({ clubId: club._id, status }).sort({ role: 1, joinedAt: 1 }).limit(200).lean();
  const people = await User.find({ _id: { $in: rows.map((r) => r.userId) } }).lean();
  const by = new Map(people.map((u) => [String(u._id), u]));
  const blocked = await blockedIds(req.user._id);
  const order = { admin: 0, moderator: 1, member: 2 };
  const out = await Promise.all(rows.filter((r) => by.get(String(r.userId)) && !blocked.includes(String(r.userId))).map(async (r) => ({
    ...publicUser(by.get(String(r.userId))), role: r.role, status: r.status, relation: await relation(req.user._id, r.userId),
  })));
  res.json(out.sort((a, b) => order[a.role] - order[b.role]));
});

// --- Eventos do clube ---
// Cria: moderação em clubes abertos/oficiais; qualquer membro num grupo privado. "Vou": membros.
const eventView = (e, meId, by) => ({
  id: String(e._id), title: e.title, date: e.date, time: e.time, place: e.place, description: e.description,
  goingCount: e.going.length, going: e.going.some((u) => String(u) === String(meId)), canceled: Boolean(e.canceledAt),
  people: e.going.slice(0, 5).map((u) => by?.get(String(u))).filter(Boolean).map(publicUser),
  mine: String(e.createdBy) === String(meId),
});
const canCreateEvent = (club, m) => (club.kind === 'private' ? m?.status === 'active' : canModerate(m));
async function eventViews(list, meId) {
  const by = new Map((await User.find({ _id: { $in: list.flatMap((e) => e.going.slice(0, 5)) } }).lean()).map((u) => [String(u._id), u]));
  return list.map((e) => eventView(e, meId, by));
}

clubs.get('/:slug/events', async (req, res) => {
  const { club, m } = await loadClub(req.params.slug, req.user._id);
  const list = await ClubEvent.find({ clubId: club._id, date: { $gte: req.today }, canceledAt: null }).sort({ date: 1, time: 1 }).limit(20).lean();
  res.json({ canCreate: canCreateEvent(club, m), events: await eventViews(list, req.user._id) });
});

clubs.post('/:slug/events', async (req, res) => {
  const { club, m } = await loadClub(req.params.slug, req.user._id);
  if (!canCreateEvent(club, m)) throw forbidden(club.kind === 'private' ? 'Só quem está no grupo cria eventos.' : 'Só a moderação do clube cria eventos.');
  const b = req.body || {};
  const title = String(b.title || '').trim().slice(0, 80);
  if (title.length < 3) throw bad('Dê um nome ao evento.');
  if (!isDateStr(b.date) || b.date < req.today) throw bad('Escolha uma data de hoje em diante.');
  if (!/^\d{2}:\d{2}$/.test(b.time || '')) throw bad('Escolha o horário.');
  const e = await ClubEvent.create({
    clubId: club._id, title, date: b.date, time: b.time, place: String(b.place || '').trim().slice(0, 120),
    description: String(b.description || '').trim().slice(0, 500), createdBy: req.user._id, going: [req.user._id],
  });
  // Avisa os membros (agrupado pelo push; nunca de madrugada)
  const members = await Membership.find({ clubId: club._id, status: 'active', userId: { $ne: req.user._id } }, { userId: 1 }).limit(500).lean();
  const [, mo, d] = b.date.split('-');
  await Promise.all(members.map((x) => notify(x.userId, { ...social.eventNew(club.name, title, `${d}/${mo} às ${b.time}`), url: `/clubes/${club.slug}` }, { type: 'social', dedupeKey: `event:new:${e._id}` })));
  res.status(201).json((await eventViews([e.toObject()], req.user._id))[0]);
});

clubs.post('/:slug/events/:eventId/going', async (req, res) => {
  const { club, m } = await loadClub(req.params.slug, req.user._id);
  if (m?.status !== 'active') throw forbidden('Entre no clube para confirmar presença.');
  if (!mongoose.isValidObjectId(req.params.eventId)) throw notFound();
  const want = req.body?.going !== false;
  const e = await ClubEvent.findOneAndUpdate({ _id: req.params.eventId, clubId: club._id, canceledAt: null },
    want ? { $addToSet: { going: req.user._id } } : { $pull: { going: req.user._id } }, { new: true }).lean();
  if (!e) throw notFound('Evento não encontrado.');
  res.json((await eventViews([e], req.user._id))[0]);
});

clubs.delete('/:slug/events/:eventId', async (req, res) => {
  const { club, m } = await loadClub(req.params.slug, req.user._id);
  if (!mongoose.isValidObjectId(req.params.eventId)) throw notFound();
  const e = await ClubEvent.findOne({ _id: req.params.eventId, clubId: club._id });
  if (!e) throw notFound();
  if (String(e.createdBy) !== String(req.user._id) && !canModerate(m)) throw forbidden();
  e.canceledAt = new Date();
  await e.save();
  res.json({ ok: true });
});

clubs.get('/:slug/challenges', async (req, res) => {
  const { club } = await loadClub(req.params.slug, req.user._id);
  const list = await Goal.find({ 'shared.clubId': club._id, archivedAt: null }).sort({ 'shared.endsAt': -1 }).limit(20).lean();
  res.json(await Promise.all(list.map((g) => challengeCard(g, req.user, req.today))));
});

// --- Moderação ---
clubs.patch('/:slug', async (req, res) => {
  const { club, m } = await loadClub(req.params.slug, req.user._id);
  requireMod(m);
  const b = req.body || {};
  const set = {};
  if (b.pinned !== undefined) set.pinned = String(b.pinned).slice(0, 280);
  if (b.rules !== undefined) set.rules = String(b.rules).slice(0, 1500);
  if (b.description !== undefined) set.description = String(b.description).slice(0, 300);
  await Club.updateOne({ _id: club._id }, { $set: set });
  res.json({ ok: true });
});

clubs.post('/:slug/posts/:postId/remove', async (req, res) => {
  const { club, m } = await loadClub(req.params.slug, req.user._id);
  requireMod(m);
  await Post.updateOne({ _id: req.params.postId }, { $pull: { clubIds: club._id } });
  await Report.updateMany({ clubId: club._id, targetType: 'post', targetId: req.params.postId, status: 'open' }, { status: 'done', resolution: 'removido do clube' });
  res.json({ ok: true });
});

clubs.post('/:slug/members/:userId/:action', async (req, res) => {
  const { club, m } = await loadClub(req.params.slug, req.user._id);
  requireMod(m);
  if (!mongoose.isValidObjectId(req.params.userId)) throw notFound();
  const target = await Membership.findOne({ clubId: club._id, userId: req.params.userId });
  if (String(req.params.userId) === String(req.user._id)) throw bad('Não dá para fazer isso com você.');
  const action = req.params.action;
  if (action === 'ban') {
    if (target?.role === 'admin') throw forbidden('Não dá para banir um admin.');
    await Membership.updateOne({ clubId: club._id, userId: req.params.userId }, { $set: { status: 'banned', role: 'member' } }, { upsert: true });
    await Post.updateMany({ userId: req.params.userId, clubIds: club._id }, { $pull: { clubIds: club._id } });
    await Report.updateMany({ clubId: club._id, targetType: 'user', targetId: req.params.userId, status: 'open' }, { status: 'done', resolution: 'banido' });
  } else if (action === 'unban') {
    if (target) { target.status = 'active'; await target.save(); }
  } else if (action === 'moderator' || action === 'member') {
    if (m.role !== 'admin') throw forbidden('Só admins mudam papéis.');
    if (!target || target.status !== 'active') throw notFound('Membro não encontrado.');
    target.role = action;
    await target.save();
  } else throw bad('Ação inválida.');
  res.json({ ok: true });
});

clubs.get('/:slug/reports', async (req, res) => {
  const { club, m } = await loadClub(req.params.slug, req.user._id);
  requireMod(m);
  const list = await Report.find({ clubId: club._id, status: 'open' }).sort({ createdAt: -1 }).limit(100).lean();
  const posts = await Post.find({ _id: { $in: list.filter((r) => r.targetType === 'post').map((r) => r.targetId) } }).lean();
  const hydrated = new Map((await hydratePosts(posts, req.user._id)).map((p) => [p.id, p]));
  const users = await User.find({ _id: { $in: list.filter((r) => r.targetType === 'user').map((r) => r.targetId) } }).lean();
  const ub = new Map(users.map((u) => [String(u._id), u]));
  res.json(list.map((r) => ({
    id: String(r._id), targetType: r.targetType, targetId: String(r.targetId), reason: r.reason, details: r.details, createdAt: r.createdAt,
    post: r.targetType === 'post' ? hydrated.get(String(r.targetId)) || null : null,
    user: r.targetType === 'user' ? publicUser(ub.get(String(r.targetId))) : null,
  })));
});

// --- Denúncias ---
const REASONS = ['spam', 'assedio', 'improprio', 'falso', 'outro'];
reports.post('/', async (req, res) => {
  const b = req.body || {};
  if (!['post', 'user', 'comment', 'club'].includes(b.targetType)) throw bad('Denúncia inválida.');
  if (!REASONS.includes(b.reason)) throw bad('Escolha um motivo.');
  if (!mongoose.isValidObjectId(b.targetId)) throw bad('Denúncia inválida.');
  if (b.targetType === 'user' && String(b.targetId) === String(req.user._id)) throw bad('Você não pode se denunciar.');
  let clubId = null;
  if (b.clubSlug) {
    const club = await Club.findOne({ slug: String(b.clubSlug).toLowerCase() }, { _id: 1 }).lean();
    clubId = club?._id || null;
  }
  // Uma denúncia por pessoa e alvo; denunciar de novo algo já resolvido reabre na fila
  await Report.updateOne(
    { reporterId: req.user._id, targetType: b.targetType, targetId: b.targetId },
    { $set: { clubId, reason: b.reason, details: String(b.details || '').slice(0, 500), status: 'open', resolution: '' } },
    { upsert: true },
  );
  res.status(201).json({ ok: true });
});

reports.post('/:id/resolve', async (req, res) => {
  const r = await Report.findById(req.params.id);
  if (!r) throw notFound();
  const m = r.clubId ? await membershipOf(r.clubId, req.user._id) : null;
  requireMod(m);
  r.status = 'done';
  r.resolution = String(req.body?.resolution || 'mantido').slice(0, 60);
  await r.save();
  res.json({ ok: true });
});

