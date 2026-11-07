// Nobi — mascote Broto.
// Um único componente para todas as aparições do mascote DENTRO do app (sempre corpo inteiro).
// Para ícone e logo use <BrotoHead /> (só a cabeça) ou os arquivos icon-*.svg.
//
// Regras (ver DESIGN.md §6):
//   stage   = forma pelo nível, nunca regride: 'broto' | 'muda' | 'botao' | 'flor'
//   golden  = maior sequência ativa >= 7 dias (folhas douradas com contorno tinta)
//   expression = 'padrao' | 'comemorando' | 'foco' | 'saudade'

import React from 'react';

const C = {
  ink: '#141218',
  body: '#FFF1E4',
  belly: '#FFFFFF',
  cheek: '#FF8A66',
  gold: '#FFB224',
  bud: '#6C4DFF',
  outline: '#D8D2C6',
};

export function stageFromLevel(level) {
  if (level >= 50) return 'flor';
  if (level >= 25) return 'botao';
  if (level >= 10) return 'muda';
  return 'broto';
}

export function isGolden(maxActiveStreakDays) {
  return maxActiveStreakDays >= 7;
}

function Leaf({ d, golden }) {
  return golden
    ? <path d={d} fill={C.gold} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" />
    : <path d={d} fill={C.ink} />;
}

function Sprout({ stage, golden }) {
  const stem = (y2) => <path d={`M60 32 V${y2}`} stroke={C.ink} strokeWidth="5" strokeLinecap="round" />;
  if (stage === 'muda') {
    return (
      <g transform="translate(0 -4)">
        <path d="M60 36 V10" stroke={C.ink} strokeWidth="5" strokeLinecap="round" />
        <Leaf golden={golden} d="M60 28 C52 16 40 17 37 23 C45 30 54 30 60 28Z" />
        <Leaf golden={golden} d="M60 22 C66 8 80 7 84 13 C77 21 68 24 60 22Z" />
        <Leaf golden={golden} d="M60 13 C53 3 44 3 41 8 C47 14 55 15 60 13Z" />
      </g>
    );
  }
  if (stage === 'botao') {
    return (
      <g transform="translate(0 -4)">
        <path d="M60 36 V14" stroke={C.ink} strokeWidth="5" strokeLinecap="round" />
        <Leaf golden={golden} d="M60 29 C52 17 40 18 37 24 C45 31 54 31 60 29Z" />
        <Leaf golden={golden} d="M60 25 C66 11 80 10 84 16 C77 24 68 27 60 25Z" />
        <path d="M60 2 C70 6 71 16 60 19 C49 16 50 6 60 2Z" fill={C.bud} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" />
      </g>
    );
  }
  if (stage === 'flor') {
    const petals = [[60, 3], [69, 9.5], [65.5, 19.5], [54.5, 19.5], [51, 9.5]];
    return (
      <g transform="translate(0 -4)">
        <path d="M60 36 V16" stroke={C.ink} strokeWidth="5" strokeLinecap="round" />
        <Leaf golden={golden} d="M60 30 C52 18 40 19 37 25 C45 32 54 32 60 30Z" />
        <Leaf golden={golden} d="M60 26 C66 12 80 11 84 17 C77 25 68 28 60 26Z" />
        {petals.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6.5" fill={C.body} stroke={C.ink} strokeWidth="2.5" />
        ))}
        <circle cx="60" cy="12" r="5.5" fill={C.bud} stroke={C.ink} strokeWidth="2.5" />
      </g>
    );
  }
  // broto (padrão)
  return (
    <g>
      {stem(16)}
      <Leaf golden={golden} d="M60 19 C52 7 40 8 37 14 C45 21 54 21 60 19Z" />
      <Leaf golden={golden} d="M60 17 C66 3 80 2 84 8 C77 16 68 19 60 17Z" />
    </g>
  );
}

