import { Achievement, User, XpGrant } from '../models/index.js';
import { XP, levelFromXp } from './level.js';

// Catálogo de conquistas. O código é estável; o texto pode mudar.
export const CATALOG = [
  { code: 'primeiro-passo', title: 'Primeiro passo', desc: 'Fez o primeiro registro' },
  { code: 'sequencia-7', title: '7 dias seguidos', desc: 'Uma semana inteira sem parar' },
  { code: 'sequencia-30', title: '30 dias seguidos', desc: 'Um mês de constância' },
  { code: 'sequencia-100', title: '100 dias seguidos', desc: 'Três dígitos' },
  { code: 'semana-fechada', title: 'Semana fechada', desc: 'Bateu uma meta semanal' },
  { code: 'quatro-semanas', title: '4 semanas', desc: 'Um mês de metas semanais' },
  { code: 'marco', title: 'Marco batido', desc: 'Concluiu um marco de projeto' },
  { code: 'projeto-concluido', title: 'Projeto entregue', desc: 'Concluiu todos os marcos' },
  { code: 'primeiro-post', title: 'Na roda', desc: 'Compartilhou pela primeira vez' },
  { code: 'boa-10', title: '10 "Boa!"', desc: 'Recebeu 10 reações' },
  { code: 'torcida', title: 'Torcida', desc: 'Reagiu a 10 posts de amigos' },
  { code: 'desafio', title: 'Topou o desafio', desc: 'Entrou em um desafio' },
  { code: 'juntos', title: 'Juntos', desc: 'Criou um objetivo com amigos' },
  { code: 'nivel-10', title: 'Virou muda', desc: 'Chegou ao nível 10' },
  { code: 'nivel-25', title: 'Botão de flor', desc: 'Chegou ao nível 25' },
  { code: 'nivel-50', title: 'Flor', desc: 'Chegou ao nível 50' },
  { code: 'temporada-21', title: '21 dias na temporada', desc: 'Sequência de 21 dias durante a temporada', seasonal: true },
  { code: 'temporada-desafio', title: 'Desafio da temporada', desc: 'Completou um desafio na temporada', seasonal: true },
];

export const catalogByCode = Object.fromEntries(CATALOG.map((a) => [a.code, a]));

/** Códigos de conquista que o usuário já tem. Passe o Set para award() e evite idas ao banco à toa. */
export async function ownedCodes(userId) {
  const rows = await Achievement.find({ userId }, { code: 1 }).lean();
  return new Set(rows.map((r) => r.code));
}

/** Soma XP uma única vez por chave. Retorna true se somou. */
export async function grantXp(userId, key, amount, { have } = {}) {
  try {
    await XpGrant.create({ userId, key, amount });
  } catch (e) {
    if (e.code === 11000) return false;
    throw e;
  }
  const user = await User.findByIdAndUpdate(userId, { $inc: { xp: amount } }, { returnDocument: 'after' });
  const level = Math.max(user.level, levelFromXp(user.xp));
  if (level !== user.level) {
    await User.updateOne({ _id: userId }, { $set: { level } });
    for (const [min, code] of [[10, 'nivel-10'], [25, 'nivel-25'], [50, 'nivel-50']]) {
      if (level >= min) await award(userId, code, undefined, { have });
    }
  }
  return true;
}

/** Concede uma conquista se ainda não tiver. Retorna a conquista nova ou null. */
export async function award(userId, code, seasonId, { have } = {}) {
  if (!catalogByCode[code] || have?.has(code)) return null;
  try {
    const a = await Achievement.create({ userId, code, seasonId });
    have?.add(code);
    await grantXp(userId, `achievement:${code}`, XP.achievement, { have });
    return { code, ...catalogByCode[code], earnedAt: a.earnedAt };
  } catch (e) {
    if (e.code === 11000) { have?.add(code); return null; }
    throw e;
  }
}
