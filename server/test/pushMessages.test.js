import test from 'node:test';
import assert from 'node:assert/strict';
import { REMINDERS, chooseMessage } from '../src/services/pushMessages.js';

const base = { total: 3, maxDays: 0, golden: false, friendsDone: [], challenge: null, hour: 20, comeback: false };
const goal = (o) => ({ title: 'Ler 20 min', category: 'leitura', kind: 'daily', streak: 0, unit: 'days', need: 1, todayValue: 0, weekValue: 0, unitLabel: '', ...o });

test('véspera do Broto dourado ganha a mensagem do 7º dia', () => {
  const ids = new Set();
  for (let i = 0; i < 40; i++) ids.add(chooseMessage(REMINDERS, { ...base, pending: [goal({ streak: 6 })] }).id);
  assert.ok(ids.has('golden-eve'));
});

test('não repete a mensagem recente quando há outras opções', () => {
  const ctx = { ...base, pending: [goal({ streak: 6 })], friendsDone: ['Marina'] };
  for (let i = 0; i < 30; i++) assert.notEqual(chooseMessage(REMINDERS, ctx, ['golden-eve']).id, 'golden-eve');
});

test('amigos e desafio entram no texto', () => {
  const ctx = { ...base, pending: [goal({})], friendsDone: ['Marina', 'Caio'], challenge: { title: 'Foco Total', position: 2, aheadName: 'Júlia', gap: 40 } };
  const texts = new Set();
  for (let i = 0; i < 60; i++) { const m = chooseMessage(REMINDERS, ctx); texts.add(`${m.title} ${m.body}`); }
  const all = [...texts].join(' ');
  assert.match(all, /Marina e Caio/);
  assert.match(all, /Júlia/);
});

test('mensagens nunca culpam nem usam tom de cobrança', () => {
  const ctxs = [
    { ...base, pending: [goal({ streak: 6 })] },
    { ...base, pending: [goal({})], comeback: true },
    { ...base, pending: [goal({ kind: 'count', need: 8, todayValue: 6, unitLabel: 'copos' })], hour: 22 },
  ];
  for (const c of ctxs) for (let i = 0; i < 30; i++) {
    const m = chooseMessage(REMINDERS, c);
    assert.doesNotMatch(`${m.title} ${m.body}`, /perdeu|triste|decepcion|vergonha|falhou|não fez/i);
  }
});
