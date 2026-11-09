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
  const group = (await call('POST', '/clubs', { name: 'Só nós', category: 'treino', invite: [beto.me.id, caio.me.id] }, ana.token)).body;
  assert.equal(group.role, 'admin');
  assert.equal((await call('POST', `/clubs/${group.slug}/invite/accept`, null, caio.token)).status, 404, 'Caio não é amigo: nem recebe convite');
  await call('POST', `/clubs/${group.slug}/invite/accept`, null, beto.token);
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

test('grupo privado: amigo recebe convite e decide; link entra só quem toca em Entrar', async () => {
  const [ana, beto, caio, duda, edu] = await Promise.all([signup('Ana'), signup('Beto'), signup('Caio'), signup('Duda'), signup('Edu')]);
  await call('POST', `/users/${ana.me.username}/invite`, {}, beto.token); // Ana e Beto amigos
  await call('POST', `/users/${ana.me.username}/invite`, {}, caio.token); // Ana e Caio amigos
  const g = (await call('POST', '/clubs', { kind: 'private', name: 'Grupo da Ana', category: 'leitura', invite: [beto.me.id] }, ana.token)).body;
  assert.equal(g.membersCount, 1, 'na criação, amigo só é convidado');
  assert.equal((await call('GET', `/clubs/${g.slug}`, null, beto.token)).status, 404, 'convidado ainda não vê o grupo');
  const note = (await call('GET', '/home/notifications', null, beto.token)).body.items.find((i) => i.type === 'group-invite');
  assert.equal(note.club.slug, g.slug);
  assert.equal(note.user.name, 'Ana');
  assert.equal((await call('POST', `/clubs/${g.slug}/invite/accept`, null, beto.token)).body.member, true);
  assert.equal((await call('GET', '/home/notifications', null, beto.token)).body.items.filter((i) => i.type === 'group-invite').length, 0);

  // Depois de criado: só quem está dentro convida, só amigos, sem repetir
  assert.equal((await call('POST', `/clubs/${g.slug}/invite`, { invite: [caio.me.id] }, duda.token)).status, 404, 'quem está fora não convida');
  assert.equal((await call('POST', `/clubs/${g.slug}/invite`, { invite: [duda.me.id] }, ana.token)).status, 400, 'só amigos');
  assert.equal((await call('POST', `/clubs/${g.slug}/invite`, { invite: [caio.me.id, beto.me.id] }, ana.token)).body.invited, 1, 'Beto já está');
  assert.equal((await call('POST', `/clubs/${g.slug}/invite`, { invite: [caio.me.id] }, ana.token)).body.invited, 0, 'convite não duplica');
  const invitable = (await call('GET', `/clubs/${g.slug}/invitable`, null, ana.token)).body;
  assert.deepEqual(Object.fromEntries(invitable.map((u) => [u.name, u.state])), { Beto: 'active', Caio: 'invited' });
  assert.equal((await call('POST', `/clubs/${g.slug}/invite/decline`, null, caio.token)).body.ok, true);
  assert.equal((await call('GET', `/clubs/${g.slug}`, null, caio.token)).status, 404, 'recusou, fica fora');
  assert.equal((await call('POST', `/clubs/${g.slug}/invite/accept`, null, caio.token)).status, 404, 'convite recusado não volta');

  // Link: prévia pública, entrar por escolha, admin redefine e o antigo morre
  const { code } = (await call('GET', `/clubs/${g.slug}/link`, null, beto.token)).body;
  assert.equal((await call('GET', `/clubs/${g.slug}/link`, null, ana.token)).body.code, code, 'mesmo link para todos');
  assert.deepEqual((await call('GET', `/auth/group-invite/${code}`)).body, { name: 'Grupo da Ana', category: 'leitura', membersCount: 2 });
  const joined = (await call('POST', `/clubs/link/${code}/join`, null, duda.token)).body;
  assert.equal(joined.member, true);
  assert.equal(joined.slug, g.slug);
  assert.equal((await call('POST', `/clubs/${g.slug}/link/reset`, null, beto.token)).status, 403, 'membro comum não redefine');
  const fresh = (await call('POST', `/clubs/${g.slug}/link/reset`, null, ana.token)).body.code;
  assert.notEqual(fresh, code);
  assert.equal((await call('POST', `/clubs/link/${code}/join`, null, edu.token)).status, 404, 'link antigo não vale');
  await call('POST', `/clubs/${g.slug}/members/${duda.me.id}/ban`, null, ana.token);
  assert.equal((await call('POST', `/clubs/link/${fresh}/join`, null, duda.token)).status, 403, 'banido não volta pelo link');
  assert.equal((await call('POST', `/clubs/link/${fresh}/join`, null, edu.token)).body.member, true);
});

