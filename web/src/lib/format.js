export const CATEGORIES = {
  treino: { label: 'Treino', color: '#FF5B2E', icon: 'dumbbell', verb: 'treinou' },
  leitura: { label: 'Leitura', color: '#6C4DFF', icon: 'book', verb: 'leu' },
  estudo: { label: 'Estudo', color: '#2E9C6A', icon: 'lines', verb: 'estudou' },
  habito: { label: 'Hábito', color: '#3B82C4', icon: 'drop', verb: 'manteve o hábito' },
  objetivo: { label: 'Objetivo', color: '#E0457B', icon: 'target', verb: 'avançou' },
  projeto: { label: 'Projeto', color: '#141218', icon: 'arrowUpRight', verb: 'avançou no projeto' },
};
export const CATEGORY_ORDER = ['treino', 'leitura', 'estudo', 'habito', 'projeto', 'objetivo'];

export const GOAL_COLORS = [
  ['#FF5B2E', 'Brasa'], ['#6C4DFF', 'Órbita'], ['#2E9C6A', 'Verde'], ['#3B82C4', 'Azul'], ['#E0457B', 'Rosa'], ['#141218', 'Tinta'],
];

/** Cor de objetivo para pintar na tela: 'Tinta' vira um cinza legível no tema escuro. */
export const goalColor = (hex) => (hex === '#141218' ? 'var(--nobi-goal-ink)' : hex);

export const KIND_LABEL = { daily: 'Hábito diário', weekly: 'Meta semanal', count: 'Contagem', project: 'Projeto' };

// Segunda a domingo, com o número do dia em JS (0 = domingo)
export const WEEK = [
  { d: 1, short: 'S', label: 'Seg', full: 'Segunda' },
  { d: 2, short: 'T', label: 'Ter', full: 'Terça' },
  { d: 3, short: 'Q', label: 'Qua', full: 'Quarta' },
  { d: 4, short: 'Q', label: 'Qui', full: 'Quinta' },
  { d: 5, short: 'S', label: 'Sex', full: 'Sexta' },
  { d: 6, short: 'S', label: 'Sáb', full: 'Sábado' },
  { d: 0, short: 'D', label: 'Dom', full: 'Domingo' },
];
export const weekOrder = (weekStart) => (weekStart === 'sun' ? [WEEK[6], ...WEEK.slice(0, 6)] : WEEK);

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const monthName = (i) => MONTHS[i];
export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function longToday(d = new Date()) {
  return `${DAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function shortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ` de ${y}` : ''}`;
}

export function timeAgo(date) {
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const days = Math.floor(s / 86400);
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return new Date(date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export const firstName = (name = '') => name.split(' ')[0];
export const fmtNum = (n, digits = 1) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: digits });
export const unitWord = (unit, n) => (unit === 'weeks' ? (n === 1 ? 'semana' : 'semanas') : n === 1 ? 'dia' : 'dias');
export const unitShort = (unit) => (unit === 'weeks' ? 'sem.' : 'dias');
export const signed = (n) => `${n > 0 ? '+' : ''}${n}%`;
