// Dados de demonstração. Por segurança só roda no MongoDB embutido de desenvolvimento,
// ou com SEED_ALLOW=sim num banco que você confirmou que é de teste.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb, disconnectDb, usingEmbeddedDb } from './db.js';
import { User, Goal, Checkin, Post, Comment, Follow, Achievement, Streak, XpGrant, Season, Task, ShieldUse, PushLog, PushSubscription } from './models/index.js';
import { addDays, serverToday, weekStart, weekday } from './lib/dates.js';
import { currentSeason } from './services/seasons.js';
import { refreshStreakCache } from './services/progress.js';
import { levelFromXp } from './services/level.js';

if (!usingEmbeddedDb() && process.env.SEED_ALLOW !== 'sim') {
  console.error('Seed recusado: MONGODB_URI aponta para um banco externo. Use SEED_ALLOW=sim só em banco de teste.');
  process.exit(1);
}

const PASSWORD = 'nobi1234';
const today = serverToday();
const ago = (n) => addDays(today, -n);
const minutesAgo = (m) => new Date(Date.now() - m * 60000);

await connectDb();
await Promise.all([User, Goal, Checkin, Post, Comment, Follow, Achievement, Streak, XpGrant, Season, Task, ShieldUse, PushLog, PushSubscription].map((M) => M.deleteMany({})));

const hash = await bcrypt.hash(PASSWORD, 10);
const mk = (name, username, extra = {}) => User.create({
  name, username, email: `${username}@nobi.dev`, passwordHash: hash, demo: true, privacy: { profile: 'public', stats: 'friends', approveFollowers: false }, ...extra,
});
const rafa = await mk('Rafa Lima', 'rafalima', { bio: 'Lendo mais, correndo melhor e terminando o app.', interests: ['Leitura', 'Corrida', 'Inglês', 'Projeto pessoal'], avatarColor: '#FFF1E4', xp: 1340, level: levelFromXp(1340) });
const marina = await mk('Marina Alves', 'marina', { bio: 'Clube do livro às quintas.', interests: ['Leitura', 'Meditação'], avatarColor: '#FFD8C7', xp: 2210, level: 23 });
const caio = await mk('Caio Nunes', 'caionunes', { bio: 'Correndo atrás dos 10 km.', interests: ['Corrida', 'Musculação'], avatarColor: '#D9D1FF', xp: 980, level: 10 });
const julia = await mk('Júlia Prado', 'juliaprado', { bio: 'Treino, café e planilha.', interests: ['Musculação', 'Carreira'], avatarColor: '#CDEBDD', xp: 2650, level: 27 });
const teo = await mk('Téo Martins', 'teo', { bio: 'Aprendendo violão.', interests: ['Hábitos'], avatarColor: '#FFE9A8', xp: 410, level: 5 });
const extras = await Promise.all([
  mk('Lia Souza', 'liasouza', { avatarColor: '#D6E6F5', interests: ['Leitura'] }),
  mk('Bruno Reis', 'brunoreis', { avatarColor: '#F8D3E1', interests: ['Corrida'] }),
  mk('Nina Costa', 'ninacosta', { avatarColor: '#FFD8C7', interests: ['Meditação', 'Carreira'] }),
]);

const friends = [marina, caio, julia, teo];
for (const f of friends) {
  await Follow.create({ followerId: rafa._id, followeeId: f._id });
  await Follow.create({ followerId: f._id, followeeId: rafa._id });
}
await Follow.create({ followerId: caio._id, followeeId: julia._id });
await Follow.create({ followerId: julia._id, followeeId: caio._id });

const season = await currentSeason(today);

async function checkins(goal, user, days, value = 1, extra = {}) {
  for (const d of days) {
    await Checkin.create({ goalId: goal._id, userId: user._id, date: d, value, ...extra });
  }
}
const lastN = (n, from = 1) => Array.from({ length: n }, (_, i) => ago(i + from));
const created = (n) => new Date(`${ago(n)}T12:00:00Z`);