test('desafio com checklist pela interface; desafio de clube só a moderação cria', async () => {
  const [ana, beto, caio] = await Promise.all([signup('Ana'), signup('Beto'), signup('Caio')]);
  await call('POST', `/users/${ana.me.username}/invite`, {}, beto.token);
  const base = { title: 'Semana focada', category: 'objetivo', kind: 'daily', target: { amount: 1, unit: '' } };
  const tasks = [{ label: 'Ler 20 min', pts: 10 }, { label: '  Treinar  ', pts: 99 }, { label: 'x' }];
  assert.equal((await call('POST', '/goals', { ...base, shared: { mode: 'versus', invite: [beto.me.id], durationDays: 0, tasks } }, ana.token)).status, 400, 'checklist precisa de prazo');
  const g = (await call('POST', '/goals', { ...base, shared: { mode: 'versus', invite: [beto.me.id], durationDays: 7, tasks } }, ana.token)).body;
  assert.deepEqual(g.shared.tasks, [{ key: 't1', label: 'Ler 20 min', pts: 10 }, { key: 't2', label: 'Treinar', pts: 50 }], 'limpa nome, limita pontos, ignora tarefa curta');
  await call('POST', `/goals/${g.id}/checkins`, { taskKey: 't2' }, ana.token);
  const after = (await call('GET', `/goals/${g.id}`, null, ana.token)).body;
  assert.equal(after.shared.ranking.find((r) => r.me).points, 50);

  // Clube aberto: Ana cria e é admin; Caio é membro comum
  const club = (await call('POST', '/clubs', { kind: 'open', name: `Leitores ${Date.now()}`, category: 'leitura', city: '' }, ana.token)).body;
  await call('POST', `/clubs/${club.slug}/join`, null, caio.token);
  const clubCh = { title: 'Maratona de leitura', category: 'leitura', kind: 'daily', target: { amount: 1, unit: '' } };
  assert.equal((await call('POST', '/goals', { ...clubCh, shared: { mode: 'versus', clubSlug: club.slug, durationDays: 14 } }, caio.token)).status, 403);
  assert.equal((await call('POST', '/goals', { ...clubCh, shared: { mode: 'versus', clubSlug: club.slug, durationDays: 0 } }, ana.token)).status, 400, 'precisa de duração');
  const ch = (await call('POST', '/goals', { ...clubCh, shared: { mode: 'versus', clubSlug: club.slug, durationDays: 14 } }, ana.token)).body;
  const list = (await call('GET', `/clubs/${club.slug}/challenges`, null, caio.token)).body;
  assert.equal(list[0].id, ch.id);
  assert.equal((await call('POST', `/goals/${ch.id}/participate`, null, caio.token)).status, 200, 'membro entra sem convite');
});

test('eventos do clube: moderação cria, membros vão, cancela; véspera avisa', async () => {
  const [ana, beto, caio] = await Promise.all([signup('Ana'), signup('Beto'), signup('Caio')]);
  const { addDays } = await import('../src/lib/dates.js');
  const club = (await call('POST', '/clubs', { kind: 'open', name: `Corrida ${Date.now()}`, category: 'treino', city: 'Lavras, MG' }, ana.token)).body;
  await call('POST', `/clubs/${club.slug}/join`, null, beto.token);
  const today = new Date().toISOString().slice(0, 10);
  const ev = { title: 'Treino na praça', date: addDays(today, 2), time: '07:00', place: 'Praça central' };
  assert.equal((await call('POST', `/clubs/${club.slug}/events`, ev, beto.token)).status, 403, 'membro comum não cria em clube aberto');
  assert.equal((await call('POST', `/clubs/${club.slug}/events`, { ...ev, date: addDays(today, -1) }, ana.token)).status, 400, 'data passada');
  const e = (await call('POST', `/clubs/${club.slug}/events`, ev, ana.token)).body;
  assert.equal(e.goingCount, 1, 'quem cria já vai');
  assert.equal((await call('POST', `/clubs/${club.slug}/events/${e.id}/going`, {}, caio.token)).status, 403, 'precisa ser do clube');
  const g = (await call('POST', `/clubs/${club.slug}/events/${e.id}/going`, {}, beto.token)).body;
  assert.equal(g.goingCount, 2);
  assert.equal(g.going, true);
  assert.equal((await call('POST', `/clubs/${club.slug}/events/${e.id}/going`, { going: false }, beto.token)).body.goingCount, 1);
  const list = (await call('GET', `/clubs/${club.slug}/events`, null, beto.token)).body;
  assert.equal(list.canCreate, false);
  assert.equal(list.events[0].title, 'Treino na praça');
  await call('PATCH', '/me', { city: 'Lavras, MG' }, caio.token);
  assert.equal((await call('GET', '/community/events', null, caio.token)).body[0].club.slug, club.slug, 'aparece para quem é da cidade');
  assert.equal((await call('DELETE', `/clubs/${club.slug}/events/${e.id}`, null, beto.token)).status, 403);
  await call('DELETE', `/clubs/${club.slug}/events/${e.id}`, null, ana.token);
  assert.equal((await call('GET', `/clubs/${club.slug}/events`, null, beto.token)).body.events.length, 0, 'cancelado some');

  // Grupo privado: qualquer membro cria
  const grp = (await call('POST', '/clubs', { kind: 'private', name: 'Grupo da Ana', category: 'treino' }, ana.token)).body;
  assert.equal((await call('POST', `/clubs/${grp.slug}/events`, ev, ana.token)).status, 201);
});

