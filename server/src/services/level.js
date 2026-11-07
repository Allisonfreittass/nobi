// Nível vem de XP, que só cresce. Logo o nível nunca regride (DESIGN.md §8.5).
export const XP = { checkin: 10, achievement: 25, milestone: 30 };

export const levelFromXp = (xp) => 1 + Math.floor(Math.max(0, xp) / 100);

export function stageFromLevel(level) {
  if (level >= 50) return 'flor';
  if (level >= 25) return 'botao';
  if (level >= 10) return 'muda';
  return 'broto';
}
