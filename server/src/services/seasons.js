// Temporadas de 12 semanas, começando na segunda-feira da semana de cada estação (hemisfério sul).
import { Season } from '../models/index.js';
import { addDays, weekStart, diffDays } from '../lib/dates.js';

const STARTS = [
  ['03-20', 'Outono'],
  ['06-21', 'Inverno'],
  ['09-22', 'Primavera'],
  ['12-21', 'Verão'],
];
export const SEASON_WEEKS = 12;

function candidates(today) {
  const y = Number(today.slice(0, 4));
  const out = [];
  for (const year of [y - 1, y]) {
    for (const [md, name] of STARTS) {
      const startsAt = weekStart(`${year}-${md}`, 1);
      out.push({ name, startsAt, endsAt: addDays(startsAt, SEASON_WEEKS * 7 - 1) });
    }
  }
  return out;
}

/** Temporada vigente (cria se ainda não existir). Entre temporadas, devolve null. */
export async function currentSeason(today) {
  const found = await Season.findOne({ startsAt: { $lte: today }, endsAt: { $gte: today } }).lean();
  if (found) return found;
  const c = candidates(today).find((s) => s.startsAt <= today && s.endsAt >= today);
  if (!c) return null;
  return Season.findOneAndUpdate({ startsAt: c.startsAt }, { $setOnInsert: c }, { upsert: true, returnDocument: 'after' }).lean();
}

export function seasonInfo(season, today) {
  if (!season) return null;
  const week = Math.min(SEASON_WEEKS, Math.floor(diffDays(season.startsAt, today) / 7) + 1);
  return { id: season._id, name: season.name, week, weeks: SEASON_WEEKS, startsAt: season.startsAt, endsAt: season.endsAt };
}
