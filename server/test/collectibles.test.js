import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { Achievement, Season } = await import('../src/models/index.js');
const { grantSeasonAccessory } = await import('../src/services/collectibles.js');

let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const call = (method, p, body, token) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const signup = async (n) => (await call('POST', '/auth/signup', { name: n, email: `${n}${Date.now()}@t.dev`, password: 'senha1234' })).body;

test('acessórios do Broto: conquista libera, temporada dá um por estação, só veste o que é seu', async () => {
  const ana = await signup('Ana');
  const col = async () => (await call('GET', '/me/collection', null, ana.token)).body;
  assert.equal((await col()).items.filter((i) => i.earnedAt).length, 0);
  assert.equal((await call('PUT', '/me/broto', { accessory: 'faixa' }, ana.token)).status, 400, 'ainda não é dela');

  await Achievement.create({ userId: ana.me.id, code: 'sequencia-7' });
  assert.ok((await col()).items.find((i) => i.id === 'faixa').earnedAt, '7 dias libera a faixa');
  assert.equal((await call('PUT', '/me/broto', { accessory: 'faixa' }, ana.token)).status, 200);
  assert.equal((await call('GET', '/me', null, ana.token)).body.brotoAccessory, 'faixa');
  assert.equal((await call('GET', `/users/${ana.me.username}`, null, ana.token)).body.brotoAccessory, 'faixa', 'aparece no perfil');

  const primavera = await Season.create({ name: 'Primavera', startsAt: '2031-09-22', endsAt: '2031-12-14' });
  const verao = await Season.create({ name: 'Verão', startsAt: '2031-12-22', endsAt: '2032-03-14' });
  assert.equal((await grantSeasonAccessory(ana.me.id, primavera)).id, 'coroa-flores');
  assert.equal(await grantSeasonAccessory(ana.me.id, primavera), null, 'uma vez só');
  assert.equal((await grantSeasonAccessory(ana.me.id, verao)).id, 'oculos-sol', 'outra temporada, outro acessório');
  assert.deepEqual((await col()).items.filter((i) => i.earnedAt).map((i) => i.id).sort(), ['coroa-flores', 'faixa', 'oculos-sol']);

  assert.equal((await call('PUT', '/me/broto', { accessory: null }, ana.token)).body.brotoAccessory, null, 'tirar o acessório');
  assert.equal((await call('PUT', '/me/broto', { accessory: 'coroa' }, ana.token)).status, 400);
});

test('check-in que fecha 7 dias avisa o acessório novo', async () => {
  const bia = await signup('Bia');
  const g = (await call('POST', '/goals', { title: 'Ler', category: 'leitura', kind: 'daily', target: { amount: 1, unit: '' } }, bia.token)).body;
  const { Checkin, Goal } = await import('../src/models/index.js');
  const { addDays } = await import('../src/lib/dates.js');
  const today = new Date().toISOString().slice(0, 10);
  await Goal.updateOne({ _id: g.id }, { startsAt: addDays(today, -10) });
  for (let i = 6; i >= 1; i--) await Checkin.create({ goalId: g.id, userId: bia.me.id, date: addDays(today, -i), value: 1 });
  const r = (await call('POST', `/goals/${g.id}/checkins`, { value: 1, date: today }, bia.token)).body;
  assert.deepEqual(r.accessories, [{ id: 'faixa', name: 'Faixa da constância' }]);
});

test('ano no Nobi: dias ativos, maior sequência do ano, mês a mês e torcida', async () => {
  const { longestRun, yearToShow } = await import('../src/services/yearly.js');
  assert.equal(longestRun(new Set(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-05', '2026-01-06'])), 3);
  assert.equal(yearToShow('2027-01-10'), 2026, 'em janeiro mostra o ano que acabou');
  assert.equal(yearToShow('2026-12-02'), 2026);
  const ana = await signup('Ana');
  const { Checkin, Goal } = await import('../src/models/index.js');
  const g = await Goal.create({ ownerId: ana.me.id, title: 'Correr', category: 'treino', kind: 'daily' });
  for (const d of ['2025-03-01', '2025-03-02', '2025-03-03', '2025-07-10']) await Checkin.create({ goalId: g._id, userId: ana.me.id, date: d, value: 1, km: 5 });
  const y = (await call('GET', '/me/year?year=2025', null, ana.token)).body;
  assert.equal(y.activeDays, 4);
  assert.equal(y.longestRun, 3);
  assert.equal(y.km, 20);
  assert.equal(y.months[2], 3);
  assert.equal(y.bestMonth, 2);
  assert.deepEqual(y.topGoals, [{ title: 'Correr', category: 'treino', days: 4 }]);
  assert.equal(y.complete, true);
});
