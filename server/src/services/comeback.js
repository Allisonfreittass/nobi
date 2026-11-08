// Volta ao app depois de dias sem registrar (DESIGN.md §6: Broto "saudade", "que bom te ver").
// O servidor decide quando mostrar; o app só exibe. Aparece uma vez por ausência.
import { Checkin } from '../models/index.js';
import { diffDays } from '../lib/dates.js';

/** A partir de quantos dias sem registro a volta é celebrada (ex.: último registro anteontem = 2). */
export const COMEBACK_MIN_DAYS = 3;

async function lastCheckinDate(user, today) {
  const last = await Checkin.findOne({ userId: user._id, date: { $lte: today } }).sort({ date: -1 }).select('date').lean();
  return last?.date || null;
}

/**
 * { since, days, streakKept } quando a pessoa volta depois de COMEBACK_MIN_DAYS+ dias sem registrar
 * e ainda não viu a tela desta ausência. Quem nunca registrou ou já registrou hoje não vê.
 * streakKept: algum escudo segurou a sequência (maior sequência ativa > 0).
 */
export async function comebackFor(user, today, summary) {
  const since = await lastCheckinDate(user, today);
  if (!since || since === today) return null;
  const days = diffDays(since, today);
  if (days < COMEBACK_MIN_DAYS || user.comebackSeenFor === since) return null;
  return { since, days, streakKept: (summary?.maxActiveDays || 0) > 0 };
}

/** Marca a ausência atual como vista (a tela não volta até a próxima ausência). */
export async function markComebackSeen(user, today) {
  const since = await lastCheckinDate(user, today);
  if (since) {
    user.comebackSeenFor = since;
    await user.save();
  }
}
