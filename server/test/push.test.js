import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Ambiente isolado: banco temporário e um "serviço de push" falso em https local
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nobi-push-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(tmp, 'k.pem'), '-out', path.join(tmp, 'c.pem'), '-days', '1', '-subj', '/CN=127.0.0.1'], { stdio: 'ignore' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';
process.env.CRON_SECRET = 'segredo-do-cron';
const webpush = await import('web-push');
const vapid = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
process.env.VAPID_PRIVATE_KEY = vapid.privateKey;

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { User, PushSubscription } = await import('../src/models/index.js');

const received = [];
const fake = https.createServer({ key: fs.readFileSync(path.join(tmp, 'k.pem')), cert: fs.readFileSync(path.join(tmp, 'c.pem')) }, (req, res) => {
  received.push(req.url);
  req.resume();
  res.statusCode = req.url.includes('gone') ? 410 : 201;
  res.end();
});

let server; let api; let pushBase;
before(async () => {
  await connectDb({ ephemeral: true });
  server = createApp().listen(0);
  api = `http://127.0.0.1:${server.address().port}/api`;
  await new Promise((r) => fake.listen(0, r));
  pushBase = `https://127.0.0.1:${fake.address().port}`;
});
after(async () => { server.close(); fake.close(); await disconnectDb(); });

const call = (method, p, body, token, extra = {}) => fetch(api + p, {
  method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined,
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

// Fuso em que agora é meio-dia: fora do horário de silêncio e depois do lembrete
const noonZone = () => { const off = 12 - new Date().getUTCHours(); return off >= 0 ? `Etc/GMT-${off}` : `Etc/GMT+${-off}`; };
const subFor = async (userId, name) => {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  await PushSubscription.create({ userId, endpoint: `${pushBase}/${name}`, keys: { p256dh: ecdh.getPublicKey('base64url'), auth: crypto.randomBytes(16).toString('base64url') } });
};
const signup = async (name) => (await call('POST', '/auth/signup', { name, email: `${name}${Date.now()}@t.dev`, password: 'senha1234' })).body;

test('lembrete sai uma vez por dia, só com o segredo, e só se faltar algo', async () => {
  const a = await signup('Ana');
  await User.updateOne({ _id: a.me.id }, { timeZone: noonZone(), 'prefs.reminderTime': '06:00' });
  await call('POST', '/goals', { title: 'Ler 20 min', category: 'leitura', kind: 'daily' }, a.token);
  await subFor(a.me.id, 'ana');

  assert.equal((await call('GET', '/cron/reminders')).status, 401, 'sem segredo é recusado');
  const first = await call('GET', '/cron/reminders', null, null, { Authorization: 'Bearer segredo-do-cron' });
  assert.equal(first.status, 200);
  assert.equal(first.body.sent, 1);
  assert.ok(received.includes('/ana'));
  const again = await call('GET', '/cron/reminders', null, null, { Authorization: 'Bearer segredo-do-cron' });
  assert.equal(again.body.sent, 0, 'não repete no mesmo dia');
});

test('quem já fez tudo não recebe lembrete', async () => {
  const b = await signup('Bia');
  await User.updateOne({ _id: b.me.id }, { timeZone: noonZone(), 'prefs.reminderTime': '06:00' });
  const g = (await call('POST', '/goals', { title: 'Meditar', category: 'habito', kind: 'daily' }, b.token)).body;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: noonZone() }).format(new Date());
  await call('POST', `/goals/${g.id}/checkins`, {}, b.token, { 'X-Local-Date': today });
  await subFor(b.me.id, 'bia');
  const before = received.filter((u) => u === '/bia').length;
  await call('GET', '/cron/reminders', null, null, { Authorization: 'Bearer segredo-do-cron' });
  assert.equal(received.filter((u) => u === '/bia').length, before);
});

test('reação gera aviso e aparelho desinstalado é esquecido', async () => {
  const c = await signup('Caio');
  const d = await signup('Duda');
  await User.updateOne({ _id: c.me.id }, { timeZone: noonZone() });
  await call('POST', `/users/${d.me.username}/invite`, {}, c.token); // vira amigo
  const g = (await call('POST', '/goals', { title: 'Correr', category: 'treino', kind: 'daily' }, c.token)).body;
  const post = (await call('POST', '/posts', { goalId: g.id, audience: 'friends' }, c.token)).body.post;
  await subFor(c.me.id, 'caio');
  await subFor(c.me.id, 'caio-gone');
  await call('POST', `/posts/${post.id}/react`, {}, d.token);
  assert.ok(received.includes('/caio'), 'dono do post recebe o Boa!');
  assert.equal(await PushSubscription.countDocuments({ userId: c.me.id }), 1, 'inscrição com 410 removida');
});

test('desligar o tipo em Configurações bloqueia o aviso', async () => {
  const e = await signup('Edu');
  const f = await signup('Fê');
  await User.updateOne({ _id: e.me.id }, { timeZone: noonZone(), 'prefs.notify.social': false });
  await call('POST', `/users/${f.me.username}/invite`, {}, e.token);
  const g = (await call('POST', '/goals', { title: 'Ler', category: 'leitura', kind: 'daily' }, e.token)).body;
  const post = (await call('POST', '/posts', { goalId: g.id, audience: 'friends' }, e.token)).body.post;
  await subFor(e.me.id, 'edu');
  await call('POST', `/posts/${post.id}/react`, {}, f.token);
  assert.ok(!received.includes('/edu'));
});
