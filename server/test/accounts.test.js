import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

// Nunca usar o banco do .env: força o MongoDB temporário antes de carregar a configuração
process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { User } = await import('../src/models/index.js');
const { signToken } = await import('../src/lib/http.js');
const { linkGoogle } = await import('../src/services/accounts.js');

let server;
let base;
before(async () => {
  await connectDb({ ephemeral: true });
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  server.close();
  await disconnectDb();
});

const me = (token) => fetch(`${base}/me`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.status);

test('linkar Google em conta com e-mail não confirmado apaga a senha e derruba sessões', async () => {
  const signup = await fetch(`${base}/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Invasor', email: 'vitima@exemplo.com', password: 'senha-do-invasor' }),
  }).then((r) => r.json());
  assert.equal(await me(signup.token), 200);

  await new Promise((r) => setTimeout(r, 1100)); // o token antigo fica num segundo anterior
  const user = await User.findOne({ email: 'vitima@exemplo.com' });
  assert.equal(linkGoogle(user, 'google-123'), true);
  await user.save();

  assert.equal(await me(signup.token), 401, 'sessão antiga deve cair');
  assert.equal(await me(signToken(user)), 200, 'login novo pelo Google funciona');
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'vitima@exemplo.com', password: 'senha-do-invasor' }),
  });
  assert.equal(login.status, 401, 'senha antiga não entra mais');
});

test('conta com e-mail já confirmado mantém a senha ao linkar', async () => {
  const user = await User.create({ name: 'Dona', username: 'dona', email: 'dona@exemplo.com', passwordHash: 'x', emailVerified: true });
  assert.equal(linkGoogle(user, 'google-456'), false);
  assert.equal(user.passwordHash, 'x');
  assert.equal(user.googleId, 'google-456');
});
