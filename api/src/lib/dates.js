// Datas do app são strings locais 'YYYY-MM-DD'. A conta é feita em UTC para não depender do fuso do servidor.
const DAY = 86400000;

export const toDate = (s) => new Date(`${s}T00:00:00Z`);
export const fmt = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => fmt(new Date(toDate(s).getTime() + n * DAY));
export const weekday = (s) => toDate(s).getUTCDay(); // 0 = domingo
export const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY);
export const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toDate(s).getTime());

/** Início da semana que contém `s`. startsOn: 1 = segunda, 0 = domingo. */
export function weekStart(s, startsOn = 1) {
  const back = (weekday(s) - startsOn + 7) % 7;
  return addDays(s, -back);
}

export function range(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Data local de hoje no Brasil, usada quando o cliente não informa a dele. */
export function serverToday(timeZone = 'America/Sao_Paulo') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
