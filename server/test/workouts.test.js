import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'teste';

const { connectDb, disconnectDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { WorkoutSession } = await import('../src/models/index.js');
const { planProgress, nextDay, exerciseSummary, sessionVolume, exerciseSlug, parseDays } = await import('../src/services/workouts.js');

let server; let base;
before(async () => { await connectDb({ ephemeral: true }); server = createApp().listen(0); base = `http://127.0.0.1:${server.address().port}/api`; });
after(async () => { server.close(); await disconnectDb(); });
const call = (method, p, body, token) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const signup = async (n) => (await call('POST', '/auth/signup', { name: n, email: `${n}${Date.now()}@t.dev`, password: 'senha1234' })).body;

const ABC = [
  { name: 'Treino A', exercises: [{ name: 'Supino reto', sets: 3, reps: '10', load: 40 }, { name: 'Tríceps corda', sets: 3, reps: '12', load: 20 }] },
  { name: 'Treino B', exercises: [{ name: 'Agachamento', sets: 4, reps: '8', load: 60 }] },
];

// ——— Regras puras ———

test('progresso conta sessões e não passa de 100%', () => {
  assert.deepEqual(planProgress({ totalSessions: 4 }, [{}, {}]), { done: 2, total: 4, pct: 0.5, left: 2, completed: false });
  const over = planProgress({ totalSessions: 2 }, [{}, {}, {}]);
  assert.equal(over.pct, 1);
  assert.equal(over.left, 0);
  assert.equal(over.completed, true);
});

test('próxima divisão segue o rodízio a partir da última sessão', () => {
  const plan = { days: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] };
  assert.equal(nextDay(plan, []).key, 'a');
  assert.equal(nextDay(plan, [{ date: '2026-01-01', dayKey: 'a' }, { date: '2026-01-03', dayKey: 'b' }]).key, 'c');
  assert.equal(nextDay(plan, [{ date: '2026-01-05', dayKey: 'c' }]).key, 'a');
  assert.equal(nextDay({ days: [] }, []), null);
});

test('volume e resumo só contam séries feitas', () => {
  const s1 = { date: '2026-01-01', exercises: [{ name: 'Supino Reto', sets: [{ reps: 10, load: 40 }, { reps: 8, load: 45 }, { reps: 10, load: 99, done: false }] }] };
  const s2 = { date: '2026-01-08', exercises: [{ name: 'supino  reto', sets: [{ reps: 8, load: 50 }] }] };
  assert.equal(sessionVolume(s1), 10 * 40 + 8 * 45);
  const [sup] = exerciseSummary([s2, s1]);
  assert.equal(sup.sessions, 2, 'mesmo exercício com grafia diferente');
  assert.equal(sup.firstLoad, 45);
  assert.equal(sup.bestLoad, 50);
  assert.equal(sup.lastLoad, 50);
  assert.equal(exerciseSlug('Elevação  Lateral!'), 'elevacao-lateral');
});

test('divisões sem nome ganham letra; exercícios sem nome somem; chaves ficam', () => {
  const days = parseDays([{ key: 'x1', exercises: [{ name: '' }, { name: 'Remada', key: 'e1', sets: 99, load: 32.3 }] }, {}]);
  assert.equal(days[0].name, 'Treino A');
  assert.equal(days[0].key, 'x1');
  assert.equal(days[0].exercises.length, 1);
  assert.equal(days[0].exercises[0].sets, 20);
  assert.equal(days[0].exercises[0].load, 32.5);
  assert.equal(days[1].name, 'Treino B');
});

// ——— API ———

