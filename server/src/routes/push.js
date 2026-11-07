import { Router } from 'express';
import crypto from 'node:crypto';
import { PushSubscription } from '../models/index.js';
import { bad, HttpError } from '../lib/http.js';
import { config } from '../config.js';
import { pushReady, sendPush } from '../services/push.js';
import { runReminders, runWeeklyRecap } from '../services/reminders.js';

export const push = Router();

push.get('/key', (_req, res) => res.json({ key: pushReady() ? config.vapidPublicKey : null }));

push.post('/subscribe', async (req, res) => {
  if (!pushReady()) throw new HttpError(503, 'Notificações ainda não estão configuradas.');
  const s = req.body?.subscription;
  if (!s?.endpoint || !/^https:\/\//.test(s.endpoint) || !s.keys?.p256dh || !s.keys?.auth) throw bad('Inscrição inválida.');
  await PushSubscription.updateOne(
    { endpoint: s.endpoint },
    { $set: { userId: req.user._id, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, userAgent: String(req.get('User-Agent') || '').slice(0, 200) } },
    { upsert: true },
  );
  res.status(201).json({ ok: true });
});

push.delete('/subscribe', async (req, res) => {
  await PushSubscription.deleteOne({ endpoint: String(req.body?.endpoint || ''), userId: req.user._id });
  res.json({ ok: true });
});

push.post('/test', async (req, res) => {
  const n = await sendPush(req.user._id, { title: 'Oi, aqui é o Broto', body: 'As notificações estão funcionando. Prometo só aparecer quando valer a pena.', url: '/', tag: 'test' }, { quiet: false });
  if (!n) throw bad('Nenhum aparelho com notificações ativas.');
  res.json({ sent: n });
});

export const cron = Router();

// Protegida por segredo: o cron-job.org manda "Authorization: Bearer <CRON_SECRET>"
cron.all('/reminders', async (req, res) => {
  if (!config.cronSecret) throw new HttpError(503, 'CRON_SECRET não está configurado no servidor.');
  const given = ((req.get('Authorization') || '').trim().replace(/^Bearer\s+/i, '') || String(req.query.key || '')).trim();
  const ok = config.cronSecret && given.length === config.cronSecret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(config.cronSecret));
  if (!ok) throw new HttpError(401, 'Não autorizado.');
  const result = await runReminders();
  result.weekly = await runWeeklyRecap();
  res.json(result);
});
