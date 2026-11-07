// Envio de notificações push (Web Push). Respeita as escolhas da pessoa em Configurações,
// não manda avisos sociais de madrugada e nunca repete o mesmo aviso (DESIGN.md §8.9).
import * as webpush from 'web-push';
import { config } from '../config.js';
import { PushSubscription, PushLog, User } from '../models/index.js';

export const pushReady = () => Boolean(config.vapidPublicKey && config.vapidPrivateKey);
if (pushReady()) webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);

const PREF = { reminder: 'checkin', social: 'social', challenges: 'challenges' };

/** Data e hora locais de alguém, pelo fuso guardado no perfil. */
export function localParts(timeZone = 'America/Sao_Paulo', at = new Date()) {
  let tz = timeZone;
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); } catch { tz = 'America/Sao_Paulo'; }
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
  return { date, time, hour: Number(time.slice(0, 2)) };
}

/** Marca algo como já enviado. Retorna false se já tinha sido (assim nunca manda duas vezes). */
export async function remember(userId, key) {
  try {
    await PushLog.create({ userId, key });
    return true;
  } catch (e) {
    if (e.code === 11000) return false;
    throw e;
  }
}

/** Ids das últimas mensagens de lembrete, para variar. */
export async function recentMessageIds(userId, limit = 6) {
  const rows = await PushLog.find({ userId, key: /^msg:/ }).sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map((r) => r.key.split(':')[1]);
}

/**
 * Envia para todos os aparelhos da pessoa.
 * type: 'reminder' | 'social' | 'challenges'. dedupeKey: evita repetição. quiet: respeita 22h–8h.
 */
export async function sendPush(userId, { title, body, url = '/', tag }, { type, dedupeKey, quiet = true, user: given } = {}) {
  if (!pushReady()) return 0;
  const user = given || (await User.findById(userId, { prefs: 1, timeZone: 1 }).lean());
  if (!user) return 0;
  if (type && user.prefs?.notify?.[PREF[type]] === false) return 0;
  if (quiet) {
    const { hour } = localParts(user.timeZone);
    if (hour >= 22 || hour < 8) return 0;
  }
  const subs = await PushSubscription.find({ userId }).lean();
  if (!subs.length) return 0;
  if (dedupeKey && !(await remember(userId, dedupeKey))) return 0;
  const payload = JSON.stringify({ title, body, url, tag: tag || type || 'nobi' });
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 60 * 60 * 12, urgency: type === 'reminder' ? 'normal' : 'low' });
      sent += 1;
      await PushSubscription.updateOne({ _id: s._id }, { lastSuccessAt: new Date() });
    } catch (e) {
      // Aparelho desinstalou o app ou revogou a permissão: esquece a inscrição
      if (e.statusCode === 404 || e.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id });
      else console.error('[push]', e.statusCode || '', e.body || e.message);
    }
  }));
  return sent;
}

/** Para chamar depois de uma ação (reação, convite...) sem deixar a resposta lenta: no máximo 2,5 s. */
export async function notify(userId, message, options) {
  try {
    await Promise.race([sendPush(userId, message, options), new Promise((r) => setTimeout(r, 2500))]);
  } catch (e) {
    console.error('[push]', e.message);
  }
}
