// Regras dos programas de treino. Funções puras: recebem o programa e as sessões, sem banco.

/** Nome do exercício para casar o mesmo exercício entre programas ("Supino reto" = "supino  RETO"). */
export const exerciseSlug = (name) => String(name || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const doneSets = (ex) => (ex.sets || []).filter((s) => s.done !== false);

/** Volume de um exercício: soma de repetições × carga das séries feitas (kg). */
export const exerciseVolume = (ex) => doneSets(ex).reduce((t, s) => t + (s.reps || 0) * (s.load || 0), 0);
export const sessionVolume = (session) => (session.exercises || []).reduce((t, ex) => t + exerciseVolume(ex), 0);
export const bestLoad = (ex) => doneSets(ex).reduce((m, s) => Math.max(m, (s.reps || 0) > 0 ? s.load || 0 : 0), 0);

/** Progresso: cada sessão (um dia) conta um treino. Passar do total não passa de 100%. */
export function planProgress(plan, sessions) {
  const done = sessions.length;
  const total = plan.totalSessions;
  return { done, total, pct: Math.min(1, done / total), left: Math.max(0, total - done), completed: done >= total };
}

/** Próxima divisão do rodízio: a que vem depois da última feita. Sem sessões, a primeira. */
export function nextDay(plan, sessions) {
  const days = plan.days || [];
  if (!days.length) return null;
  const last = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const i = last ? days.findIndex((d) => d.key === last.dayKey) : -1;
  return days[(i + 1) % days.length] || days[0];
}

/** Última vez que cada exercício foi feito (por chave e por nome): base para sugerir a carga de hoje. */
export function lastSets(sessions) {
  const out = {};
  for (const s of [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    for (const ex of s.exercises || []) {
      if (!ex.sets?.length) continue;
      const entry = { date: s.date, sets: ex.sets.map((x) => ({ reps: x.reps, load: x.load })) };
      if (ex.key) out[`k:${ex.key}`] = entry;
      out[`n:${exerciseSlug(ex.name)}`] = entry;
    }
  }
  return out;
}

/**
 * Resumo por exercício num conjunto de sessões: primeira e melhor carga, última carga, volume total.
 * Base do Histórico e da comparação entre programas.
 */
export function exerciseSummary(sessions) {
  const by = new Map();
  for (const s of [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    for (const ex of s.exercises || []) {
      const slug = exerciseSlug(ex.name);
      if (!slug) continue;
      const best = bestLoad(ex);
      const vol = exerciseVolume(ex);
      if (!doneSets(ex).length) continue;
      const cur = by.get(slug) || { slug, name: ex.name, sessions: 0, firstLoad: best, bestLoad: 0, lastLoad: 0, volume: 0, firstDate: s.date, lastDate: s.date };
      cur.sessions += 1;
      cur.bestLoad = Math.max(cur.bestLoad, best);
      cur.lastLoad = best;
      cur.volume += vol;
      cur.lastDate = s.date;
      cur.name = ex.name;
      by.set(slug, cur);
    }
  }
  return [...by.values()].sort((a, b) => b.volume - a.volume);
}

/** Resumo de um programa inteiro, para o Histórico. */
export function planSummary(plan, sessions) {
  const dates = sessions.map((s) => s.date).sort();
  return {
    sessions: sessions.length,
    volume: Math.round(sessions.reduce((t, s) => t + sessionVolume(s), 0)),
    minutes: sessions.reduce((t, s) => t + (s.minutes || 0), 0),
    firstDate: dates[0] || null,
    lastDate: dates.at(-1) || null,
    exercises: exerciseSummary(sessions),
  };
}

/** Evolução de um exercício ao longo do tempo, em todos os programas: um ponto por sessão. */
export function exerciseHistory(slug, sessions, plansById) {
  const points = [];
  for (const s of [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    for (const ex of s.exercises || []) {
      if (exerciseSlug(ex.name) !== slug || !doneSets(ex).length) continue;
      points.push({
        date: s.date,
        bestLoad: bestLoad(ex),
        volume: Math.round(exerciseVolume(ex)),
        sets: doneSets(ex).map((x) => ({ reps: x.reps, load: x.load })),
        planId: String(s.planId),
        planName: plansById.get(String(s.planId))?.name || '',
      });
    }
  }
  return points;
}

// ——— Leitura e validação do que chega do app ———

const clip = (v, max) => String(v ?? '').trim().slice(0, max);
const num = (v, min, max, step = 1) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n / step) * step));
};
const key = () => Math.random().toString(36).slice(2, 10);

/** Divisões e exercícios do programa. Mantém as chaves que já existem para não perder o histórico. */
export function parseDays(raw) {
  if (!Array.isArray(raw)) return null;
  const days = raw.slice(0, 7).map((d, i) => ({
    key: clip(d?.key, 20) || key(),
    name: clip(d?.name, 40) || `Treino ${String.fromCharCode(65 + i)}`,
    exercises: (Array.isArray(d?.exercises) ? d.exercises : []).slice(0, 20)
      .filter((e) => clip(e?.name, 60))
      .map((e) => ({
        key: clip(e.key, 20) || key(),
        name: clip(e.name, 60),
        sets: num(e.sets ?? 3, 1, 20),
        reps: clip(e.reps ?? '10', 12) || '10',
        load: num(e.load, 0, 2000, 0.5),
        notes: clip(e.notes, 120),
      })),
  }));
  const seen = new Set();
  for (const d of days) { if (seen.has(d.key)) d.key = key(); seen.add(d.key); }
  return days;
}

/** Exercícios feitos numa sessão: só os que têm nome, séries com números válidos. */
export function parseLoggedExercises(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 30)
    .filter((e) => clip(e?.name, 60))
    .map((e) => ({
      key: clip(e.key, 20),
      name: clip(e.name, 60),
      sets: (Array.isArray(e.sets) ? e.sets : []).slice(0, 20).map((s) => ({
        reps: num(s?.reps, 0, 1000),
        load: num(s?.load, 0, 2000, 0.5),
        done: s?.done !== false,
      })),
    }));
}
