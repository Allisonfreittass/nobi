import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { Club, Membership, Report } = await import('../src/models/index.js');

let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const call = (method, p, body, token) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const signup = async (n) => (await call('POST', '/auth/signup', { name: n, email: `${n}${Date.now()}@t.dev`, password: 'senha1234' })).body;
const readingGoal = async (token) => (await call('POST', '/goals', { title: 'Ler', category: 'leitura', kind: 'daily', target: { amount: 20, unit: 'min' } }, token)).body;
const post = async (token, audience) => {
  const g = await readingGoal(token);
  return (await call('POST', '/posts', { goalId: g.id, audience, text: audience }, token)).body.post;
};

test('só posts Públicos da categoria entram no clube; moderação remove, bane e vê denúncias', async () => {
  const [ana, beto, mod] = await Promise.all([signup('Ana'), signup('Beto'), signup('Mod')]);
  const club = await Club.create({ name: 'Leitores', slug: `leitores-${Date.now()}`, category: 'leitura', kind: 'official', city: 'Lavras, MG', region: 'Sul de Minas' });
  await Membership.create({ clubId: club._id, userId: mod.me.id, role: 'moderator' });

  assert.equal((await call('POST', `/clubs/${club.slug}/join`, null, ana.token)).body.member, true);
  await call('POST', `/clubs/${club.slug}/join`, null, beto.token);

  await post(ana.token, 'public');
  await post(ana.token, 'friends');
  const feed = (await call('GET', `/clubs/${club.slug}/feed`, null, beto.token)).body.posts;
  assert.deepEqual(feed.map((p) => p.text), ['public'], 'post de Amigos nunca vaza para o clube');

  const ranking = (await call('GET', `/clubs/${club.slug}/ranking`, null, beto.token)).body;
  assert.equal(ranking[0].user.name, 'Ana');

  // Denúncia chega à moderação do clube; membro comum não vê
  const target = feed[0];
  assert.equal((await call('POST', '/reports', { targetType: 'post', targetId: target.id, reason: 'spam', clubSlug: club.slug }, beto.token)).status, 201);
  assert.equal((await call('POST', '/reports', { targetType: 'post', targetId: target.id, reason: 'spam', clubSlug: club.slug }, beto.token)).status, 201, 'denunciar de novo não dá erro');
  assert.equal(await Report.countDocuments({ targetId: target.id }), 1);
  assert.equal((await call('GET', `/clubs/${club.slug}/reports`, null, beto.token)).status, 403);
  assert.equal((await call('GET', `/clubs/${club.slug}/reports`, null, mod.token)).body.length, 1);

  assert.equal((await call('POST', `/clubs/${club.slug}/posts/${target.id}/remove`, null, beto.token)).status, 403);
  await call('POST', `/clubs/${club.slug}/posts/${target.id}/remove`, null, mod.token);
  assert.equal((await call('GET', `/clubs/${club.slug}/feed`, null, beto.token)).body.posts.length, 0, 'removido do clube');
  assert.equal((await call('GET', `/clubs/${club.slug}/reports`, null, mod.token)).body.length, 0, 'denúncia resolvida junto');

  await call('POST', `/clubs/${club.slug}/members/${ana.me.id}/ban`, null, mod.token);
  assert.equal((await call('POST', `/clubs/${club.slug}/join`, null, ana.token)).status, 403, 'banido não volta');
  await post(ana.token, 'public');
  assert.equal((await call('GET', `/clubs/${club.slug}/feed`, null, beto.token)).body.posts.length, 0, 'banido não posta no clube');

  // Perto de você pela cidade do perfil
  await call('PATCH', '/me', { city: 'Lavras, MG' }, beto.token);
  const home = (await call('GET', '/community', null, beto.token)).body;
  assert.equal(home.nearby.label, 'Sul de Minas');
  assert.ok(home.nearby.clubs.some((c) => c.slug === club.slug));
});

