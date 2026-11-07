// Lembrete de check-in: no horário escolhido, um por dia, só se faltar algo (DESIGN.md §8.9).
// Chamado de 15 em 15 minutos pelo cron-job.org (rota /api/cron/reminders).
import { PushSubscription, PushLog, User, Checkin } from '../models/index.js';
import { userGoals, streakSummary } from './progress.js';
import { friendIds } from './social.js';
import { localParts, sendPush, recentMessageIds, remember } from './push.js';
import { REMINDERS, chooseMessage } from './pushMessages.js';
import { weeklySummary } from './weekly.js';

const UNIT_LABEL = { copos: 'copos', treinos: 'treinos', 'lições': 'lições', min: 'min', 'páginas': 'páginas' };

/** Monta o contexto que as mensagens usam: o que falta, sequências, amigos e desafio. */
export async function reminderContext(user, date, hour) {
  const goals = await userGoals(user, date);
  const pending = goals
    .filter((g) => g.status.activeToday && g.kind !== 'project' && !g.status.periodDone && !(g.shared?.tasks?.length))
    .map((g) => ({
      title: g.title, category: g.category, kind: g.kind, streak: g.streak.current, unit: g.streak.unit,
      need: g.status.need, todayValue: g.status.todayValue, weekValue: g.status.weekValue, unitLabel: UNIT_LABEL[g.target?.unit] || g.target?.unit || '',
    }));
  if (!pending.length) return null;

  const [summary, friends] = await Promise.all([streakSummary(user, date), friendIds(user._id)]);
  const doneIds = friends.length ? await Checkin.distinct('userId', { userId: { $in: friends }, date }) : [];
  const friendsDone = doneIds.length ? (await User.find({ _id: { $in: doneIds.slice(0, 5) } }, { name: 1 }).lean()).map((u) => u.name.split(' ')[0]) : [];

  let challenge = null;
  const versus = goals.find((g) => g.shared?.ranking && !g.shared.ended);
  if (versus) {
    const mine = versus.shared.ranking.find((r) => r.me);
    const ahead = versus.shared.ranking[mine.position - 2];
    challenge = { title: versus.title, position: mine.position, aheadName: ahead?.name.split(' ')[0] || null, gap: ahead ? ahead.points - mine.points : 0 };
  }
  const comeback = pending.every((g) => g.streak === 0) && goals.some((g) => g.streak.best >= 3);
  return { pending, total: goals.filter((g) => g.status.activeToday && g.kind !== 'project').length, maxDays: summary.maxDays, golden: summary.golden, friendsDone, challenge, hour, comeback };
}

const WEEKLY_TEXTS = [
  (s) => ({ title: 'Sua semana virou story', body: `${s.activeDays} de 7 dias ativos. O Broto já posou pra foto.` }),
  (s) => ({ title: `${s.activeDays} de 7: sua semana está pronta`, body: 'Um card pronto pra postar no Instagram. Bora mostrar?' }),
  (s) => ({ title: 'Resumo da semana saiu do forno', body: s.bestStreak >= 7 ? `${s.bestStreak} dias seguidos e Broto dourado. Isso merece um story.` : `${s.checkins} registros nesta semana. Isso merece um story.` }),
];

/** Domingo à noite: avisa que o resumo da semana está pronto (uma vez por semana, só se teve dia ativo). */
export async function runWeeklyRecap(now = new Date()) {
  const ids = await PushSubscription.distinct('userId');
  const users = await User.find({ _id: { $in: ids }, 'prefs.notify.checkin': { $ne: false } });
  let sent = 0;
  for (const user of users) {
    try {
      const { date, time } = localParts(user.timeZone, now);
      if (new Date(`${date}T12:00:00Z`).getUTCDay() !== 0 || time < '19:00' || time >= '22:00') continue;
      if (await PushLog.exists({ userId: user._id, key: `weekly:${date}` })) continue;
      const s = await weeklySummary(user, date);
      if (!s.activeDays) continue;
      const msg = WEEKLY_TEXTS[Math.floor(Math.random() * WEEKLY_TEXTS.length)](s);
      const n = await sendPush(user._id, { ...msg, url: '/semana', tag: 'weekly' }, { type: 'reminder', dedupeKey: `weekly:${date}`, quiet: false, user });
      if (n) sent += 1;
    } catch (e) {
      console.error('[weekly]', String(user._id), e.message);
    }
  }
  return sent;
}

export async function runReminders(now = new Date()) {
  const ids = await PushSubscription.distinct('userId');
  const users = await User.find({ _id: { $in: ids }, 'prefs.notify.checkin': { $ne: false } });
  const result = { checked: users.length, sent: 0, skipped: 0 };
  for (const user of users) {
    try {
      const { date, time, hour } = localParts(user.timeZone, now);
      // No horário escolhido ou depois, e nunca muito tarde da noite
      if (time < (user.prefs.reminderTime || '20:00') || time >= '23:30') { result.skipped += 1; continue; }
      if (await PushLog.exists({ userId: user._id, key: `reminder:${date}` })) { result.skipped += 1; continue; }
      const ctx = await reminderContext(user, date, hour);
      if (!ctx) { result.skipped += 1; continue; } // não falta nada hoje: nada de aviso
      const msg = chooseMessage(REMINDERS, ctx, await recentMessageIds(user._id));
      const n = await sendPush(user._id, { title: msg.title, body: msg.body, url: '/metas', tag: 'reminder' }, { type: 'reminder', dedupeKey: `reminder:${date}`, quiet: false, user });
      if (n) { result.sent += 1; await remember(user._id, `msg:${msg.id}:${date}`); }
    } catch (e) {
      console.error('[reminder]', String(user._id), e.message);
    }
  }
  return result;
}

