// Card de story (1080 × 1920) do resumo semanal, desenhado em canvas no próprio aparelho.
import { brotoSrc, ACCESSORIES } from '../components/Broto.jsx';
import { brotoOf } from './session.jsx';
import { APP_NAME, BRAND_LINE, SITE_URL } from '../config.js';
import { weekOrder } from './format.js';

const W = 1080;
const H = 1920;
const INK = '#141218';
const CREME = '#FFF1E4';
const BRASA = '#FF5B2E';

const loadImg = (src) => new Promise((resolve) => {
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

/** Carrega a arte do Broto (WebP 768 × 768) e o acessório vestido (SVG por cima). Sem arte, o card sai sem o mascote. */
async function loadBroto(state) {
  const [art, acc] = await Promise.all([
    loadImg(brotoSrc({ expression: 'comemorando', ...state })),
    state.accessory && ACCESSORIES.includes(state.accessory) ? loadImg(`/broto/acessorios/${state.accessory}.svg`) : null,
  ]);
  return art ? { draw: (ctx, x, y, size) => { ctx.drawImage(art, x, y, size, size); if (acc) ctx.drawImage(acc, x, y, size, size); } } : null;
}

function text(ctx, str, x, y, { size, weight = 700, family = 'Inter', color = INK, align = 'left', tracking = 0 }) {
  ctx.font = `${weight} ${size}px "${family}", system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`;
  ctx.fillText(str, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  return ctx.measureText(str).width;
}

function roundRect(ctx, x, y, w, h, r, color) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

const fmt = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Escolhe as 3 métricas mais interessantes da semana. */
function pickMetrics(s) {
  const all = [
    s.bestStreak >= 2 && { value: fmt(s.bestStreak), label: 'dias seguidos' },
    { value: fmt(s.checkins), label: s.checkins === 1 ? 'registro' : 'registros' },
    s.minutes >= 30 && { value: s.minutes >= 120 ? `${fmt(Math.round(s.minutes / 6) / 10)}h` : `${fmt(s.minutes)}`, label: s.minutes >= 120 ? 'de foco' : 'minutos' },
    s.pages > 0 && { value: fmt(s.pages), label: 'páginas' },
    s.km > 0 && { value: fmt(s.km), label: 'km' },
    { value: `${s.level}`, label: 'nível' },
  ].filter(Boolean);
  return all.slice(0, 3);
}

/** Desenha o card e devolve o canvas. me: { username, level, golden, prefs }. */
export async function drawWeeklyStory(summary, me) {
  try {
    await Promise.all([
      document.fonts.load('800 200px "Bricolage Grotesque"'),
      document.fonts.load('700 40px "Inter"'),
      document.fonts.load('600 40px "Inter"'),
    ]);
  } catch { /* usa a fonte do sistema */ }
  const broto = await loadBroto(brotoOf(me));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BRASA;
  ctx.fillRect(0, 0, W, H);
  // Confetes
  const bits = [[120, 330, 26, 26, 8, CREME, 20], [930, 300, 34, 34, 17, '#6C4DFF', 0], [960, 700, 18, 42, 9, INK, -30], [110, 820, 22, 22, 11, '#FFB224', 0], [220, 230, 16, 36, 8, '#6C4DFF', 40], [880, 880, 20, 20, 6, CREME, 15]];
  for (const [bx, by, bw, bh, r, c, rot] of bits) {
    ctx.save(); ctx.translate(bx, by); ctx.rotate((rot * Math.PI) / 180); roundRect(ctx, -bw / 2, -bh / 2, bw, bh, r, c); ctx.restore();
  }

  // Topo: marca e período
  const wm = text(ctx, APP_NAME, 90, 190, { size: 84, weight: 800, family: 'Bricolage Grotesque', tracking: -3 });
  text(ctx, '.', 90 + wm, 190, { size: 84, weight: 800, family: 'Bricolage Grotesque', color: CREME });
  ctx.font = '700 34px "Inter", system-ui';
  const pill = `MINHA SEMANA · ${summary.label.toUpperCase()}`;
  const pw = ctx.measureText(pill).width + 56;
  roundRect(ctx, W - 90 - pw, 132, pw, 72, 36, 'rgba(20,18,24,0.12)');
  text(ctx, pill, W - 90 - pw / 2, 180, { size: 30, weight: 700, align: 'center', tracking: 2 });

  // Broto comemorando, num disco claro (sobre coral, DESIGN.md §6). Arte quadrada, sem esticar.
  ctx.beginPath(); ctx.arc(W / 2, 610, 300, 0, Math.PI * 2); ctx.fillStyle = CREME; ctx.fill();
  if (broto) broto.draw(ctx, W / 2 - 270, 340, 540);

  // Número principal
  text(ctx, `${summary.activeDays} de 7`, W / 2, 1090, { size: 190, weight: 800, family: 'Bricolage Grotesque', align: 'center', tracking: -8 });
  text(ctx, summary.activeDays === 7 ? 'dias ativos. Semana perfeita!' : 'dias ativos nesta semana', W / 2, 1160, { size: 44, weight: 600, align: 'center' });

  // Semana: Seg a Dom
  const order = weekOrder(me.prefs?.weekStart).map((w) => w.d);
  const byDay = new Map(summary.days.map((d) => [d.weekday, d]));
  const size = 112; const gap = 18;
  const startX = (W - (size * 7 + gap * 6)) / 2;
  const labels = { 0: 'D', 1: 'S', 2: 'T', 3: 'Q', 4: 'Q', 5: 'S', 6: 'S' };
  order.forEach((wd, i) => {
    const d = byDay.get(wd);
    const x = startX + i * (size + gap);
    const y = 1230;
    if (d?.count) {
      roundRect(ctx, x, y, size, size, 30, INK);
      ctx.strokeStyle = CREME; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x + 32, y + 58); ctx.lineTo(x + 50, y + 76); ctx.lineTo(x + 82, y + 40); ctx.stroke();
    } else {
      roundRect(ctx, x, y, size, size, 30, 'rgba(20,18,24,0.14)');
    }
    text(ctx, labels[wd], x + size / 2, y + size + 50, { size: 32, weight: 700, align: 'center' });
  });

  // Métricas
  const metrics = pickMetrics(summary);
  const mw = (W - 180 - 24 * (metrics.length - 1)) / metrics.length;
  metrics.forEach((m, i) => {
    const x = 90 + i * (mw + 24);
    roundRect(ctx, x, 1470, mw, 200, 40, CREME);
    text(ctx, m.value, x + mw / 2, 1578, { size: 84, weight: 800, family: 'Bricolage Grotesque', align: 'center', tracking: -3 });
    text(ctx, m.label, x + mw / 2, 1632, { size: 32, weight: 600, align: 'center', color: '#4A4752' });
  });

  // Rodapé: frase e convite
  text(ctx, `${BRAND_LINE[0]} ${BRAND_LINE[1]}`, W / 2, 1745, { size: 36, weight: 600, align: 'center' });
  const link = `${SITE_URL.replace('https://', '')}/convite/${me.username}`;
  ctx.font = '700 32px "Inter", system-ui';
  const lw = ctx.measureText(link).width + 64;
  roundRect(ctx, (W - lw) / 2, 1778, lw, 70, 35, INK);
  text(ctx, link, W / 2, 1824, { size: 32, weight: 700, align: 'center', color: '#FFFFFF' });
  return canvas;
}

const MONTH_INITIAL = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** Card de story do "Ano no Nobi": dias ativos, barras mês a mês e as 3 métricas do ano. */
export async function drawYearStory(y, me) {
  try {
    await Promise.all([document.fonts.load('800 200px "Bricolage Grotesque"'), document.fonts.load('700 40px "Inter"'), document.fonts.load('600 40px "Inter"')]);
  } catch { /* fonte do sistema */ }
  const broto = await loadBroto(brotoOf(me));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6C4DFF';
  ctx.fillRect(0, 0, W, H);
  const bits = [[130, 300, 26, 26, 8, CREME, 20], [940, 280, 34, 34, 17, BRASA, 0], [960, 660, 18, 42, 9, '#FFB224', -30], [110, 760, 22, 22, 11, CREME, 0]];
  for (const [bx, by, bw, bh, r, c, rot] of bits) { ctx.save(); ctx.translate(bx, by); ctx.rotate((rot * Math.PI) / 180); roundRect(ctx, -bw / 2, -bh / 2, bw, bh, r, c); ctx.restore(); }

  const wm = text(ctx, APP_NAME, 90, 190, { size: 84, weight: 800, family: 'Bricolage Grotesque', tracking: -3, color: '#FFFFFF' });
  text(ctx, '.', 90 + wm, 190, { size: 84, weight: 800, family: 'Bricolage Grotesque', color: BRASA });
  ctx.font = '700 34px "Inter", system-ui';
  const pill = `MEU ${y.year}`;
  const pw = ctx.measureText(pill).width + 56;
  roundRect(ctx, W - 90 - pw, 132, pw, 72, 36, 'rgba(255,255,255,0.16)');
  text(ctx, pill, W - 90 - pw / 2, 180, { size: 30, weight: 700, align: 'center', tracking: 2, color: '#FFFFFF' });

  ctx.beginPath(); ctx.arc(W / 2, 560, 260, 0, Math.PI * 2); ctx.fillStyle = CREME; ctx.fill();
  if (broto) broto.draw(ctx, W / 2 - 235, 325, 470);

  text(ctx, fmt(y.activeDays), W / 2, 1010, { size: 200, weight: 800, family: 'Bricolage Grotesque', align: 'center', tracking: -8, color: '#FFFFFF' });
  text(ctx, y.activeDays === 1 ? 'dia de evolução no ano' : 'dias de evolução no ano', W / 2, 1080, { size: 44, weight: 600, align: 'center', color: '#FFFFFF' });

  // Barras mês a mês
  const max = Math.max(1, ...y.months);
  const bw = 58; const gap = 18; const base = 1340; const hMax = 190;
  const x0 = (W - (bw * 12 + gap * 11)) / 2;
  y.months.forEach((n, i) => {
    const x = x0 + i * (bw + gap);
    const h = n ? Math.max(14, Math.round((n / max) * hMax)) : 8;
    roundRect(ctx, x, base - h, bw, h, 14, n ? (i === y.bestMonth ? BRASA : CREME) : 'rgba(255,255,255,0.22)');
    text(ctx, MONTH_INITIAL[i], x + bw / 2, base + 46, { size: 28, weight: 700, align: 'center', color: '#FFFFFF' });
  });

  const metrics = [
    y.longestRun >= 2 && { value: fmt(y.longestRun), label: 'dias seguidos' },
    { value: fmt(y.checkins), label: 'registros' },
    y.km > 0 && { value: fmt(y.km), label: 'km' },
    y.pages > 0 && { value: fmt(y.pages), label: 'páginas' },
    y.minutes >= 60 && { value: `${fmt(Math.round(y.minutes / 6) / 10)}h`, label: 'de foco' },
    y.boaReceived > 0 && { value: fmt(y.boaReceived), label: '"Boa!" recebidos' },
  ].filter(Boolean).slice(0, 3);
  const mw = (W - 180 - 24 * (metrics.length - 1)) / metrics.length;
  metrics.forEach((m, i) => {
    const x = 90 + i * (mw + 24);
    roundRect(ctx, x, 1470, mw, 200, 40, CREME);
    text(ctx, m.value, x + mw / 2, 1578, { size: 80, weight: 800, family: 'Bricolage Grotesque', align: 'center', tracking: -3 });
    text(ctx, m.label, x + mw / 2, 1632, { size: 30, weight: 600, align: 'center', color: '#4A4752' });
  });

  text(ctx, `${BRAND_LINE[0]} ${BRAND_LINE[1]}`, W / 2, 1745, { size: 36, weight: 600, align: 'center', color: '#FFFFFF' });
  const link = `${SITE_URL.replace('https://', '')}/convite/${me.username}`;
  ctx.font = '700 32px "Inter", system-ui';
  const lw = ctx.measureText(link).width + 64;
  roundRect(ctx, (W - lw) / 2, 1778, lw, 70, 35, INK);
  text(ctx, link, W / 2, 1824, { size: 32, weight: 700, align: 'center', color: '#FFFFFF' });
  return canvas;
}

export const canvasToBlob = (canvas, type = 'image/png', quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
