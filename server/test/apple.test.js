import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';
process.env.APPLE_CLIENT_ID = 'com.nobi.web';

// Chave falsa no lugar da Apple: o servidor busca as chaves públicas em appleid.apple.com
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => (String(url) === 'https://appleid.apple.com/auth/keys'
  ? new Response(JSON.stringify({ keys: [jwk] }), { status: 200 })
  : realFetch(url, opts));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const token = (claims, key = privateKey) => {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const body = `${enc({ alg: 'RS256', kid: 'k1' })}.${enc({ iss: 'https://appleid.apple.com', aud: 'com.nobi.web', exp: Math.floor(Date.now() / 1000) + 600, ...claims })}`;
  return `${body}.${crypto.sign('RSA-SHA256', Buffer.from(body), key).toString('base64url')}`;
};

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');

let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const call = (method, p, body) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

test('login com Apple: cria conta, entra de novo, liga por e-mail confirmado e recusa token falso', async () => {
  assert.equal((await call('GET', '/auth/providers')).body.apple, true);
  const nonce = 'abc123';
  const first = await call('POST', '/auth/apple', { idToken: token({ sub: 'apple-1', email: 'lia@privaterelay.appleid.com', email_verified: 'true', nonce: sha(nonce) }), nonce, user: { name: { firstName: 'Lia', lastName: 'Souza' } } });
  assert.equal(first.status, 200);
  assert.equal(first.body.created, true);
  assert.equal(first.body.me.name, 'Lia Souza');
  const again = await call('POST', '/auth/apple', { idToken: token({ sub: 'apple-1', nonce: sha(nonce) }), nonce });
  assert.equal(again.body.created, false, 'na segunda vez a Apple nem manda e-mail: acha pelo sub');
  assert.equal(again.body.me.id, first.body.me.id);

  assert.equal((await call('POST', '/auth/apple', { idToken: token({ sub: 'apple-1', nonce: sha('outro') }), nonce })).status, 401, 'nonce errado');
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  assert.equal((await call('POST', '/auth/apple', { idToken: token({ sub: 'apple-9' }, other) })).status, 401, 'assinatura falsa');
  assert.equal((await call('POST', '/auth/apple', { idToken: token({ sub: 'apple-9', aud: 'outro.app' }) })).status, 401, 'outro app');

  // Conta por e-mail e senha: Apple com o mesmo e-mail confirmado liga as duas
  const email = `bia${Date.now()}@t.dev`;
  const signup = (await call('POST', '/auth/signup', { name: 'Bia', email, password: 'senha1234' })).body;
  const linked = await call('POST', '/auth/apple', { idToken: token({ sub: 'apple-2', email, email_verified: true }) });
  assert.equal(linked.body.me.id, signup.me.id);
  assert.equal(linked.body.created, false);

  // Conta só da Apple tentando e-mail e senha recebe a explicação
  const r = await call('POST', '/auth/login', { email: 'lia@privaterelay.appleid.com', password: 'qualquer1' });
  assert.equal(r.status, 401);
  assert.equal(r.body.appleOnly, true);
});
