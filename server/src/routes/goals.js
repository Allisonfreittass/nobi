import { Router } from 'express';
import { Goal, Checkin, User, Streak, Post, Comment, Task, CATEGORIES, KINDS } from '../models/index.js';
import { deleteImages } from '../services/storage.js';
import { bad, notFound, forbidden } from '../lib/http.js';
import { addDays, weekStart, weekday, isDateStr } from '../lib/dates.js';
import { goalView, userGoals, refreshStreakCache, weekStartsOn, goalsQuery, summarize, serializeGoal } from '../services/progress.js';
import { computeStreak, dayTotals, needFor, CELEBRATE, streakInDays } from '../services/streaks.js';
import { award, grantXp, ownedCodes } from '../services/achievements.js';
import { XP } from '../services/level.js';
import { friendIds, publicUser } from '../services/social.js';
import { currentSeason } from '../services/seasons.js';
import { notify, localParts } from '../services/push.js';
import { ensureShields } from '../services/shields.js';
import { social } from '../services/pushMessages.js';
import { weeklyPoints } from '../services/progress.js';

export const goals = Router();

const COLORS = ['#FF5B2E', '#6C4DFF', '#2E9C6A', '#3B82C4', '#E0457B', '#141218'];
const isMember = (g, uid) => String(g.ownerId) === String(uid) || g.shared?.participants?.some((p) => String(p) === String(uid));
const isInvited = (g, uid) => g.shared?.invited?.some((p) => String(p) === String(uid));

async function loadGoal(id, user, { allowInvited = false } = {}) {
  const g = await Goal.findById(id);
  if (!g || g.archivedAt) throw notFound('Objetivo não encontrado.');
  if (!isMember(g, user._id) && !(allowInvited && isInvited(g, user._id))) throw notFound('Objetivo não encontrado.');
  return g;
}

