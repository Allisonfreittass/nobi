// Importar treinos do Strava: conectar (OAuth), escolher o objetivo de treino e sincronizar.
// Cada atividade vira um registro no dia dela (minutos e km), uma vez só. Os tokens ficam só no servidor.
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { Goal, Checkin, StravaImport } from '../models/index.js';
import { bad, HttpError } from '../lib/http.js';
import { refreshStreakCache, weekStartsOn } from '../services/progress.js';
import { grantXp } from '../services/achievements.js';
import { XP } from '../services/level.js';

export const strava = Router();
const API = 'https://www.strava.com';
const SPORTS = new Set(['Run', 'TrailRun', 'VirtualRun', 'Ride', 'VirtualRide', 'EBikeRide', 'GravelRide', 'MountainBikeRide', 'Walk', 'Hike', 'Swim', 'Workout', 'WeightTraining', 'Yoga', 'Crossfit', 'Elliptical', 'StairStepper', 'Rowing', 'Pilates', 'HighIntensityIntervalTraining']);
const ready = () => Boolean(config.stravaClientId && config.stravaClientSecret);
const redirectUri = () => `${config.webOrigin}/strava/retorno`;
function need() { if (!ready()) throw new HttpError(501, 'A integração com o Strava não está configurada.'); }

async function token(body) {
  const r = await fetch(`${API}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ client_id: config.stravaClientId, client_secret: config.stravaClientSecret, ...body }),
  });
  if (!r.ok) throw new HttpError(502, 'O Strava não aceitou a conexão. Tente de novo.');
  return r.json();
}

/** Token válido (renova se faltar menos de 1 min). */
async function accessToken(user) {
  const s = user.strava;
  if (s.expiresAt * 1000 > Date.now() + 60000) return s.accessToken;
  const t = await token({ grant_type: 'refresh_token', refresh_token: s.refreshToken });
  Object.assign(user.strava, { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at });
  user.markModified('strava');
  await user.save();
  return t.access_token;
}

const view = (user) => ({
  available: ready(),
  connected: Boolean(user.strava?.accessToken),
  name: user.strava?.name || null,
  goalId: user.strava?.goalId ? String(user.strava.goalId) : null,
  lastSyncAt: user.strava?.lastSyncAt || null,
});

strava.get('/', (req, res) => res.json(view(req.user)));

strava.get('/connect', (req, res) => {
  need();
  const state = jwt.sign({ sub: String(req.user._id), p: 'strava' }, config.jwtSecret, { expiresIn: '15m' });
  const url = `${API}/oauth/authorize?client_id=${encodeURIComponent(config.stravaClientId)}&response_type=code&approval_prompt=auto&scope=activity:read&redirect_uri=${encodeURIComponent(redirectUri())}&state=${encodeURIComponent(state)}`;
  res.json({ url });
});

strava.post('/exchange', async (req, res) => {
  need();
  let st;
  try { st = jwt.verify(String(req.body?.state || ''), config.jwtSecret); } catch { throw bad('Conexão expirada. Tente conectar de novo.'); }
  if (st.p !== 'strava' || st.sub !== String(req.user._id)) throw bad('Conexão inválida.');
  if (!String(req.body?.scope || 'activity:read').includes('activity:read')) throw bad('Precisamos da permissão de ver suas atividades para importar.');
  const t = await token({ grant_type: 'authorization_code', code: String(req.body?.code || '') });
  // Sugere o primeiro objetivo de treino da pessoa
  const goal = await Goal.findOne({ ownerId: req.user._id, category: 'treino', archivedAt: null, kind: { $ne: 'project' } }).lean();
  req.user.strava = {
    athleteId: String(t.athlete?.id || ''), name: [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(' '),
    accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at,
    goalId: goal?._id || null, lastSyncAt: null, connectedAt: new Date(),
  };
  await req.user.save();
  res.json(view(req.user));
});

strava.put('/goal', async (req, res) => {
  if (!req.user.strava) throw bad('Conecte o Strava primeiro.');
  const g = await Goal.findOne({ _id: req.body?.goalId, ownerId: req.user._id, archivedAt: null }).lean();
  if (!g || g.kind === 'project' || g.shared?.tasks?.length) throw bad('Escolha um objetivo de treino.');
  req.user.strava.goalId = g._id;
  req.user.markModified('strava');
  await req.user.save();
  res.json(view(req.user));
});

/** Transforma atividades do Strava em registros (função pura, testada). */
export function toCheckins(activities, goal) {
  const unit = goal.target?.unit;
  return activities.filter((a) => SPORTS.has(a.sport_type || a.type) && a.start_date_local).map((a) => {
    const minutes = Math.round((a.moving_time || 0) / 60);
    const km = Math.round(((a.distance || 0) / 1000) * 100) / 100;
    return { activityId: String(a.id), date: String(a.start_date_local).slice(0, 10), minutes, km, value: unit === 'min' ? minutes : unit === 'km' ? km : 1, name: a.name || '' };
  });
}

strava.post('/sync', async (req, res) => {
  need();
  const user = req.user;
  if (!user.strava?.accessToken) throw bad('Conecte o Strava primeiro.');
  const goal = user.strava.goalId && await Goal.findOne({ _id: user.strava.goalId, archivedAt: null }).lean();
  if (!goal) throw bad('Escolha o objetivo que recebe os treinos.');
  // Primeira vez: últimos 30 dias. Depois, desde a última sincronização (com folga de 1 dia)
  const since = user.strava.lastSyncAt ? new Date(user.strava.lastSyncAt).getTime() - 86400000 : Date.now() - 30 * 86400000;
  const tk = await accessToken(user);
  const r = await fetch(`${API}/api/v3/athlete/activities?after=${Math.floor(since / 1000)}&per_page=100`, { headers: { Authorization: `Bearer ${tk}` }, signal: AbortSignal.timeout(10000) });
  if (r.status === 401) throw bad('O Strava pediu para conectar de novo.');
  if (!r.ok) throw new HttpError(502, 'Não deu para falar com o Strava agora.');
  const items = toCheckins(await r.json(), goal).filter((c) => c.date <= req.today);
  let imported = 0;
  for (const c of items) {
    try {
      await StravaImport.create({ userId: user._id, activityId: c.activityId, goalId: goal._id, date: c.date });
    } catch (e) { if (e.code === 11000) continue; throw e; }
    // Mesmo dia de um registro feito à mão: soma (como registrar de novo no mesmo dia)
    await Checkin.updateOne(
      { goalId: goal._id, userId: user._id, date: c.date, taskKey: '' },
      { $inc: { value: c.value, minutes: c.minutes, km: c.km }, $setOnInsert: { note: c.name ? `Strava: ${c.name}`.slice(0, 280) : 'Strava' } },
      { upsert: true },
    );
    await grantXp(user._id, `checkin:${goal._id}:${c.date}`, XP.checkin);
    imported += 1;
  }
  if (imported) await refreshStreakCache(goal, user._id, req.today, weekStartsOn(user));
  user.strava.lastSyncAt = new Date();
  user.markModified('strava');
  await user.save();
  res.json({ ...view(user), imported });
});

strava.post('/disconnect', async (req, res) => {
  const s = req.user.strava;
  if (s?.accessToken) {
    await fetch(`${API}/oauth/deauthorize`, { method: 'POST', headers: { Authorization: `Bearer ${s.accessToken}` }, signal: AbortSignal.timeout(5000) }).catch(() => {});
  }
  req.user.strava = null;
  await req.user.save();
  res.json(view(req.user));
});
