import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';

const { addDays } = await import('../src/lib/dates.js');
const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { Goal, Checkin } = await import('../src/models/index.js');

let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const call = (method, p, body, token) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', 'X-Local-Date': today, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const signup = async (n) => (await call('POST', '/auth/signup', { name: n, email: `${n}${Date.now()}@t.dev`, password: 'senha1234' })).body;

async function withCheckins(name, daysAgo) {
  const { token, me } = await signup(name);
  const g = await Goal.create({ ownerId: me.id, title: 'Ler', category: 'leitura', kind: 'daily', createdAt: new Date(`${addDays(today, -20)}T12:00:00Z`) });
  for (const d of daysAgo) await Checkin.create({ goalId: g._id, userId: me.id, date: addDays(today, -d), value: 1 });
  return { token, goal: g, me };
}

test('quem nunca registrou não vê a tela de volta', async () => {
  const { token } = await signup('Novo');
  assert.equal((await call('GET', '/me', null, token)).body.comeback, null);
});

test('volta depois de 5 dias: aparece uma vez e some depois de vista', async () => {
  const { token } = await withCheckins('Volta', [6, 5]);
  const first = (await call('GET', '/me', null, token)).body.comeback;
  assert.equal(first.days, 5);
  assert.equal(first.since, addDays(today, -5));
  assert.equal(first.streakKept, false, 'sequência zerou');

  assert.equal((await call('POST', '/me/comeback/seen', null, token)).status, 200);
  assert.equal((await call('GET', '/me', null, token)).body.comeback, null, 'não repete na mesma ausência');
});

test('ausência curta ou registro hoje não mostram a tela', async () => {
  const short = await withCheckins('Curta', [3, 2]);
  assert.equal((await call('GET', '/me', null, short.token)).body.comeback, null, '2 dias ainda não conta');
  const back = await withCheckins('Hoje', [8, 0]);
  assert.equal((await call('GET', '/me', null, back.token)).body.comeback, null, 'já registrou hoje');
});