test('lembrete de véspera do evento: só a partir das 18h do dia anterior, uma vez', async () => {
  const { runEventReminders } = await import('../src/services/reminders.js');
  const { ClubEvent, PushLog } = await import('../src/models/index.js');
  const ana = await signup('Ana');
  const club = await Club.create({ name: 'Ev', slug: `ev-${Date.now()}`, category: 'treino', kind: 'official' });
  const e = await ClubEvent.create({ clubId: club._id, title: 'Treino', date: '2031-05-11', time: '07:00', createdBy: ana.me.id, going: [ana.me.id] });
  const key = { userId: ana.me.id, key: `event:eve:${e._id}` };
  await runEventReminders(new Date('2031-05-10T19:00:00Z')); // 16h em São Paulo
  assert.equal(await PushLog.countDocuments(key), 0, 'antes das 18h não avisa');
  await runEventReminders(new Date('2031-05-10T22:00:00Z')); // 19h em São Paulo
  await runEventReminders(new Date('2031-05-10T23:00:00Z'));
  assert.equal(await PushLog.countDocuments(key), 1, 'avisa uma vez');
});

test('conversa do clube: só membros, limite, bloqueio, denúncia e moderação apagam; admin desliga', async () => {
  const [ana, beto, caio] = await Promise.all([signup('Ana'), signup('Beto'), signup('Caio')]);
  const club = (await call('POST', '/clubs', { kind: 'open', name: `Papo ${Date.now()}`, category: 'leitura', city: '' }, ana.token)).body;
  await call('POST', `/clubs/${club.slug}/join`, null, beto.token);
  assert.equal((await call('GET', `/clubs/${club.slug}/messages`, null, caio.token)).status, 403, 'fora do clube não lê');
  const m1 = (await call('POST', `/clubs/${club.slug}/messages`, { text: 'Bom dia, leitores!' }, beto.token)).body;
  assert.equal(m1.mine, true);
  assert.equal((await call('GET', `/clubs/${club.slug}`, null, ana.token)).body.newMessages, 1, 'Ana tem 1 nova');
  const list = (await call('GET', `/clubs/${club.slug}/messages`, null, ana.token)).body;
  assert.equal(list.messages[0].text, 'Bom dia, leitores!');
  assert.equal(list.canModerate, true);
  assert.equal((await call('GET', `/clubs/${club.slug}`, null, ana.token)).body.newMessages, 0, 'leu, zerou');

  // Denúncia chega à moderação do clube; admin apaga e resolve
  assert.equal((await call('POST', '/reports', { targetType: 'message', targetId: m1.id, reason: 'spam', clubSlug: club.slug }, ana.token)).status, 201);
  assert.equal((await call('GET', `/clubs/${club.slug}/reports`, null, ana.token)).body[0].message.text, 'Bom dia, leitores!');
  assert.equal((await call('DELETE', `/clubs/${club.slug}/messages/${m1.id}`, null, ana.token)).status, 200);
  assert.equal((await call('GET', `/clubs/${club.slug}/reports`, null, ana.token)).body.length, 0);
  assert.equal((await call('GET', `/clubs/${club.slug}/messages`, null, beto.token)).body.messages[0].deleted, true);

  // Bloqueio esconde as mensagens de quem foi bloqueado
  await call('POST', `/clubs/${club.slug}/messages`, { text: 'oi de novo' }, beto.token);
  await call('POST', `/users/${beto.me.id}/block`, null, ana.token);
  assert.equal((await call('GET', `/clubs/${club.slug}/messages`, null, ana.token)).body.messages.filter((x) => !x.deleted).length, 0);

  // Limite de envio
  let last;
  for (let i = 0; i < 13; i++) last = await call('POST', `/clubs/${club.slug}/messages`, { text: `msg ${i}` }, ana.token);
  assert.equal(last.status, 400, 'mais de 12 por minuto é barrado');

  assert.equal((await call('PATCH', `/clubs/${club.slug}`, { chatEnabled: false }, ana.token)).status, 200);
  assert.equal((await call('GET', `/clubs/${club.slug}/messages`, null, ana.token)).status, 403, 'conversa desligada');
});