// Rafa
const agua = await Goal.create({ ownerId: rafa._id, title: 'Beber 2 L de água', category: 'habito', kind: 'count', target: { amount: 8, unit: 'copos' }, color: '#3B82C4', scheduleTime: '08:00', createdAt: created(40) });
await checkins(agua, rafa, lastN(21), 8);
await checkins(agua, rafa, [today], 6);

const ler = await Goal.create({ ownerId: rafa._id, title: 'Ler 20 min por dia', category: 'leitura', kind: 'daily', target: { amount: 20, unit: 'min' }, color: '#6C4DFF', scheduleTime: '21:30', createdAt: created(60) });
await checkins(ler, rafa, lastN(6), 25, { minutes: 25, pages: 18 });
await checkins(ler, rafa, lastN(14, 8), 30, { minutes: 30, pages: 20 });

const ingles = await Goal.create({ ownerId: rafa._id, title: 'Inglês B2 até junho', category: 'estudo', kind: 'daily', target: { amount: 1, unit: 'lições' }, activeDays: [1, 2, 3, 4, 5], color: '#2E9C6A', scheduleTime: '07:00', startsAt: ago(50), dueAt: `${Number(today.slice(0, 4)) + 1}-06-30`, tasksMigrated: true, createdAt: created(50) });
await checkins(ingles, rafa, [today, ...lastN(20)].filter((d) => [1, 2, 3, 4, 5].includes(weekday(d))).slice(0, 4), 1, { minutes: 25 });

const app = await Goal.create({
  ownerId: rafa._id, title: 'Lançar o MVP do app', category: 'projeto', kind: 'project', color: '#141218', startsAt: ago(70), dueAt: `${Number(today.slice(0, 4)) + 1}-03-31`, tasksMigrated: true, createdAt: created(70),
});
// Etapas do projeto (2 níveis), com datas e marcos
const step = (title, extra = {}) => Task.create({ userId: rafa._id, goalId: app._id, title, ...extra });
const s1 = await step('Identidade e mockup', { order: 0, isMilestone: true, dueDate: ago(30), doneAt: new Date(`${ago(30)}T15:00:00Z`), doneDate: ago(30) });
const s2 = await step('Cadastro e perfil', { order: 1, isMilestone: true, dueDate: ago(10), doneAt: new Date(`${ago(10)}T15:00:00Z`), doneDate: ago(10) });
const s3 = await step('Feed e check-ins', { order: 2, isMilestone: true, dueDate: addDays(today, 12) });
await step('Cards de post com métricas', { parentId: s3._id, order: 0, doneAt: new Date(`${ago(2)}T15:00:00Z`), doneDate: ago(2) });
await step('Revisar telas do feed', { parentId: s3._id, order: 1, dueDate: today, priorityDate: today });
await step('Reações e comentários', { parentId: s3._id, order: 2, dueDate: addDays(today, 5) });
const s4 = await step('Desafios e ranking', { order: 3, isMilestone: true, dueDate: addDays(today, 40) });
await step('Ranking semanal', { parentId: s4._id, order: 0 });
await step('Checklist do dia', { parentId: s4._id, order: 1 });
await step('Configurar domínio e e-mail', { order: 4, dueDate: ago(3) });
void s1; void s2;
// Inglês: lições como itens com data e uma prioridade de hoje
await Task.create({ userId: rafa._id, goalId: ingles._id, title: 'Unidade 4: revisão', order: 0, doneAt: new Date(`${ago(4)}T15:00:00Z`), doneDate: ago(4) });
await Task.create({ userId: rafa._id, goalId: ingles._id, title: 'Lição 35: phrasal verbs', order: 1, dueDate: today, priorityDate: today });
await Task.create({ userId: rafa._id, goalId: ingles._id, title: 'Simulado B1', order: 2, dueDate: addDays(today, 9), isMilestone: true });
await checkins(app, rafa, lastN(9), 1);

