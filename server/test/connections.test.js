import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');

let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const call = (method, p, body, token) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const signup = async (n) => (await call('POST', '/auth/signup', { name: n, email: `${n}${Date.now()}@t.dev`, password: 'senha1234' })).body;

test('seguidores e seguindo respeitam a privacidade e dá para remover seguidor', async () => {
  const ana = await signup('Ana');
  const beto = await signup('Beto');
  const caio = await signup('Caio');
  await call('POST', `/users/${ana.me.username}/invite`, {}, beto.token); // Ana e Beto amigos
  await call('POST', `/users/${ana.me.id}/follow`, {}, caio.token); // Caio só segue Ana

  const mine = await call('GET', `/users/${ana.me.username}/followers`, null, ana.token);
  assert.deepEqual(mine.body.people.map((p) => p.name).sort(), ['Beto', 'Caio']);
  const following = await call('GET', `/users/${ana.me.username}/following`, null, ana.token);
  assert.deepEqual(following.body.people.map((p) => p.name), ['Beto']);

  assert.equal((await call('GET', `/users/${ana.me.username}/followers`, null, beto.token)).body.hidden, false, 'amigo vê');
  assert.equal((await call('GET', `/users/${ana.me.username}/followers`, null, caio.token)).body.hidden, true, 'quem não é amigo não vê perfil só para amigos');

  await call('PATCH', '/me', { privacy: { profile: 'public' } }, ana.token);
  assert.equal((await call('GET', `/users/${ana.me.username}/followers`, null, caio.token)).body.hidden, false, 'perfil público: todos veem');

  await call('DELETE', `/users/me/followers/${caio.me.id}`, null, ana.token);
  const after = await call('GET', `/users/${ana.me.username}/followers`, null, ana.token);
  assert.deepEqual(after.body.people.map((p) => p.name), ['Beto'], 'Caio removido');
});
