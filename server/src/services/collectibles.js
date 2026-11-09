// Acessórios colecionáveis do Broto (DESIGN.md §2 e §8.8). Arte em web/public/broto/acessorios/<id>.svg,
// camada transparente 768×768 por cima da arte oficial, sem mexer nela.
// Ganhou, é seu para sempre; o Broto veste um por vez.
import { Achievement, Collectible } from '../models/index.js';

export const ACCESSORIES = [
  { id: 'faixa', name: 'Faixa da constância', how: '7 dias seguidos em um objetivo', achievement: 'sequencia-7' },
  { id: 'oculos-redondos', name: 'Óculos de sábio', how: '30 dias seguidos em um objetivo', achievement: 'sequencia-30' },
  { id: 'medalha', name: 'Medalha dos três dígitos', how: '100 dias seguidos em um objetivo', achievement: 'sequencia-100' },
  { id: 'coroa-flores', name: 'Coroa de flores', how: '21 dias seguidos durante a Temporada Primavera', season: 'Primavera' },
  { id: 'oculos-sol', name: 'Óculos de sol', how: '21 dias seguidos durante a Temporada Verão', season: 'Verão' },
  { id: 'cachecol', name: 'Cachecol de outono', how: '21 dias seguidos durante a Temporada Outono', season: 'Outono' },
  { id: 'protetor-orelha', name: 'Protetor de orelha', how: '21 dias seguidos durante a Temporada Inverno', season: 'Inverno' },
];
const byId = new Map(ACCESSORIES.map((a) => [a.id, a]));
export const isAccessory = (id) => byId.has(id);
export const SEASON_STREAK_DAYS = 21;

/** Ids dos acessórios da pessoa: os das conquistas que ela tem + os de temporada guardados. */
export async function ownedAccessories(userId) {
  const [achievements, seasonal] = await Promise.all([
    Achievement.find({ userId }, { code: 1, earnedAt: 1 }).lean(),
    Collectible.find({ userId }).lean(),
  ]);
  const at = new Map();
  const codes = new Map(achievements.map((a) => [a.code, a.earnedAt]));
  for (const a of ACCESSORIES) if (a.achievement && codes.has(a.achievement)) at.set(a.id, codes.get(a.achievement));
  for (const c of seasonal) if (byId.has(c.item)) at.set(c.item, c.earnedAt);
  return at; // id → quando ganhou
}

/** Acessórios que uma lista de conquistas novas acabou de liberar. */
export const accessoriesFromAchievements = (codes) => ACCESSORIES.filter((a) => a.achievement && codes.includes(a.achievement));

/** Dá o acessório da temporada (uma vez por pessoa). Retorna o acessório se for novo. */
export async function grantSeasonAccessory(userId, season) {
  const a = season && ACCESSORIES.find((x) => x.season === season.name);
  if (!a) return null;
  try {
    await Collectible.create({ userId, item: a.id, seasonId: season._id });
    return a;
  } catch (e) {
    if (e.code === 11000) return null;
    throw e;
  }
}

export const accessoryView = (a) => ({ id: a.id, name: a.name });
