import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { pairStreak } = await import('../src/routes/pairs.js');
const { Pair, Checkin, ShieldUse } = await import('../src/models/index.js');
const { addDays } = await import('../src/lib/dates.js');

let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const call = (method, p, body, token) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const signup = async (n) => (await call('POST', '/auth/signup', { name: n, email: `${n}${Date.now()}${Math.random().toString(36).slice(2, 5)}@t.dev`, password: 'senha1234' })).body;

test('conta só os dias em que os dois fizeram; hoje pendente não quebra', () => {
  const t = '2026-11-09';
  const d = (n) => addDays(t, -n);
  const a = new Set([d(3), d(2), d(1)]);
  const b = new Set([d(3), d(2), d(1), t]);
  assert.equal(pairStreak(a, b, d(10), t), 3, 'hoje só um fez: vale até ontem');
  a.add(t);
  assert.equal(pairStreak(a, b, d(10), t), 4);
  assert.equal(pairStreak(a, b, d(1), t), 2, 'não conta antes de começar');
  b.delete(d(2));
  assert.equal(pairStreak(a, b, d(10), t), 2, 'dia em que um não fez quebra');
});

test('convite, aceite, escudo conta, cutucar e encerrar', async () => {
  const [ana, beto, caio] = await Promise.all([signup('Ana'), signup('Beto'), signup('Caio')]);
  await call('POST', `/users/${ana.me.username}/invite`, {}, beto.token);
  assert.equal((await call('POST', '/pairs', { userId: caio.me.id }, ana.token)).status, 400, 'só amigos');
  const p = (await call('POST', '/pairs', { userId: beto.me.id }, ana.token)).body;
  assert.equal(p.status, 'pending');
  assert.equal((await call('POST', '/pairs', { userId: ana.me.id }, beto.token)).status, 400, 'uma por dupla');
  assert.equal((await call('POST', `/pairs/${p.id}/accept`, null, ana.token)).status, 400, 'quem convidou não aceita');
  const note = (await call('GET', '/home/notifications', null, beto.token)).body.items.find((i) => i.type === 'pair-invite');
  assert.equal(note.pairId, p.id);
  const active = (await call('POST', `/pairs/${p.id}/accept`, null, beto.token)).body;
  assert.equal(active.status, 'active');

  // Começou há 3 dias: dois dias completos, um deles com escudo do Beto
  const today = active.startedAt;
  await Pair.updateOne({ _id: p.id }, { startedAt: addDays(today, -2) });
  const { Goal } = await import('../src/models/index.js');
  const g = await Goal.create({ ownerId: ana.me.id, title: 'x', category: 'habito', kind: 'daily' });
  const h = await Goal.create({ ownerId: beto.me.id, title: 'y', category: 'habito', kind: 'daily' });
  for (const n of [2, 1]) await Checkin.create({ goalId: g._id, userId: ana.me.id, date: addDays(today, -n), value: 1 });
  await Checkin.create({ goalId: h._id, userId: beto.me.id, date: addDays(today, -2), value: 1 });
  await ShieldUse.create({ userId: beto.me.id, date: addDays(today, -1) });
  let list = (await call('GET', '/pairs', null, ana.token)).body;
  assert.equal(list[0].streak, 2, 'escudo do Beto segura o dia');
  assert.equal(list[0].partner.name, 'Beto');

  assert.equal((await call('POST', `/pairs/${p.id}/nudge`, null, ana.token)).status, 200);
  assert.equal((await call('POST', `/pairs/${p.id}/nudge`, null, ana.token)).status, 400, 'uma por dia');
  assert.ok((await call('GET', '/home/notifications', null, beto.token)).body.items.some((i) => i.type === 'pair-nudge'));

  assert.equal((await call('DELETE', `/pairs/${p.id}`, null, caio.token)).status, 404);
  await call('DELETE', `/pairs/${p.id}`, null, beto.token);
  list = (await call('GET', '/pairs', null, ana.token)).body;
  assert.equal(list.length, 0);
});