// Treinar 4x na semana, com Caio e Júlia (Juntos)
const treino = await Goal.create({
  ownerId: rafa._id, title: 'Treinar 4x na semana', category: 'treino', kind: 'weekly', target: { amount: 4, unit: 'treinos' }, color: '#FF5B2E', createdAt: created(50),
  shared: { mode: 'together', participants: [rafa._id, caio._id, julia._id], invited: [], startsAt: ago(49), seasonId: season?._id },
});
const ws = weekStart(today, 1);
for (let w = 1; w <= 6; w++) {
  const start = addDays(ws, -7 * w);
  for (const u of [rafa, caio, julia]) {
    // Caio fez só 3 na semana passada: a sequência dele zera, a do grupo continua (maioria marcou)
    const days = u === caio && w === 1 ? [0, 2, 4] : [0, 1, 3, 4];
    await checkins(treino, u, days.map((i) => addDays(start, i)), 1, { minutes: 50 });
  }
}
const thisWeek = (n) => [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(ws, i)).filter((d) => d < today).slice(0, n);
await checkins(treino, rafa, thisWeek(2), 1, { minutes: 50 });
await checkins(treino, caio, thisWeek(3), 1, { minutes: 45 });
await checkins(treino, julia, [...thisWeek(3), today], 1, { minutes: 55 });

// Desafio Foco Total: 30 dias, disputa com checklist
const tasks = [
  { key: 'treino', label: 'Treinar (4x na semana)', pts: 20 },
  { key: 'ler', label: 'Ler 20 minutos', pts: 10 },
  { key: 'ingles', label: 'Estudar inglês', pts: 10 },
  { key: 'dormir', label: 'Dormir antes das 23h', pts: 10 },
  { key: 'projeto', label: 'Avançar no projeto pessoal', pts: 15 },
];
const players = [rafa, marina, caio, julia, teo, ...extras];
const foco = await Goal.create({
  ownerId: julia._id, title: 'Foco Total', category: 'objetivo', kind: 'daily', target: { amount: 1, unit: '' }, color: '#6C4DFF', createdAt: created(11),
  shared: { mode: 'versus', participants: players.map((p) => p._id), invited: [], startsAt: ago(11), endsAt: addDays(ago(11), 29), seasonId: season?._id, tasks },
});
const strength = { [julia.username]: 0.95, [caio.username]: 0.85, [rafa.username]: 0.8, [marina.username]: 0.7 };
// Dias sem nenhuma tarefa, para o anel dos amigos ficar variado
const skip = { [caio.username]: [2], [teo.username]: [1, 4, 6], liasouza: [3], brunoreis: [0, 5], ninacosta: [2, 7] };
let seed = 7;
const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
for (const p of players) {
  const s = strength[p.username] ?? 0.45;
  for (let i = 11; i >= 0; i--) {
    const d = ago(i);
    if (skip[p.username]?.includes(i)) continue;
    for (const t of tasks) {
      if (i === 0 && p._id.equals(rafa._id)) { if (['treino', 'ler'].includes(t.key)) await Checkin.create({ goalId: foco._id, userId: p._id, date: d, taskKey: t.key }); continue; }
      if (rand() < s) await Checkin.create({ goalId: foco._id, userId: p._id, date: d, taskKey: t.key });
    }
  }
}

// Amigos: leitura da Marina com 21 dias, Caio correndo, Téo começando
const lerMarina = await Goal.create({ ownerId: marina._id, title: 'Clube do livro', category: 'leitura', kind: 'daily', target: { amount: 20, unit: 'min' }, color: '#6C4DFF', createdAt: created(40) });
await checkins(lerMarina, marina, [today, ...lastN(20)], 40, { minutes: 40, pages: 30 });
const corrida = await Goal.create({ ownerId: caio._id, title: 'Correr 3x na semana', category: 'treino', kind: 'weekly', target: { amount: 3, unit: 'corridas' }, color: '#FF5B2E', createdAt: created(30) });
await checkins(corrida, caio, [ago(9), ago(7), ago(4), ago(2)], 1, { km: 4.8, minutes: 26 });
const runToday = await Checkin.create({ goalId: corrida._id, userId: caio._id, date: today, value: 1, km: 5.2, minutes: 28, note: "27:40 · ritmo 5'19\"/km" });
const violao = await Goal.create({ ownerId: teo._id, title: 'Praticar violão', category: 'habito', kind: 'daily', target: { amount: 15, unit: 'min' }, color: '#3B82C4', createdAt: created(10) });
await checkins(violao, teo, [ago(3), ago(2)], 15, { minutes: 15 });

