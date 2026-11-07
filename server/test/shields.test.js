import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';

const { earnDates, balanceAt, SHIELD_MAX } = await import('../src/services/shields.js');
const { addDays, weekStart } = await import('../src/lib/dates.js');
const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { Goal, Checkin, ShieldUse } = await import('../src/models/index.js');

test('ganha 1 escudo por semana com 5+ dias ativos', () => {
  const ws = '2026-10-05'; // segunda
  const five = new Set([0, 1, 2, 3, 4].map((i) => addDays(ws, i)));
  assert.deepEqual(earnDates(five, '2026-10-20'), ['2026-10-12']);
  const four = new Set([0, 1, 2, 3].map((i) => addDays(ws, i)));
  assert.deepEqual(earnDates(four, '2026-10-20'), []);
  assert.deepEqual(earnDates(five, '2026-10-11'), [], 'semana ainda em andamento não conta');
});

test('guarda no máximo 3 e o uso desconta', () => {
  const earns = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'];
  assert.equal(balanceAt('2026-10-10', earns, []), SHIELD_MAX);
  assert.equal(balanceAt('2026-10-10', earns, ['2026-10-08']), 2);
  assert.equal(balanceAt('2026-10-08', earns, ['2026-10-08']), 3, 'o uso do dia vale a partir do dia seguinte');
});

let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const call = (method, p, body, token) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', 'X-Local-Date': today, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const signup = async (n) => (await call('POST', '/auth/signup', { name: n, email: `${n}${Date.now()}@t.dev`, password: 'senha1234' })).body;

test('escudo protege o dia perdido e a sequência continua', async () => {
  const { token, me } = await signup('Escudo');
  // Semana completa há duas semanas (ganha 1 escudo) e sequência até anteontem; ontem sem registro
  const created = new Date(`${addDays(today, -30)}T12:00:00Z`);
  const g = await Goal.create({ ownerId: me.id, title: 'Ler', category: 'leitura', kind: 'daily', createdAt: created });
  const lastWeek = weekStart(addDays(today, -14), 1);
  const dates = new Set([0, 1, 2, 3, 4].map((i) => addDays(lastWeek, i)));
  for (let i = 2; i <= 6; i++) dates.add(addDays(today, -i));
  for (const date of dates) await Checkin.create({ goalId: g._id, userId: me.id, date, value: 1 });

  const view = (await call('GET', `/goals/${g._id}`, null, token)).body;
  assert.ok(await ShieldUse.exists({ userId: me.id, date: addDays(today, -1) }), 'ontem protegido');
  assert.equal(view.streak.current, 5, 'sequência não quebrou (ontem conta como descanso)');
  const meView = (await call('GET', '/me', null, token)).body;
  assert.deepEqual(meView.shields.protectedDays, [addDays(today, -1)]);
  assert.equal(meView.shields.available, 0, 'o escudo foi usado');

  await call('POST', '/me/shields/seen', null, token);
  assert.deepEqual((await call('GET', '/me', null, token)).body.shields.protectedDays, []);
});

test('sem escudo ou sem sequência viva, nada é gasto', async () => {
  const { token, me } = await signup('SemEscudo');
  const g = await Goal.create({ ownerId: me.id, title: 'Correr', category: 'treino', kind: 'daily', createdAt: new Date(`${addDays(today, -20)}T12:00:00Z`) });
  for (let i = 2; i <= 4; i++) await Checkin.create({ goalId: g._id, userId: me.id, date: addDays(today, -i), value: 1 });
  const view = (await call('GET', `/goals/${g._id}`, null, token)).body;
  assert.equal(await ShieldUse.countDocuments({ userId: me.id }), 0, 'sem saldo não usa');
  assert.equal(view.streak.current, 0, 'sequência quebrou de verdade');
});
