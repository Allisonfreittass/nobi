import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStreak, computeGroupStreak, todayStatus, groupQuorum } from '../src/services/streaks.js';
import { levelFromXp, stageFromLevel } from '../src/services/level.js';
import { addDays, weekStart } from '../src/lib/dates.js';

const today = '2026-11-06'; // sexta
const ck = (dates, value = 1, userId = 'u1') => dates.map((date) => ({ date, value, userId }));
const daily = { kind: 'daily', target: { amount: 1 }, activeDays: [0, 1, 2, 3, 4, 5, 6] };

test('hábito: dias seguidos, hoje em aberto não quebra', () => {
  const s = computeStreak(daily, ck(['2026-11-03', '2026-11-04', '2026-11-05']), today);
  assert.equal(s.current, 3);
  assert.equal(s.unit, 'days');
});

test('hábito: um dia sem registro zera, mas guarda o melhor', () => {
  const s = computeStreak(daily, ck(['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-02', '2026-11-03']), today);
  assert.equal(s.current, 0);
  assert.equal(s.best, 4);
});

test('dias de descanso não quebram a sequência', () => {
  const weekdays = { ...daily, activeDays: [1, 2, 3, 4, 5] };
  // sex 30/10, (sáb e dom descanso), seg a qui
  const s = computeStreak(weekdays, ck(['2026-10-30', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']), today);
  assert.equal(s.current, 5);
});

test('contagem: só conta o dia que bateu a meta', () => {
  const agua = { kind: 'count', target: { amount: 8 }, activeDays: [0, 1, 2, 3, 4, 5, 6] };
  const s = computeStreak(agua, [...ck(['2026-11-04'], 8), ...ck(['2026-11-05'], 5)], today);
  assert.equal(s.current, 0);
  const st = todayStatus(agua, ck([today], 6), today);
  assert.equal(st.todayValue, 6);
  assert.equal(st.doneToday, false);
});

test('meta semanal: conta semanas, semana atual em aberto', () => {
  const weekly = { kind: 'weekly', target: { amount: 4 } };
  const ws = weekStart(today, 1);
  const dates = [];
  for (let w = 1; w <= 3; w++) for (const i of [0, 1, 2, 3]) dates.push(addDays(ws, -7 * w + i));
  dates.push(ws); // 1 treino nesta semana
  const s = computeStreak(weekly, ck(dates), today);
  assert.equal(s.current, 3);
  assert.equal(s.unit, 'weeks');
});

test('Juntos: o grupo conta quando metade ou mais marca', () => {
  assert.equal(groupQuorum(3), 2);
  assert.equal(groupQuorum(2), 1);
  const goal = { ...daily, shared: { participants: ['a', 'b', 'c'] } };
  const by = new Map([
    ['a', ck(['2026-11-04', '2026-11-05'], 1, 'a')],
    ['b', ck(['2026-11-04'], 1, 'b')],
    ['c', ck(['2026-11-05'], 1, 'c')],
  ]);
  assert.equal(computeGroupStreak(goal, by, today).current, 2);
});

test('nível vem do XP e o estágio segue o nível', () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(1340), 14);
  assert.equal(stageFromLevel(9), 'broto');
  assert.equal(stageFromLevel(10), 'muda');
  assert.equal(stageFromLevel(25), 'botao');
  assert.equal(stageFromLevel(50), 'flor');
});

test('Broto dourado: meta semanal só conta a partir de 2 semanas', async () => {
  const { streakInDays } = await import('../src/services/streaks.js');
  assert.equal(streakInDays({ unit: 'weeks', current: 1 }), 0);
  assert.equal(streakInDays({ unit: 'weeks', current: 2 }), 14);
  assert.equal(streakInDays({ unit: 'days', current: 7 }), 7);
});
