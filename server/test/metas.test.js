import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';

const { pacePct } = await import('../src/services/tasks.js');
const { addDays } = await import('../src/lib/dates.js');
const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { Goal, Task } = await import('../src/models/index.js');

let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const call = (method, p, body, token) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', 'X-Local-Date': today, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const signup = async (n) => (await call('POST', '/auth/signup', { name: n, email: `${n}${Date.now()}@t.dev`, password: 'senha1234' })).body;

test('ritmo: onde deveria estar hoje', () => {
  assert.equal(pacePct('2026-01-01', '2026-01-11', '2026-01-06'), 50);
  assert.equal(pacePct('2026-01-01', '2026-01-11', '2026-02-01'), 100);
  assert.equal(pacePct('2026-01-01', '2026-01-01', '2026-01-01'), null);
});

test('checklist de projeto: progresso, dois níveis e marco', async () => {
  const { token } = await signup('Proj');
  const g = (await call('POST', '/goals', { title: 'App', category: 'projeto', kind: 'project', dueAt: addDays(today, 30), tasks: [{ title: 'Design', isMilestone: true }, { title: 'Código' }] }, token)).body;
  assert.equal(g.tasks.length, 2);
  const code = g.tasks.find((t) => t.title === 'Código');
  const s1 = (await call('POST', `/tasks/goal/${g.id}`, { title: 'API', parentId: code.id }, token)).body;
  const s2 = (await call('POST', `/tasks/goal/${g.id}`, { title: 'Telas', parentId: code.id }, token)).body;
  assert.equal((await call('POST', `/tasks/goal/${g.id}`, { title: 'Neta', parentId: s1.id }, token)).status, 400, 'máximo 2 níveis');

  let view = (await call('GET', `/goals/${g.id}`, null, token)).body;
  assert.deepEqual(view.taskProgress, { done: 0, total: 4 });
  await call('PATCH', `/tasks/${s1.id}`, { done: true }, token);
  await call('PATCH', `/tasks/${s2.id}`, { done: true }, token);
  view = (await call('GET', `/goals/${g.id}`, null, token)).body;
  assert.deepEqual(view.taskProgress, { done: 3, total: 4 }, 'etapa com subetapas conta quando todas estão feitas');
  assert.equal(view.tasks.find((t) => t.title === 'Código').done, true);
  assert.ok(view.pace && view.pace.daysLeft === 30);

  const design = view.tasks.find((t) => t.title === 'Design');
  const r = (await call('PATCH', `/tasks/${design.id}`, { done: true }, token)).body;
  assert.equal(r.celebration.kind, 'milestone');
  assert.equal(r.celebration.finished, true, 'todas as etapas feitas');
  assert.equal(r.goal.streak.current, 1, 'avançar no projeto conta para a sequência');
});

test('concluir a última subetapa de um marco comemora o marco', async () => {
  const { token } = await signup('Marco');
  const g = (await call('POST', '/goals', { title: 'Livro', category: 'projeto', kind: 'project', tasks: [{ title: 'Capítulo 1', isMilestone: true }] }, token)).body;
  const cap = g.tasks[0];
  const a = (await call('POST', `/tasks/goal/${g.id}`, { title: 'Rascunho', parentId: cap.id }, token)).body;
  const b = (await call('POST', `/tasks/goal/${g.id}`, { title: 'Revisão', parentId: cap.id }, token)).body;
  assert.equal((await call('PATCH', `/tasks/${a.id}`, { done: true }, token)).body.celebration, null, 'ainda falta uma subetapa');
  const r = (await call('PATCH', `/tasks/${b.id}`, { done: true }, token)).body;
  assert.equal(r.celebration?.title, 'Capítulo 1');
});

test('prioridades (máx. 3), ficou pra trás e Fazer hoje', async () => {
  const { token, me } = await signup('Prio');
  const g = (await call('POST', '/goals', { title: 'Estudar', category: 'estudo', kind: 'daily' }, token)).body;
  for (const n of [1, 2, 3]) assert.equal((await call('POST', `/tasks/goal/${g.id}`, { title: `P${n}`, priority: true }, token)).status, 201);
  assert.equal((await call('POST', `/tasks/goal/${g.id}`, { title: 'P4', priority: true }, token)).status, 400);
  const late = await Task.create({ userId: me.id, goalId: g.id, title: 'Atrasada', dueDate: addDays(today, -3) });

  let hoje = (await call('GET', '/metas?view=hoje', null, token)).body;
  assert.equal(hoje.priorities.length, 3);
  assert.deepEqual(hoje.overdue.map((t) => t.title), ['Atrasada']);
  assert.ok(hoje.routine.some((r) => r.id === g.id), 'hábito aparece na rotina');

  await call('PATCH', `/tasks/${late._id}`, { dueDate: today }, token);
  hoje = (await call('GET', '/metas?view=hoje', null, token)).body;
  assert.equal(hoje.overdue.length, 0, 'Fazer hoje tira de Ficou pra trás');

  const semana = (await call('GET', '/metas?view=semana', null, token)).body;
  assert.equal(semana.habits.days.length, 7);
  const mes = (await call('GET', '/metas?view=mes', null, token)).body;
  assert.ok('habitsPct' in mes);
  await call('PATCH', `/tasks/${late._id}`, { done: true }, token);
  const feitas = (await call('GET', '/metas?view=concluidas', null, token)).body;
  assert.equal(feitas.days[0].tasks[0].title, 'Atrasada');
});

test('marcos antigos viram tarefas', async () => {
  const { token, me } = await signup('Legado');
  const g = await Goal.create({ ownerId: me.id, title: 'Antigo', category: 'projeto', kind: 'project', milestones: [{ title: 'A', done: true, doneAt: today }, { title: 'B' }] });
  const view = (await call('GET', `/goals/${g._id}`, null, token)).body;
  assert.deepEqual(view.tasks.map((t) => [t.title, t.done, t.isMilestone]), [['A', true, true], ['B', false, true]]);
  assert.equal(await Task.countDocuments({ goalId: g._id }), 2);
});
