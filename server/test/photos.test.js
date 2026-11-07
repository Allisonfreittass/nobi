import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Nunca usar o banco nem o Blob do .env
process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';
process.env.BLOB_STORE_ID = '';
process.env.BLOB_READ_WRITE_TOKEN = '';

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { UPLOAD_DIR } = await import('../src/services/storage.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
let server;
let base;
before(async () => {
  await connectDb({ ephemeral: true });
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server.close(); await disconnectDb(); });

const call = (method, p, body, token) => fetch(base + p, {
  method,
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const fileOf = (url) => path.join(UPLOAD_DIR, url.slice('/api/uploads/'.length));

test('fotos são apagadas ao trocar o perfil, apagar o post e excluir a conta', async () => {
  const { body: { token, me } } = await call('POST', '/auth/signup', { name: 'Foto', email: `foto${Date.now()}@t.dev`, password: 'senha1234' });

  const a1 = (await call('POST', '/uploads', { purpose: 'avatar', data: PNG }, token)).body.url;
  await call('PATCH', '/me', { avatarUrl: a1 }, token);
  const a2 = (await call('POST', '/uploads', { purpose: 'avatar', data: PNG }, token)).body.url;
  await call('PATCH', '/me', { avatarUrl: a2 }, token);
  assert.equal(fs.existsSync(fileOf(a1)), false, 'foto de perfil antiga apagada');
  assert.equal(fs.existsSync(fileOf(a2)), true);

  const goal = (await call('POST', '/goals', { title: 'Ler', category: 'leitura', kind: 'daily' }, token)).body;
  const p1 = (await call('POST', '/uploads', { purpose: 'post', data: PNG }, token)).body.url;
  const post = (await call('POST', '/posts', { goalId: goal.id, audience: 'friends', photo: { url: p1, w: 1, h: 1 } }, token)).body.post;
  assert.equal(fs.existsSync(fileOf(p1)), true);
  await call('DELETE', `/posts/${post.id}`, null, token);
  assert.equal(fs.existsSync(fileOf(p1)), false, 'foto do post apagada com o post');

  await call('POST', '/uploads', { purpose: 'post', data: PNG }, token); // envio nunca usado
  const del = await call('DELETE', '/me', { password: 'senha1234' }, token);
  assert.equal(del.status, 200);
  assert.equal(fs.existsSync(path.join(UPLOAD_DIR, 'avatars', me.id)), false, 'pasta de perfil apagada');
  assert.equal(fs.existsSync(path.join(UPLOAD_DIR, 'posts', me.id)), false, 'pasta de posts apagada, inclusive envios não usados');
});
