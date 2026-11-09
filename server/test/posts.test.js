import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { Post } = await import('../src/models/index.js');

let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const call = (method, p, body, token) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
export const signup = async (n) => (await call('POST', '/auth/signup', { name: n, email: `${n.toLowerCase()}${Date.now()}${Math.random().toString(36).slice(2, 6)}@t.dev`, password: 'senha1234' })).body;
const goal = async (token, category = 'leitura') => (await call('POST', '/goals', { title: 'Ler', category, kind: 'daily', target: { amount: 1, unit: '' } }, token)).body;

test('editar post: só o dono; trocar para Público entra no clube, para Amigos sai', async () => {
  const [ana, beto] = await Promise.all([signup('Ana'), signup('Beto')]);
  const club = (await call('POST', '/clubs', { kind: 'open', name: `Leitores ${Date.now()}`, category: 'leitura', city: '' }, ana.token)).body;
  const g = await goal(ana.token);
  const p = (await call('POST', '/posts', { goalId: g.id, audience: 'friends', text: 'oi' }, ana.token)).body.post;
  assert.equal((await call('PATCH', `/posts/${p.id}`, { text: 'hack' }, beto.token)).status, 404, 'outra pessoa não edita');
  const e = (await call('PATCH', `/posts/${p.id}`, { text: 'Li 30 páginas', audience: 'public' }, ana.token)).body;
  assert.equal(e.text, 'Li 30 páginas');
  assert.equal(e.edited, true);
  assert.equal((await Post.findById(p.id)).clubIds.map(String)[0], club.id, 'Público entra no clube da categoria');
  await call('PATCH', `/posts/${p.id}`, { audience: 'friends' }, ana.token);
  assert.equal((await Post.findById(p.id)).clubIds.length, 0, 'Amigos nunca vaza para clube');
  assert.equal((await call('PATCH', `/posts/${p.id}`, { audience: 'todos' }, ana.token)).status, 400);
});