const ARM_DOWN_L = 'M27 70 C17 68 13 77 18 82 C22 85 27 81 28 78Z';
const ARM_DOWN_R = 'M93 70 C103 68 107 77 102 82 C98 85 93 81 92 78Z';
const ARM_UP_L = 'M30 64 C18 58 12 46 18 42 C23 40 28 50 33 58Z';
const ARM_UP_R = 'M90 64 C102 58 108 46 102 42 C97 40 92 50 87 58Z';
const BODY = 'M60 30 C84 30 96 52 96 74 C96 93 81 104 60 104 C39 104 24 93 24 74 C24 52 36 30 60 30Z';
const FOOT_L = 'M41 114.5 C41 110 45 108.5 50 108.5 C54.5 108.5 57 110.5 57 113 C57 115.5 55 116.5 51 116.5 L43.5 116.5 C42 116.5 41 115.8 41 114.5Z';
const FOOT_R = 'M79 114.5 C79 110 75 108.5 70 108.5 C65.5 108.5 63 110.5 63 113 C63 115.5 65 116.5 69 116.5 L76.5 116.5 C78 116.5 79 115.8 79 114.5Z';

function Face({ expression }) {
  const cheeks = (
    <>
      <ellipse cx="36" cy="70" rx="5.5" ry="3.5" fill={C.cheek} />
      <ellipse cx="84" cy="70" rx="5.5" ry="3.5" fill={C.cheek} />
    </>
  );
  if (expression === 'comemorando') {
    return (
      <>
        <path d="M40 60 Q48 50 56 60" stroke={C.ink} strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <path d="M64 60 Q72 50 80 60" stroke={C.ink} strokeWidth="4.5" fill="none" strokeLinecap="round" />
        {cheeks}
        <path d="M51 70 Q60 86 69 70 Z" fill={C.ink} />
      </>
    );
  }
  if (expression === 'saudade') {
    return (
      <>
        <ellipse cx="48" cy="59" rx="10" ry="13" fill={C.ink} />
        <ellipse cx="72" cy="59" rx="10" ry="13" fill={C.ink} />
        <circle cx="51.5" cy="53" r="4.2" fill="#fff" />
        <circle cx="75.5" cy="53" r="4.2" fill="#fff" />
        <circle cx="46" cy="63" r="1.8" fill="#fff" />
        <circle cx="70" cy="63" r="1.8" fill="#fff" />
        <ellipse cx="60" cy="78" rx="4" ry="3.5" fill={C.ink} />
      </>
    );
  }
  const eyes = (
    <>
      <ellipse cx="48" cy="58" rx="9" ry="12" fill={C.ink} />
      <ellipse cx="72" cy="58" rx="9" ry="12" fill={C.ink} />
      <circle cx="51" cy="53" r="3.6" fill="#fff" />
      <circle cx="75" cy="53" r="3.6" fill="#fff" />
    </>
  );
  if (expression === 'foco') {
    return (
      <>
        <path d="M41 45 Q48 42.5 55 45" stroke={C.ink} strokeWidth="3.6" fill="none" strokeLinecap="round" />
        <path d="M65 45 Q72 42.5 79 45" stroke={C.ink} strokeWidth="3.6" fill="none" strokeLinecap="round" />
        {eyes}
        <path d="M53 75 Q60 80 67 75" stroke={C.ink} strokeWidth="3.6" fill="none" strokeLinecap="round" />
      </>
    );
  }
  return (
    <>
      {eyes}
      {cheeks}
      <path d="M54 73 Q60 79 66 73" stroke={C.ink} strokeWidth="3.6" fill="none" strokeLinecap="round" />
    </>
  );
}