test('criar, registrar, concluir e arquivar um treino', async () => {
  const { token } = await signup('Duda');
  const goal = (await call('POST', '/goals', { title: 'Treinar 4x', category: 'treino', kind: 'weekly', target: { amount: 4, unit: 'treinos' } }, token)).body;

  assert.equal((await call('POST', '/treinos', { name: 'ABC', totalSessions: 2, days: [] }, token)).status, 400, 'precisa de divisão');
  const created = await call('POST', '/treinos', { name: 'Hipertrofia', totalSessions: 2, days: ABC, goalId: goal.id }, token);
  assert.equal(created.status, 201);
  const plan = created.body;
  assert.equal(plan.goal.id, goal.id);
  assert.equal(plan.next.name, 'Treino A');
  assert.equal(plan.progress.done, 0);

  const dayA = plan.days[0];
  const sets = (load) => [{ reps: 10, load }, { reps: 10, load }, { reps: 8, load }];
  const r1 = await call('POST', `/treinos/${plan.id}/sessoes`, { dayKey: dayA.key, minutes: 50, exercises: [{ key: dayA.exercises[0].key, name: 'Supino reto', sets: sets(40) }] }, token);
  assert.equal(r1.status, 201);
  assert.equal(r1.body.firstToday, true);
  assert.equal(r1.body.session.volume, 40 * 28);
  assert.equal(r1.body.plan.progress.done, 1);

  // Salvar de novo no mesmo dia atualiza, não conta outro treino
  const r2 = await call('POST', `/treinos/${plan.id}/sessoes`, { dayKey: dayA.key, exercises: [{ key: dayA.exercises[0].key, name: 'Supino reto', sets: sets(42.5) }] }, token);
  assert.equal(r2.status, 200);
  assert.equal(r2.body.firstToday, false);
  assert.equal(r2.body.plan.progress.done, 1);

  assert.equal((await call('POST', `/treinos/${plan.id}/sessoes`, { exercises: [{ name: 'Supino', sets: [{ reps: 0, load: 10 }] }] }, token)).status, 400, 'sem série feita');

  // Um treino de ontem (direto no banco) para fechar o programa e ver o rodízio
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await WorkoutSession.create({ userId: (await call('GET', '/me', null, token)).body.id, planId: plan.id, date: yesterday, dayKey: plan.days[1].key, dayName: 'Treino B', exercises: [{ name: 'Agachamento', sets: [{ reps: 8, load: 60 }] }] });

  const detail = (await call('GET', `/treinos/${plan.id}`, null, token)).body;
  assert.equal(detail.progress.done, 2);
  assert.equal(detail.progress.completed, true);
  assert.equal(detail.sessions.length, 2);
  assert.deepEqual(detail.last[`k:${dayA.exercises[0].key}`].sets[0], { reps: 10, load: 42.5 }, 'última carga para sugerir');

  // Aumentar o total reabre
  const reopened = (await call('PATCH', `/treinos/${plan.id}`, { totalSessions: 3 }, token)).body;
  assert.equal(reopened.progress.completed, false);
  assert.equal(reopened.completedAt, null);

  assert.equal((await call('POST', `/treinos/${plan.id}/arquivar`, null, token)).status, 200);
  assert.equal((await call('GET', '/treinos', null, token)).body.length, 0, 'arquivado sai dos ativos');
  const hist = (await call('GET', '/treinos/historico', null, token)).body;
  assert.equal(hist.length, 1);
  assert.ok(hist[0].archivedAt);
  assert.equal(hist[0].summary.sessions, 2);
  assert.equal(hist[0].summary.exercises.find((e) => e.slug === 'supino-reto').bestLoad, 42.5);
  assert.equal((await call('POST', `/treinos/${plan.id}/sessoes`, { exercises: [{ name: 'Supino', sets: [{ reps: 5, load: 10 }] }] }, token)).status, 400, 'arquivado não registra');

  const ev = (await call('GET', '/treinos/exercicios/supino-reto', null, token)).body;
  assert.equal(ev.name, 'Supino reto');
  assert.equal(ev.points.length, 1);
  assert.equal(ev.points[0].planName, 'Hipertrofia');

  await call('POST', `/treinos/${plan.id}/restaurar`, null, token);
  assert.equal((await call('GET', '/treinos', null, token)).body.length, 1);
  await call('DELETE', `/treinos/${plan.id}`, null, token);
  assert.equal(await WorkoutSession.countDocuments({ planId: plan.id }), 0, 'sessões apagadas junto');
});

test('ninguém de fora vê, registra ou liga objetivo dos outros', async () => {
  const a = await signup('Enzo');
  const b = await signup('Fabi');
  const plan = (await call('POST', '/treinos', { name: 'Full body', totalSessions: 10, days: ABC }, a.token)).body;
  assert.equal((await call('GET', `/treinos/${plan.id}`, null, b.token)).status, 404);
  assert.equal((await call('POST', `/treinos/${plan.id}/sessoes`, { exercises: [{ name: 'X', sets: [{ reps: 1, load: 1 }] }] }, b.token)).status, 404);
  assert.equal((await call('DELETE', `/treinos/${plan.id}`, null, b.token)).status, 404);
  const goalA = (await call('POST', '/goals', { title: 'Treinar', category: 'treino', kind: 'daily' }, a.token)).body;
  assert.equal((await call('POST', '/treinos', { name: 'Meu', totalSessions: 5, days: ABC, goalId: goalA.id }, b.token)).status, 400);
});
