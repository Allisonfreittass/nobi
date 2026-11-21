// Marcos de sequência e escudos: janela + marco dá o mesmo resultado do histórico inteiro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStreak, streakMark } from '../src/services/streaks.js';
import { earnDates, balanceAt, shieldMark } from '../src/services/shields.js';
import { addDays, weekStart, weekday } from '../src/lib/dates.js';

let seed = 3;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const today = '2026-11-21';
const history = (goal, days, skip) => {
  const out = [];
  for (let i = days; i >= 1; i--) {
    const date = addDays(today, -i);
    if (goal.activeDays?.length && !goal.activeDays.includes(weekday(date))) continue;
    if (rnd() < skip) continue;
    out.push({ date, value: goal.target.amount });
  }
  return out;
};
const goals = [
  { kind: 'daily', target: { amount: 1 }, activeDays: [] },
  { kind: 'daily', target: { amount: 2 }, activeDays: [1, 2, 3, 4, 5] },
  { kind: 'weekly', target: { amount: 3 }, activeDays: [] },
];

test('sequência longa e melhor sequência: marco + janela = histórico inteiro', () => {
  for (const wso of [0, 1]) for (const g of goals) for (const skip of [0, 0.03, 0.2]) {
    const all = history(g, 730, skip);
    const shields = new Set([addDays(today, -400), addDays(today, -40), addDays(today, -3)]);
    for (const lag of [14, 30, 60, 91]) {
      const from = weekStart(addDays(today, -lag), wso);
      const mark = streakMark(g, all, from, wso, shields);
      // marco andado a partir de um anterior dá o mesmo
      const older = streakMark(g, all, weekStart(addDays(today, -200), wso), wso, shields);
      const walked = streakMark(g, all.filter((c) => c.date >= older.from), from, wso, shields, older);
      assert.deepEqual(walked, mark);
      for (const t of [today, addDays(today, -2)]) {
        const full = computeStreak(g, all, t, wso, shields);
        const win = computeStreak(g, all.filter((c) => c.date >= from), t, wso, shields, mark);
        assert.deepEqual(win, full, `${g.kind} skip=${skip} lag=${lag}`);
      }
    }
  }
});

test('sem registro antes do marco: conta normal a partir da janela', () => {
  const g = goals[0];
  const recent = history(g, 20, 0);
  const mark = streakMark(g, recent, weekStart(addDays(today, -28), 1), 1);
  assert.equal(mark.started, false);
  assert.deepEqual(computeStreak(g, recent, today, 1, null, mark), computeStreak(g, recent, today, 1));
});

test('escudos: ganhos e saldo com marco = histórico inteiro', () => {
  for (const wso of [0, 1]) for (const skip of [0.1, 0.35]) {
    const dates = new Set(history(goals[0], 730, skip).map((c) => c.date));
    const uses = [...dates].filter(() => rnd() < 0.02).map((d) => addDays(d, 1)).filter((d) => !dates.has(d));
    const earns = earnDates(dates, today, wso);
    const from = weekStart(addDays(today, -28), wso);
    const base = shieldMark(new Set([...dates].filter((d) => d < weekStart(addDays(today, -300), wso))), uses, weekStart(addDays(today, -300), wso), wso);
    const walked = shieldMark(new Set([...dates].filter((d) => d >= base.from && d < from)), uses, from, wso, base);
    const direct = shieldMark(new Set([...dates].filter((d) => d < from)), uses, from, wso);
    assert.deepEqual(walked, direct);
    const recent = earnDates(new Set([...dates].filter((d) => d >= from)), today, wso);
    const tailEarns = [...(direct.earnAtF ? [direct.from] : []), ...recent];
    assert.equal(direct.nEarn + recent.length, earns.length, 'escudos ganhos no total');
    for (const day of [addDays(today, -7), today, addDays(today, 1)]) {
      assert.equal(balanceAt(day, tailEarns, uses.filter((d) => d >= from), direct.bal), balanceAt(day, earns, uses), `saldo em ${day}`);
    }
  }
});