function parseActiveDays(v) {
  if (!Array.isArray(v)) return undefined;
  const days = [...new Set(v.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  if (!days.length) throw bad('Escolha pelo menos um dia.');
  return days;
}

goals.get('/', async (req, res) => res.json(await userGoals(req.user, req.today)));

goals.get('/archived', async (req, res) => {
  const list = await Goal.find({ ownerId: req.user._id, shared: null, archivedAt: { $ne: null } }).sort({ archivedAt: -1 }).lean();
  res.json(list.map((g) => ({ ...serializeGoal(g), archivedAt: g.archivedAt })));
});

goals.get('/invites', async (req, res) => {
  const list = await Goal.find({ 'shared.invited': req.user._id, archivedAt: null }).lean();
  const owners = await User.find({ _id: { $in: list.map((g) => g.ownerId) } }).lean();
  const by = new Map(owners.map((o) => [String(o._id), o]));
  res.json(list.map((g) => ({
    id: String(g._id), title: g.title, category: g.category, color: g.color, mode: g.shared.mode,
    endsAt: g.shared.endsAt || null, participantsCount: g.shared.participants.length, owner: publicUser(by.get(String(g.ownerId))), at: g.createdAt,
  })));
});

goals.post('/', async (req, res) => {
  const b = req.body || {};
  if (!String(b.title || '').trim()) throw bad('Dê um nome ao objetivo.');
  if (!CATEGORIES.includes(b.category)) throw bad('Categoria inválida.');
  if (!KINDS.includes(b.kind)) throw bad('Tipo inválido.');
  const doc = {
    ownerId: req.user._id,
    title: String(b.title).trim().slice(0, 80),
    category: b.category,
    kind: b.kind,
    target: { amount: Math.max(1, Math.round(Number(b.target?.amount) || 1)), unit: String(b.target?.unit || '').slice(0, 20) },
    activeDays: parseActiveDays(b.activeDays) ?? [0, 1, 2, 3, 4, 5, 6],
    color: COLORS.includes(b.color) ? b.color : COLORS[2],
    startsAt: req.today,
    dueAt: isDateStr(b.dueAt || b.deadline) ? (b.dueAt || b.deadline) : undefined,
    scheduleTime: b.kind !== 'project' && /^\d{2}:\d{2}$/.test(b.scheduleTime || '') ? b.scheduleTime : null,
    tasksMigrated: true,
  };
  if (b.shared) {
    const friends = new Set((await friendIds(req.user._id)).map(String));
    const invite = [...new Set((b.shared.invite || []).map(String))].filter((id) => friends.has(id));
    if (!invite.length) throw bad('Escolha pelo menos 1 amigo.');
    const days = Number(b.shared.durationDays) || 0;
    const season = await currentSeason(req.today);
    doc.shared = {
      mode: b.shared.mode === 'versus' ? 'versus' : 'together',
      participants: [req.user._id],
      invited: invite,
      startsAt: req.today,
      endsAt: days > 0 ? addDays(req.today, days - 1) : undefined,
      seasonId: season?._id,
    };
  }
  const g = await Goal.create(doc);
  // Etapas do projeto (ou itens de qualquer objetivo) já na criação; aceita o formato antigo (milestones)
  const steps = (Array.isArray(b.tasks) ? b.tasks : Array.isArray(b.milestones) ? b.milestones.map((t) => ({ title: t, isMilestone: true })) : [])
    .map((t) => (typeof t === 'string' ? { title: t } : t)).filter((t) => String(t?.title || '').trim()).slice(0, 30);
  if (steps.length) {
    await Task.insertMany(steps.map((t, i) => ({
      userId: req.user._id, goalId: g._id, title: String(t.title).trim().slice(0, 120), order: i,
      isMilestone: Boolean(t.isMilestone), dueDate: isDateStr(t.dueDate) ? t.dueDate : null,
    })));
  }
  if (g.shared) {
    await Promise.all(g.shared.invited.map((u) => notify(u, { ...social.invite(req.user.name, g.title, g.shared.mode), url: `/desafios/${g._id}` }, { type: 'challenges', dedupeKey: `ch:inv:${g._id}` })));
  }
  if (g.shared) await award(req.user._id, 'juntos');
  if (g.shared?.endsAt) await award(req.user._id, 'desafio');
  res.status(201).json(await goalView(g.toObject(), req.user, req.today));
});

goals.get('/:id', async (req, res) => {
  const g = await loadGoal(req.params.id, req.user, { allowInvited: true });
  const view = await goalView(g.toObject(), req.user, req.today);
  view.invited = isInvited(g, req.user._id);
  res.json(view);
});

goals.patch('/:id', async (req, res) => {
  const g = await loadGoal(req.params.id, req.user);
  if (String(g.ownerId) !== String(req.user._id)) throw forbidden('Só quem criou pode editar.');
  const b = req.body || {};
  if (b.title !== undefined) {
    if (!String(b.title).trim()) throw bad('Dê um nome ao objetivo.');
    g.title = String(b.title).trim().slice(0, 80);
  }
  if (b.category !== undefined) {
    if (!CATEGORIES.includes(b.category)) throw bad('Categoria inválida.');
    g.category = b.category;
  }
  const days = parseActiveDays(b.activeDays);
  if (days) g.activeDays = days;
  if (COLORS.includes(b.color)) g.color = b.color;
  // O tipo não muda (mudaria como a sequência é contada); a meta muda
  if (b.target && g.kind !== 'project' && !g.shared?.tasks?.length) {
    if (b.target.amount !== undefined) g.target.amount = Math.max(1, Math.min(100000, Math.round(Number(b.target.amount) || 1)));
    if (b.target.unit !== undefined) g.target.unit = String(b.target.unit).trim().slice(0, 20);
  }
  const due = b.dueAt !== undefined ? b.dueAt : b.deadline;
  if (due !== undefined) { g.dueAt = isDateStr(due) ? due : undefined; g.deadline = undefined; }
  if (b.scheduleTime !== undefined && g.kind !== 'project') g.scheduleTime = /^\d{2}:\d{2}$/.test(b.scheduleTime || '') ? b.scheduleTime : null;
  await g.save();
  await refreshStreakCache(g, req.user._id, req.today, weekStartsOn(req.user));
  res.json(await goalView(g.toObject(), req.user, req.today));
});

/** Apaga de vez um objetivo pessoal: registros, sequência e os posts sobre ele (com fotos e comentários). */
async function destroyGoal(g, userId) {
  const posts = await Post.find({ goalId: g._id, userId }, { _id: 1, photo: 1 }).lean();
  await deleteImages(posts.map((p) => p.photo?.url).filter(Boolean));
  await Promise.all([
    Comment.deleteMany({ postId: { $in: posts.map((p) => p._id) } }),
    Post.deleteMany({ _id: { $in: posts.map((p) => p._id) } }),
    Checkin.deleteMany({ goalId: g._id }),
    Streak.deleteMany({ goalId: g._id }),
    Task.deleteMany({ goalId: g._id }),
  ]);
  await Goal.deleteOne({ _id: g._id });
}

// Pessoal: arquiva (padrão) ou exclui de vez (?modo=excluir). Compartilhado: sai do grupo (a posse passa para outra pessoa).
goals.delete('/:id', async (req, res) => {
  const g = await Goal.findById(req.params.id);
  if (!g || !isMember(g, req.user._id)) throw notFound('Objetivo não encontrado.');
  if (!g.shared) {
    if (req.query.modo === 'excluir') {
      await destroyGoal(g, req.user._id);
      return res.json({ ok: true, deleted: true });
    }
    if (g.archivedAt) throw notFound('Objetivo não encontrado.');
    g.archivedAt = new Date();
    await g.save();
    return res.json({ ok: true, archived: true });
  }
  if (g.archivedAt) throw notFound('Objetivo não encontrado.');
  g.shared.participants = g.shared.participants.filter((p) => String(p) !== String(req.user._id));
  if (!g.shared.participants.length) g.archivedAt = new Date();
  else if (String(g.ownerId) === String(req.user._id)) g.ownerId = g.shared.participants[0];
  await g.save();
  res.json({ ok: true, left: true });
});

goals.post('/:id/restore', async (req, res) => {
  const g = await Goal.findOne({ _id: req.params.id, ownerId: req.user._id, shared: null, archivedAt: { $ne: null } });
  if (!g) throw notFound('Objetivo não encontrado.');
  g.archivedAt = undefined;
  await g.save();
  res.json(await goalView(g.toObject(), req.user, req.today));
});

goals.post('/:id/join', async (req, res) => {
  const g = await Goal.findById(req.params.id);
  if (!g || !isInvited(g, req.user._id)) throw notFound('Convite não encontrado.');
  g.shared.invited = g.shared.invited.filter((p) => String(p) !== String(req.user._id));
  g.shared.participants.push(req.user._id);
  await g.save();
  await award(req.user._id, 'juntos');
  if (g.shared.endsAt) await award(req.user._id, 'desafio');
  await notify(g.ownerId, { ...social.joined(req.user.name, g.title), url: `/desafios/${g._id}` }, { type: 'challenges', dedupeKey: `ch:join:${g._id}:${req.user._id}` });
  res.json(await goalView(g.toObject(), req.user, req.today));
});

goals.post('/:id/decline', async (req, res) => {
  await Goal.updateOne({ _id: req.params.id }, { $pull: { 'shared.invited': req.user._id } });
  res.json({ ok: true });
});

function weekStrip(goal, checkins, today, wso) {
  const totals = dayTotals(checkins);
  const need = needFor(goal);
  const ws = weekStart(today, wso);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(ws, i);
    const v = totals.get(date) || 0;
    const ok = goal.kind === 'weekly' ? v > 0 : v >= need;
    const rest = goal.kind !== 'weekly' && !goal.activeDays.includes(weekday(date));
    return { date, today: date === today, state: date > today ? 'future' : ok ? 'done' : rest ? 'rest' : date === today ? 'today' : 'miss' };
  });
}

