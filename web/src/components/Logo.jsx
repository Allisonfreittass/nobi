import { BrotoHead } from './Broto.jsx';
import { APP_NAME } from '../config.js';

/** Ícone (só a cabeça, sobre bloco brasa) + wordmark com o ponto em brasa. */
export function AppIcon({ size = 34 }) {
  return (
    <span role="img" aria-label={APP_NAME} style={{ width: size, height: size, borderRadius: size * 0.26, background: 'var(--nobi-brasa)', display: 'inline-flex', overflow: 'hidden', flexShrink: 0 }}>
      <BrotoHead size={size} />
    </span>
  );
}

export function Wordmark({ size = 26, dotColor = 'var(--nobi-brasa)' }) {
  return (
    <span className="display" style={{ fontSize: size, letterSpacing: '-0.03em', lineHeight: 1 }}>
      {APP_NAME}<span style={{ color: dotColor }}>.</span>
    </span>
  );
}

export function Logo({ size = 34 }) {
  return (
    <span className="row gap-10">
      <AppIcon size={size} />
      <span aria-hidden="true"><Wordmark size={size * 0.76} /></span>
    </span>
  );
}
