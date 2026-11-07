// Nobi — mascote Broto (versão ilustrada, oficial a partir de nov/2026).
// Um único componente para todas as aparições do mascote DENTRO do app (sempre corpo inteiro).
// Para ícone e logo use <BrotoHead /> ou os arquivos design/icon/nobi-icon-*.png.
//
// Arte: 40 imagens WebP transparentes (768×768) em design/broto/kit/.
// Copie a pasta para web/public/broto/ — o componente busca em `${basePath}broto-<expressão>-<estágio>[-dourado].webp`.
//
// Regras (ver DESIGN.md §6):
//   stage      = forma pelo nível, nunca regride: 'broto' | 'muda' | 'botao' | 'flor'
//   golden     = maior sequência ativa >= 7 dias (folhas douradas com brilho)
//   expression = 'padrao' | 'comemorando' | 'foco' | 'saudade' | 'descanso'

import React from 'react';

export const STAGES = ['broto', 'muda', 'botao', 'flor'];
export const EXPRESSIONS = ['padrao', 'comemorando', 'foco', 'saudade', 'descanso'];

export function stageFromLevel(level) {
  if (level >= 50) return 'flor';
  if (level >= 25) return 'botao';
  if (level >= 10) return 'muda';
  return 'broto';
}

export function isGolden(maxActiveStreakDays) {
  return maxActiveStreakDays >= 7;
}

export function brotoSrc({ stage = 'broto', golden = false, expression = 'padrao', basePath = '/broto/' } = {}) {
  const s = STAGES.includes(stage) ? stage : 'broto';
  const e = EXPRESSIONS.includes(expression) ? expression : 'padrao';
  return `${basePath}broto-${e}-${s}${golden ? '-dourado' : ''}.webp`;
}

const ALT = {
  padrao: 'Broto sorrindo',
  comemorando: 'Broto comemorando com os braços para cima',
  foco: 'Broto concentrado',
  saudade: 'Broto com saudade',
  descanso: 'Broto descansando',
};

/**
 * @param {object} props
 * @param {'broto'|'muda'|'botao'|'flor'} [props.stage='broto']
 * @param {boolean} [props.golden=false]
 * @param {'padrao'|'comemorando'|'foco'|'saudade'|'descanso'} [props.expression='padrao']
 * @param {number} [props.size=120] largura e altura em px (a arte é quadrada)
 * @param {boolean} [props.shadow=true] sombra suave no chão
 * @param {string} [props.title] se informado, vira imagem acessível com esse texto; senão é decorativa
 * @param {boolean} [props.priority=false] true na tela de Conquista/Login para carregar antes
 * @param {string} [props.basePath='/broto/']
 * @param {string} [props.className]
 */
export default function Broto({
  stage = 'broto',
  golden = false,
  expression = 'padrao',
  size = 120,
  shadow = true,
  title,
  priority = false,
  basePath = '/broto/',
  className,
}) {
  const src = brotoSrc({ stage, golden, expression, basePath });
  return (
    <span
      className={className}
      style={{ position: 'relative', display: 'inline-block', width: size, height: size, lineHeight: 0 }}
    >
      {shadow && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', left: '22%', right: '22%', bottom: '3%', height: '4%',
            borderRadius: '50%', background: 'rgba(20,18,24,0.14)',
          }}
        />
      )}
      <img
        src={src}
        width={size}
        height={size}
        alt={title ?? ''}
        aria-hidden={title ? undefined : true}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        style={{ position: 'relative', width: size, height: size, objectFit: 'contain' }}
      />
    </span>
  );
}

/** Ícone do app (só a cabeça, fundo coral). Escolhe o PNG mais próximo do tamanho pedido. */
export function BrotoHead({ size = 40, title, basePath = '/icon/' }) {
  const sizes = [24, 32, 40, 48, 64, 120, 152, 167, 180, 192, 512, 1024];
  const want = size * (typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2);
  const pick = sizes.find((s) => s >= want) || 1024;
  return (
    <img
      src={`${basePath}nobi-icon-${pick}.png`}
      width={size}
      height={size}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      style={{ borderRadius: '22.5%', display: 'block' }}
    />
  );
}

/** Pré-carrega as artes de um estado (ex.: antes de abrir a tela de Conquista). */
export function preloadBroto(states = [], basePath = '/broto/') {
  states.forEach((st) => {
    const img = new Image();
    img.src = brotoSrc({ ...st, basePath });
  });
}

export { ALT as BROTO_ALT };
