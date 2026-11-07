import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';
process.env.BLOB_STORE_ID = '';
process.env.BLOB_READ_WRITE_TOKEN = '';

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { Checkin, Post } = await import('../src/models/index.js');
const { UPLOAD_DIR } = await import('../src/services/storage.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const call = (method, p, body, token) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const signup = async (n) => (await call('POST', '/auth/signup', { name: n, email: `${n}${Date.now()}@t.dev`, password: 'senha1234' })).body;

test('editar, arquivar, restaurar e excluir um objetivo', async () => {
  const { token } = await signup('Gabi');
  const g = (await call('POST', '/goals', { title: 'Ler', category: 'leitura', kind: 'daily', target: { amount: 10, unit: 'min' } }, token)).body;

  const ed = await call('PATCH', `/goals/${g.id}`, { title: 'Ler 30 min', category: 'estudo', target: { amount: 30 }, activeDays: [1, 2, 3, 4, 5], color: '#3B82C4' }, token);
  assert.equal(ed.status, 200);
  assert.equal(ed.body.title, 'Ler 30 min');
  assert.equal(ed.body.category, 'estudo');
  assert.equal(ed.body.target.amount, 30);
  assert.deepEqual(ed.body.activeDays, [1, 2, 3, 4, 5]);
  assert.equal(ed.body.kind, 'daily', 'tipo não muda');

  await call('DELETE', `/goals/${g.id}`, null, token);
  assert.ok(!(await call('GET', '/goals', null, token)).body.some((x) => x.id === g.id), 'arquivado some de Metas');
  assert.ok((await call('GET', '/goals/archived', null, token)).body.some((x) => x.id === g.id), 'aparece em Arquivados');
  await call('POST', `/goals/${g.id}/restore`, null, token);
  assert.ok((await call('GET', '/goals', null, token)).body.some((x) => x.id === g.id), 'restaurado volta');

  const ck = (await call('POST', `/goals/${g.id}/checkins`, { minutes: 30 }, token)).body;
  const photo = (await call('POST', '/uploads', { purpose: 'post', data: PNG }, token)).body.url;
  await call('POST', '/posts', { checkinId: ck.checkin.id, audience: 'friends', photo: { url: photo, w: 1, h: 1 } }, token);
  const del = await call('DELETE', `/goals/${g.id}?modo=excluir`, null, token);
  assert.equal(del.body.deleted, true);
  assert.equal(await Checkin.countDocuments({ goalId: g.id }), 0, 'registros apagados');
  assert.equal(await Post.countDocuments({ goalId: g.id }), 0, 'posts apagados');
  assert.equal(fs.existsSync(path.join(UPLOAD_DIR, photo.slice('/api/uploads/'.length))), false, 'foto do post apagada');
  assert.equal((await call('GET', `/goals/${g.id}`, null, token)).status, 404);
});

test('ninguém de fora edita nem exclui', async () => {
  const a = await signup('Hugo');
  const b = await signup('Iris');
  const g = (await call('POST', '/goals', { title: 'Correr', category: 'treino', kind: 'daily' }, a.token)).body;
  assert.equal((await call('PATCH', `/goals/${g.id}`, { title: 'invadido' }, b.token)).status, 404);
  assert.equal((await call('DELETE', `/goals/${g.id}?modo=excluir`, null, b.token)).status, 404);
  assert.equal((await call('GET', `/goals/${g.id}`, null, a.token)).body.title, 'Correr');
});
