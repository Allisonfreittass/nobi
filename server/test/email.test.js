import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';
process.env.RESEND_API_KEY = 're_teste';

// Intercepta só a API do Resend; o resto (chamadas ao app) segue normal
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith('https://api.resend.com')) { sent.push(JSON.parse(opts.body)); return new Response('{"id":"x"}', { status: 200 }); }
  return realFetch(url, opts);
};

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');

let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const call = (method, p, body) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

test('esqueci a senha manda e-mail com link que funciona uma vez', async () => {
  const email = `ana${Date.now()}@t.dev`;
  await call('POST', '/auth/signup', { name: 'Ana Souza', email, password: 'senha1234' });

  assert.equal((await call('POST', '/auth/forgot', { email: 'ninguem@t.dev' })).body.ok, true, 'mesma resposta sem conta');
  assert.equal(sent.length, 0);
  assert.equal((await call('POST', '/auth/forgot', { email: email.toUpperCase() })).body.ok, true);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, [email]);
  assert.match(sent[0].subject, /Redefinir sua senha/);
  assert.match(sent[0].text, /Oi, Ana!/);
  await call('POST', '/auth/forgot', { email });
  assert.equal(sent.length, 1, 'não manda outro em menos de 1 minuto');

  const token = /token=([a-f0-9]+)/.exec(sent[0].text)[1];
  assert.equal((await call('POST', '/auth/reset', { token, password: 'novasenha1' })).status, 200);
  assert.equal((await call('POST', '/auth/reset', { token, password: 'outrasenha1' })).status, 400, 'link vale uma vez');
  assert.equal((await call('POST', '/auth/login', { email, password: 'novasenha1' })).status, 200);
});
