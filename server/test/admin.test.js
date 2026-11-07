import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';
process.env.STAFF_EMAILS = 'chefe@t.dev';

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { User } = await import('../src/models/index.js');

let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const call = (method, p, body, token) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const signup = async (n, email = `${n}${Date.now()}@t.dev`) => (await call('POST', '/auth/signup', { name: n, email, password: 'senha1234' })).body;

test('Equipe Nobi: só staff entra; e-mail da lista precisa estar verificado', async () => {
  const chefe = await signup('Chefe', 'chefe@t.dev');
  const comum = await signup('Comum');
  assert.equal((await call('GET', '/admin/reports', null, comum.token)).status, 403);
  assert.equal((await call('GET', '/admin/reports', null, chefe.token)).status, 403, 'e-mail na lista mas não verificado');
  await User.updateOne({ _id: chefe.me.id }, { emailVerified: true });
  assert.equal((await call('GET', '/admin/reports', null, chefe.token)).status, 200);
  assert.equal((await call('GET', '/me', null, chefe.token)).body.staff, true);
});

test('denúncias agrupadas por alvo; apagar post e suspender conta', async () => {
  const staff = await signup('Staff');
  await User.updateOne({ _id: staff.me.id }, { staff: true });
  const [ana, beto, caio] = await Promise.all([signup('Ana'), signup('Beto'), signup('Caio')]);
  const g = (await call('POST', '/goals', { title: 'Ler', category: 'leitura', kind: 'daily' }, ana.token)).body;
  const post = (await call('POST', '/posts', { goalId: g.id, audience: 'public', text: 'compre meu curso' }, ana.token)).body.post;
  await call('POST', '/reports', { targetType: 'post', targetId: post.id, reason: 'spam' }, beto.token);
  await call('POST', '/reports', { targetType: 'post', targetId: post.id, reason: 'spam', details: 'link de venda' }, caio.token);
  await call('POST', '/reports', { targetType: 'user', targetId: ana.me.id, reason: 'falso' }, beto.token);

  const queue = (await call('GET', '/admin/reports', null, staff.token)).body;
  const pg = queue.find((x) => x.targetId === post.id);
  assert.equal(pg.count, 2, 'duas denúncias do mesmo post viram um item');
  assert.equal(pg.target.post.text, 'compre meu curso');

  await call('POST', '/admin/reports/resolve', { targetType: 'post', targetId: post.id, action: 'delete-post' }, staff.token);
  assert.equal((await call('GET', `/posts/${post.id}/comments`, null, beto.token)).status, 404, 'post apagado');

  await call('POST', '/admin/reports/resolve', { targetType: 'user', targetId: ana.me.id, action: 'suspend' }, staff.token);
  assert.ok([401, 403].includes((await call('GET', '/me', null, ana.token)).status), 'sessão da conta suspensa cai');
  const login = await call('POST', '/auth/login', { email: ana.me.email, password: 'senha1234' });
  assert.equal(login.status, 403);
  assert.equal(login.body.suspended, true);
  assert.equal((await call('GET', `/users/${ana.me.username}`, null, beto.token)).status, 404, 'some do perfil público');
  assert.equal((await call('GET', '/admin/reports', null, staff.token)).body.length, 0, 'fila vazia');

  await call('POST', `/admin/users/${ana.me.id}/unsuspend`, null, staff.token);
  assert.equal((await call('POST', '/auth/login', { email: ana.me.email, password: 'senha1234' })).status, 200, 'reativada entra de novo');
});