const marinaCheckin = await Checkin.findOne({ goalId: lerMarina._id, userId: marina._id, date: today });
const reactors = [rafa, caio, julia, teo, ...extras];
await Post.create({
  userId: marina._id, goalId: lerMarina._id, checkinId: marinaCheckin._id, audience: 'friends', kind: 'checkin', category: 'leitura', date: today,
  metrics: { minutes: 42, pages: 38, deltaVsLastMonth: 18, streak: 21, streakUnit: 'days' },
  text: 'Terminei o livro do clube! Última semana foi corrida, mas não deixei a sequência cair.',
  reactions: reactors.slice(1).map((u, i) => ({ userId: u._id, at: minutesAgo(15 - i) })), commentsCount: 2, createdAt: minutesAgo(18),
});
const caioPost = await Post.create({
  userId: caio._id, goalId: corrida._id, checkinId: runToday._id, audience: 'public', kind: 'record', category: 'treino', title: 'Recorde', date: today,
  metrics: { km: 5.2, minutes: 28, streak: 2, streakUnit: 'weeks' }, text: "27:40 · ritmo 5'19\"/km. Bora pros 10!",
  reactions: [julia, teo, marina].map((u) => ({ userId: u._id, at: minutesAgo(40) })), commentsCount: 1, createdAt: minutesAgo(60),
});
await Post.create({
  userId: julia._id, goalId: treino._id, audience: 'friends', kind: 'milestone', category: 'treino', title: '6 semanas seguidas de treino', date: ago(2),
  metrics: { streak: 6, streakUnit: 'weeks', minutes: 55 }, text: 'Grupo firme! Caio, Rafa, bora fechar a 7ª.',
  reactions: [rafa, caio].map((u) => ({ userId: u._id, at: minutesAgo(2000) })), createdAt: minutesAgo(2 * 1440 + 120),
});
await Post.create({
  userId: rafa._id, goalId: ler._id, audience: 'friends', kind: 'checkin', category: 'leitura', date: ago(1),
  metrics: { minutes: 25, pages: 18, streak: 6, streakUnit: 'days', deltaVsLastMonth: 12 }, text: 'Mais um capítulo antes de dormir.',
  reactions: [marina, julia].map((u) => ({ userId: u._id, at: minutesAgo(1300) })), createdAt: minutesAgo(1440),
});
const marinaPost = await Post.findOne({ userId: marina._id });
await Comment.create({ postId: marinaPost._id, userId: julia._id, text: 'Qual o próximo do clube?' });
await Comment.create({ postId: marinaPost._id, userId: caio._id, text: 'Boa demais!' });
await Comment.create({ postId: caioPost._id, userId: julia._id, text: 'Voando!' });

for (const code of ['primeiro-passo', 'sequencia-7', 'semana-fechada', 'quatro-semanas', 'marco', 'primeiro-post', 'juntos', 'desafio', 'nivel-10']) {
  await Achievement.create({ userId: rafa._id, code, earnedAt: minutesAgo(Math.floor(rand() * 40000)) });
}
for (const code of ['primeiro-passo', 'sequencia-7', 'sequencia-30', 'primeiro-post', 'boa-10']) await Achievement.create({ userId: marina._id, code });

for (const g of await Goal.find()) {
  const ids = g.shared ? g.shared.participants : [g.ownerId];
  for (const u of ids) await refreshStreakCache(g, u, today);
}

console.log(`\nSeed pronto (${today}). Entre com rafalima@nobi.dev / ${PASSWORD}`);
console.log('Outras contas: marina, caionunes, juliaprado, teo (@nobi.dev, mesma senha).');
await mongoose.connection.close();
await disconnectDb();
