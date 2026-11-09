import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { mentionedUsernames } = await import('../src/routes/posts.js');

let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const call = (method, p, body, token) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const signup = async (n) => (await call('POST', '/auth/signup', { name: n, email: `${n.toLowerCase()}${Date.now()}@t.dev`, password: 'senha1234' })).body;
const post = async (token, audience) => {
  const g = (await call('POST', '/goals', { title: 'Ler', category: 'leitura', kind: 'daily', target: { amount: 20, unit: 'min' } }, token)).body;
  return (await call('POST', '/posts', { goalId: g.id, audience, text: audience }, token)).body.post;
};
const mentionsOf = async (token) => (await call('GET', '/home/notifications', null, token)).body.items.filter((i) => i.type === 'mention');

test('lê @usuario no texto, sem pegar e-mail e sem ponto final', () => {
  assert.deepEqual(mentionedUsernames('@ana bora? fala com @Beto.silva. e-mail ana@x.com @ana'), ['ana', 'beto.silva']);
});

test('menção em comentário: só quem vê o post é marcado e avisado', async () => {
  const [ana, beto, caio, duda] = await Promise.all([signup('Ana'), signup('Beto'), signup('Caio'), signup('Duda')]);
  await call('POST', `/users/${ana.me.username}/invite`, {}, beto.token); // Ana e Beto amigos
  await call('POST', `/users/${ana.me.username}/invite`, {}, caio.token); // Ana e Caio amigos
  const p = await post(ana.token, 'friends');

  // Beto cita Caio (vê o post), Duda (não vê) e a própria Ana (dona, já recebe "comentou")
  const c = (await call('POST', `/posts/${p.id}/comments`, { text: `@${caio.me.username} olha isso @${duda.me.username} @${ana.me.username}` }, beto.token)).body;
  assert.deepEqual(c.mentions.sort(), [ana.me.username, caio.me.username].sort());
  assert.equal((await mentionsOf(caio.token)).length, 1);
  assert.equal((await mentionsOf(caio.token))[0].user.name, 'Beto');
  assert.equal((await mentionsOf(duda.token)).length, 0, 'quem não vê o post não é avisado');
  assert.equal((await mentionsOf(ana.token)).length, 0, 'dona do post não recebe aviso dobrado');

  const list = (await call('GET', `/posts/${p.id}/comments`, null, ana.token)).body;
  assert.deepEqual(list[0].mentions.sort(), [ana.me.username, caio.me.username].sort());

  // Sugestões do @: só quem vê o post
  const sug = (await call('GET', `/posts/${p.id}/mentionable?q=`, null, beto.token)).body.map((u) => u.name);
  assert.ok(sug.includes('Ana'));
  assert.ok(!sug.includes('Duda'));
  assert.deepEqual((await call('GET', `/posts/${p.id}/mentionable?q=cai`, null, ana.token)).body.map((u) => u.name), ['Caio']);
});