/**
 * @param {object} props
 * @param {'broto'|'muda'|'botao'|'flor'} [props.stage='broto']
 * @param {boolean} [props.golden=false]
 * @param {'padrao'|'comemorando'|'foco'|'saudade'} [props.expression='padrao']
 * @param {'down'|'up'|'wave'} [props.arms] padrão: 'up' ao comemorar, 'wave' na saudade, senão 'down'
 * @param {boolean} [props.outlined=false] contorno suave para fundos brancos
 * @param {boolean} [props.shadow=true]
 * @param {number} [props.size=120]
 * @param {string} [props.title] se informado, o SVG vira imagem acessível
 * @param {string} [props.className]
 */
export default function Broto({
  stage = 'broto',
  golden = false,
  expression = 'padrao',
  arms,
  outlined = false,
  shadow = true,
  size = 120,
  title,
  className,
}) {
  const pose = arms || (expression === 'comemorando' ? 'up' : expression === 'saudade' ? 'wave' : 'down');
  const left = pose === 'up' ? ARM_UP_L : ARM_DOWN_L;
  const right = pose === 'down' ? ARM_DOWN_R : ARM_UP_R;
  const line = outlined ? { stroke: C.outline, strokeWidth: 2 } : {};
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true };

  return (
    <svg viewBox="0 -8 120 128" width={size} height={(size * 128) / 120} className={className} {...a11y}>
      {shadow && <ellipse cx="60" cy="117.5" rx="26" ry="2.8" fill={C.ink} opacity="0.2" />}
      <Sprout stage={stage} golden={golden} />
      <rect x="47" y="98" width="9" height="15" rx="4.5" fill={C.body} {...line} />
      <rect x="64" y="98" width="9" height="15" rx="4.5" fill={C.body} {...line} />
      <path d={FOOT_L} fill={C.body} stroke={C.ink} strokeWidth="2" strokeLinejoin="round" />
      <path d={FOOT_R} fill={C.body} stroke={C.ink} strokeWidth="2" strokeLinejoin="round" />
      <path d={left} fill={C.body} {...line} />
      <path d={right} fill={C.body} {...line} />
      <path d={BODY} fill={C.body} {...line} />
      <ellipse cx="60" cy="86" rx="20" ry="13" fill={C.belly} opacity="0.75" />
      <Face expression={expression} />
    </svg>
  );
}

/** Só a cabeça — para logo e ícone. Sem braços, barriga ou pés. */
export function BrotoHead({ size = 40, detail = 'auto', title }) {
  const level = detail === 'auto' ? (size >= 60 ? 'full' : size >= 32 ? 'mid' : 'min') : detail;
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true };
  return (
    <svg viewBox="20 0 80 80" width={size} height={size} {...a11y}>
      <path d="M60 32 V14" stroke={C.ink} strokeWidth={level === 'min' ? 9 : 5.5} strokeLinecap="round" />
      {level !== 'min' && (
        <>
          <path d="M60 19 C52 7 40 8 37 14 C45 21 54 21 60 19Z" fill={C.ink} />
          <path d="M60 17 C66 3 80 2 84 8 C77 16 68 19 60 17Z" fill={C.ink} />
        </>
      )}
      <path d={BODY} fill={C.body} />
      <ellipse cx="48" cy="56" rx={level === 'min' ? 10.5 : 9} ry={level === 'min' ? 13.5 : 12} fill={C.ink} />
      <ellipse cx="72" cy="56" rx={level === 'min' ? 10.5 : 9} ry={level === 'min' ? 13.5 : 12} fill={C.ink} />
      {level !== 'min' && (
        <>
          <circle cx="51" cy="51" r="3.6" fill="#fff" />
          <circle cx="75" cy="51" r="3.6" fill="#fff" />
          <ellipse cx="36" cy="68" rx="6" ry="4" fill={C.cheek} />
          <ellipse cx="84" cy="68" rx="6" ry="4" fill={C.cheek} />
        </>
      )}
      {level === 'full' && <path d="M54 71 Q60 77 66 71" stroke={C.ink} strokeWidth="3.6" fill="none" strokeLinecap="round" />}
    </svg>
  );
}
