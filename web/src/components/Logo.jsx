import { BrotoHead } from './Broto.jsx';
import { APP_NAME } from '../config.js';

/** Ícone do app: só a cabeça do Broto, fundo coral (PNG oficial em /icon/). */
export function AppIcon({ size = 34 }) {
  return (
    <span style={{ display: 'inline-flex', flexShrink: 0 }}>
      <BrotoHead size={size} title={APP_NAME} />
    </span>
  );
}

export function Wordmark({ size = 26, dotColor = 'var(--nobi-brasa)' }) {
  return (
    <span className="display" style={{ fontSize: `${size / 16}rem`, letterSpacing: '-0.03em', lineHeight: 1 }}>
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