goals.post('/:id/checkins', async (req, res) => {
  const g = await loadGoal(req.params.id, req.user);
  const b = req.body || {};
  const today = req.today;
  const wso = weekStartsOn(req.user);
  const num = (v, max) => Math.min(max, Math.max(0, Number(v) || 0));
  const minutes = num(b.minutes, 1440);
  const pages = num(b.pages, 5000);
  const km = Math.round(num(b.km, 1000) * 100) / 100;

  let taskKey = '';
  if (g.shared?.tasks?.length) {
    taskKey = String(b.taskKey || '');
    if (!g.shared.tasks.some((t) => t.key === taskKey)) throw bad('Escolha uma tarefa do desafio.');
  }
  const unit = g.target?.unit;
  let value = b.value !== undefined ? num(b.value, 100000) : unit === 'min' ? minutes : unit === 'páginas' ? pages : unit === 'km' ? km : 1;
  if (g.kind === 'project' || taskKey) value = 1;
  if (value <= 0 && !minutes && !pages && !km) throw bad('Registre um valor maior que zero.');

  // Uma leitura só: objetivos, registros e conquistas do usuário. Antes e depois saem daqui, em memória.
  const uid = req.user._id;
  const [myGoals, myCheckins, have, season] = await Promise.all([
    Goal.find(goalsQuery(uid)).lean(),
    Checkin.find({ userId: uid }).lean(),
    ownedCodes(uid),
    currentSeason(today),
  ]);
  const shields = (await ensureShields(req.user, today)).shieldDates;
  const before = myCheckins.filter((c) => String(c.goalId) === String(g._id));
  const sBefore = computeStreak(g, before, today, wso, shields);
  const summaryBefore = summarize(req.user, myGoals, myCheckins, today);

  const update = { $inc: { value, minutes, pages, km } };
  if (b.note) update.$set = { note: String(b.note).slice(0, 280) };
  const checkin = await Checkin.findOneAndUpdate(
    { goalId: g._id, userId: uid, date: today, taskKey },
    update,
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();

  const swap = (list) => [...list.filter((c) => String(c._id) !== String(checkin._id)), checkin];
  const after = swap(before);
  const allAfter = swap(myCheckins);
  const sAfter = computeStreak(g, after, today, wso, shields);

  await Promise.all([
    grantXp(uid, `checkin:${g._id}:${today}${taskKey ? `:${taskKey}` : ''}`, XP.checkin, { have }),
    Streak.updateOne({ goalId: g._id, userId: uid }, { $set: { current: sAfter.current, best: sAfter.best, unit: sAfter.unit, lastDate: sAfter.lastDate } }, { upsert: true }),
  ]);

  const days = streakInDays(sAfter);
  const wanted = ['primeiro-passo'];
  if (sAfter.unit === 'days') {
    if (days >= 7) wanted.push('sequencia-7');
    if (days >= 30) wanted.push('sequencia-30');
    if (days >= 100) wanted.push('sequencia-100');
  } else {
    if (sAfter.current >= 1) wanted.push('semana-fechada');
    if (sAfter.current >= 4) wanted.push('quatro-semanas');
  }
  const earned = [];
  for (const code of wanted) {
    const a = await award(uid, code, undefined, { have });
    if (a) earned.push(a);
  }
  if (season && days >= 21) {
    const a = await award(uid, 'temporada-21', season._id, { have });
    if (a) earned.push(a);
  }

  if (g.shared?.mode === 'versus') {
    const everyone = await Checkin.find({ goalId: g._id }).lean();
    const ptsAfter = weeklyPoints(g, everyone, today);
    const ptsBefore = weeklyPoints(g, everyone.filter((c) => String(c._id) !== String(checkin._id)).concat(before.filter((c) => String(c._id) === String(checkin._id))), today);
    const meBefore = ptsBefore.get(String(uid)) || 0;
    const meAfter = ptsAfter.get(String(uid)) || 0;
    const passed = g.shared.participants.filter((p) => String(p) !== String(uid)).filter((p) => {
      const theirs = ptsAfter.get(String(p)) || 0;
      return theirs >= meBefore && theirs < meAfter;
    });
    await Promise.all(passed.map((p) => notify(p, { ...social.overtaken(req.user.name, g.title, meAfter - (ptsAfter.get(String(p)) || 0)), url: `/desafios/${g._id}` }, { type: 'challenges', dedupeKey: `ch:ot:${g._id}:${p}:${today}` })));
  }

  const fresh = await User.findById(uid);
  fresh._shields = req.user._shields;
  const summaryAfter = summarize(fresh, myGoals, allAfter, today);

  // Conquista em tela cheia só quando a sequência deste objetivo cruza um marco agora
  let celebration = null;
  const marks = CELEBRATE[sAfter.unit];
  const crossed = marks.find((m) => sBefore.current < m && sAfter.current >= m);
  if (crossed) {
    celebration = {
      kind: 'streak', count: crossed, unit: sAfter.unit, goalId: String(g._id), goalTitle: g.title, category: g.category,
      week: weekStrip(g, after, today, wso), golden: summaryAfter.golden, becameGolden: !summaryBefore.golden && summaryAfter.golden,
      checkinId: String(checkin._id),
    };
  }

  res.status(201).json({
    checkin: { id: String(checkin._id), date: checkin.date, value: checkin.value, minutes: checkin.minutes, pages: checkin.pages, km: checkin.km, note: checkin.note },
    goal: await goalView(g.toObject(), fresh, today, g.shared ? {} : { all: after }),
    celebration,
    achievements: earned,
    me: { level: fresh.level, xp: fresh.xp, golden: summaryAfter.golden, stage: summaryAfter.stage, leveledUp: fresh.level > req.user.level },
  });
});

// Desfazer o registro de hoje. O XP já ganho fica (o nível nunca regride).
goals.delete('/:id/checkins/today', async (req, res) => {
  const g = await loadGoal(req.params.id, req.user);
  await Checkin.deleteOne({ goalId: g._id, userId: req.user._id, date: req.today, taskKey: String(req.query.taskKey || '') });
  await refreshStreakCache(g, req.user._id, req.today, weekStartsOn(req.user));
  res.json({ goal: await goalView(g.toObject(), req.user, req.today) });
});

goals.post('/:id/milestones', async (req, res) => {
  const g = await loadGoal(req.params.id, req.user);
  if (g.kind !== 'project') throw bad('Marcos são só para projetos.');
  const title = String(req.body?.title || '').trim().slice(0, 80);
  if (!title) throw bad('Dê um nome ao marco.');
  g.milestones.push({ title });
  await g.save();
  res.status(201).json(await goalView(g.toObject(), req.user, req.today));
});

goals.patch('/:id/milestones/:mid', async (req, res) => {
  const g = await loadGoal(req.params.id, req.user);
  const m = g.milestones.id(req.params.mid);
  if (!m) throw notFound('Marco não encontrado.');
  const wasDone = m.done;
  if (req.body?.title) m.title = String(req.body.title).trim().slice(0, 80);
  if (req.body?.done !== undefined) {
    m.done = Boolean(req.body.done);
    m.doneAt = m.done ? req.today : undefined;
  }
  await g.save();
  let celebration = null;
  const earned = [];
  if (!wasDone && m.done) {
    // Concluir um marco também conta como avanço no projeto hoje
    await Checkin.updateOne(
      { goalId: g._id, userId: req.user._id, date: req.today, taskKey: '' },
      { $setOnInsert: { value: 1 } },
      { upsert: true },
    );
    await refreshStreakCache(g, req.user._id, req.today, weekStartsOn(req.user));
    await grantXp(req.user._id, `milestone:${m._id}`, XP.milestone);
    const a = await award(req.user._id, 'marco');
    if (a) earned.push(a);
    const all = g.milestones.every((x) => x.done);
    if (all) {
      const b = await award(req.user._id, 'projeto-concluido');
      if (b) earned.push(b);
    }
    celebration = { kind: 'milestone', title: m.title, goalId: String(g._id), goalTitle: g.title, category: g.category, finished: all, milestoneId: String(m._id) };
  }
  const fresh = await User.findById(req.user._id);
  res.json({ goal: await goalView(g.toObject(), fresh, req.today), celebration, achievements: earned });
});
