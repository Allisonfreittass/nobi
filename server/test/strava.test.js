import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';
process.env.STRAVA_CLIENT_ID = '123';
process.env.STRAVA_CLIENT_SECRET = 'segredo';

const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const activities = [
  { id: 1, sport_type: 'Run', name: 'Corrida leve', start_date_local: `${day(1)}T07:00:00Z`, moving_time: 1800, distance: 5200 },
  { id: 2, sport_type: 'Ride', name: 'Pedal', start_date_local: `${day(2)}T07:00:00Z`, moving_time: 3600, distance: 20000 },
  { id: 3, sport_type: 'Snowboard', name: 'não conta', start_date_local: `${day(2)}T09:00:00Z`, moving_time: 600, distance: 0 },
];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u === 'https://www.strava.com/oauth/token') return new Response(JSON.stringify({ access_token: 'a1', refresh_token: 'r1', expires_at: Math.floor(Date.now() / 1000) + 3600, athlete: { id: 9, firstname: 'Ana', lastname: 'S' } }), { status: 200 });
  if (u.startsWith('https://www.strava.com/api/v3/athlete/activities')) return new Response(JSON.stringify(activities), { status: 200 });
  if (u.startsWith('https://www.strava.com/oauth/deauthorize')) return new Response('{}', { status: 200 });
  return realFetch(url, opts);
};

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { Checkin } = await import('../src/models/index.js');

let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const call = (method, p, body, token) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

test('Strava: conecta, importa treinos uma vez só, soma com o registro do dia e desconecta', async () => {
  const ana = (await call('POST', '/auth/signup', { name: 'Ana', email: `ana${Date.now()}@t.dev`, password: 'senha1234' })).body;
  const g = (await call('POST', '/goals', { title: 'Treinar', category: 'treino', kind: 'daily', target: { amount: 20, unit: 'min' } }, ana.token)).body;
  const { url } = (await call('GET', '/strava/connect', null, ana.token)).body;
  const state = new URL(url).searchParams.get('state');
  assert.equal(new URL(url).searchParams.get("scope"), "activity:read");
  assert.equal((await call('POST', '/strava/exchange', { code: 'c', state: 'falso' }, ana.token)).status, 400, 'state falso');
  const c = (await call('POST', '/strava/exchange', { code: 'c', state, scope: 'read,activity:read' }, ana.token)).body;
  assert.equal(c.connected, true);
  assert.equal(c.name, 'Ana S');
  assert.equal(c.goalId, g.id, 'escolhe o objetivo de treino sozinho');

  await Checkin.create({ goalId: g.id, userId: ana.me.id, date: day(1), value: 10, minutes: 10 }); // registro à mão no mesmo dia
  const s1 = (await call('POST', '/strava/sync', null, ana.token)).body;
  assert.equal(s1.imported, 2, 'Snowboard não é treino suportado');
  const d1 = await Checkin.findOne({ goalId: g.id, date: day(1) }).lean();
  assert.equal(d1.minutes, 40, 'somou 30 min do Strava aos 10 à mão');
  assert.equal(d1.km, 5.2);
  assert.equal((await call('POST', '/strava/sync', null, ana.token)).body.imported, 0, 'não importa de novo');
  const me = (await call('GET', '/me/export', null, ana.token)).body;
  assert.equal(JSON.stringify(me).includes('r1'), false, 'tokens nunca saem do servidor');
  assert.equal((await call('POST', '/strava/disconnect', null, ana.token)).body.connected, false);
});