test('desafios abertos: comunidade para todos, de clube só para membros; grupo privado é invisível', async () => {
  const [ana, beto, caio] = await Promise.all([signup('Ana'), signup('Beto'), signup('Caio')]);
  const club = await Club.create({ name: 'Corrida', slug: `corrida-${Date.now()}`, category: 'treino', kind: 'official' });
  const today = new Date().toISOString().slice(0, 10);
  const mk = async (shared) => (await import('../src/models/index.js')).Goal.create({ ownerId: ana.me.id, title: 'Desafio', category: 'treino', kind: 'daily', color: '#FF5B2E', shared: { mode: 'together', participants: [ana.me.id], startsAt: today, endsAt: '2099-12-31', ...shared } });
  const pub = await mk({ public: true });
  const ofClub = await mk({ clubId: club._id });
  const closed = await mk({});

  assert.equal((await call('GET', `/goals/${pub._id}`, null, beto.token)).status, 200, 'dá para ver antes de entrar');
  assert.equal((await call('POST', `/goals/${pub._id}/participate`, null, beto.token)).body.shared.joined, true);
  assert.equal((await call('POST', `/goals/${ofClub._id}/participate`, null, beto.token)).status, 403, 'precisa ser do clube');
  await call('POST', `/clubs/${club.slug}/join`, null, beto.token);
  assert.equal((await call('POST', `/goals/${ofClub._id}/participate`, null, beto.token)).status, 200);
  assert.equal((await call('POST', `/goals/${closed._id}/participate`, null, beto.token)).status, 403, 'desafio de amigos é só com convite');
  assert.equal((await call('GET', `/goals/${closed._id}`, null, beto.token)).status, 404);

  // Grupo privado: só amigos entram, e quem é de fora nem vê
  await call('POST', `/users/${ana.me.username}/invite`, {}, beto.token);
  assert.equal((await call('POST', '/clubs', { name: 'Só nós', category: 'treino', invite: [caio.me.id] }, ana.token)).status, 400, 'Caio não é amigo');
  const group = (await call('POST', '/clubs', { name: 'Só nós', category: 'treino', invite: [beto.me.id] }, ana.token)).body;
  assert.equal(group.role, 'admin');
  assert.equal((await call('GET', `/clubs/${group.slug}`, null, beto.token)).body.member, true);
  assert.equal((await call('GET', `/clubs/${group.slug}`, null, caio.token)).status, 404);
  assert.equal((await call('POST', `/clubs/${group.slug}/join`, null, caio.token)).status, 404);
});

test('qualquer pessoa cria clube aberto e vira admin; limites e saída', async () => {
  const [ana, beto] = await Promise.all([signup('Ana'), signup('Beto')]);
  const name = `Corredores ${Date.now()}`;
  const r = await call('POST', '/clubs', { kind: 'open', name, category: 'treino', interest: 'Corrida', city: 'Lavras, MG' }, ana.token);
  assert.equal(r.status, 201);
  assert.equal(r.body.role, 'admin');
  assert.equal(r.body.kind, 'open');
  assert.equal((await call('POST', '/clubs', { kind: 'open', name: name.toUpperCase(), category: 'treino' }, beto.token)).status, 400, 'nome repetido');

  // Beto encontra na busca, entra e posta; Ana modera
  const found = (await call('GET', `/community/search?q=${encodeURIComponent(name.slice(0, 10))}`, null, beto.token)).body.clubs;
  assert.ok(found.some((c) => c.slug === r.body.slug));
  assert.equal((await call('POST', `/clubs/${r.body.slug}/join`, null, beto.token)).body.member, true);
  assert.equal((await call('GET', `/clubs/${r.body.slug}`, null, ana.token)).body.canModerate, true);

  for (let i = 0; i < 2; i += 1) await call('POST', '/clubs', { kind: 'open', name: `${name} ${i}`, category: 'treino' }, ana.token);
  assert.equal((await call('POST', '/clubs', { kind: 'open', name: `${name} extra`, category: 'treino' }, ana.token)).status, 400, 'até 3 por pessoa');

  // Admin sai: Beto vira admin. Beto sai: clube sem ninguém é encerrado.
  await call('DELETE', `/clubs/${r.body.slug}/membership`, null, ana.token);
  assert.equal((await call('GET', `/clubs/${r.body.slug}`, null, beto.token)).body.role, 'admin');
  assert.equal((await call('DELETE', `/clubs/${r.body.slug}/membership`, null, beto.token)).body.deleted, true);
  assert.equal((await call('GET', `/clubs/${r.body.slug}`, null, beto.token)).status, 404);
});

test('grupo privado: quem está dentro convida amigos depois de criado', async () => {
  const [ana, beto, caio, duda] = await Promise.all([signup('Ana'), signup('Beto'), signup('Caio'), signup('Duda')]);
  await call('POST', `/users/${ana.me.username}/invite`, {}, beto.token); // Ana e Beto amigos
  await call('POST', `/users/${ana.me.username}/invite`, {}, caio.token); // Ana e Caio amigos
  const g = (await call('POST', '/clubs', { kind: 'private', name: 'Grupo da Ana', category: 'leitura', invite: [beto.me.id] }, ana.token)).body;
  assert.equal((await call('GET', `/clubs/${g.slug}`, null, caio.token)).status, 404, 'fora do grupo não vê');

  assert.equal((await call('POST', `/clubs/${g.slug}/invite`, { invite: [caio.me.id] }, duda.token)).status, 404, 'quem está fora não convida');
  assert.equal((await call('POST', `/clubs/${g.slug}/invite`, { invite: [duda.me.id] }, ana.token)).status, 400, 'só amigos');
  const r = await call('POST', `/clubs/${g.slug}/invite`, { invite: [caio.me.id, beto.me.id] }, ana.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.added, 1, 'Beto já estava');
  assert.equal((await call('GET', `/clubs/${g.slug}`, null, caio.token)).body.member, true);
  assert.equal((await call('GET', `/clubs/${g.slug}`, null, ana.token)).body.membersCount, 3);
});
