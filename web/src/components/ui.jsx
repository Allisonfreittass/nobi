import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { BrotoHead } from './Broto.jsx';

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="knob" />
    </button>
  );
}

export function Segmented({ options, value, onChange, label, compact, className = '' }) {
  return (
    <div role="group" aria-label={label} className={`segmented ${compact ? 'compact' : ''} ${className}`}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

export function Chip({ on, onClick, children, small, className = '', ...rest }) {
  return (
    <button type="button" className={`chip ${small ? 'sm' : ''} ${className}`} aria-pressed={on} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}

/** Pílula de sequência: chama + número. "bump" faz o pulo de 420 ms quando o número muda. */
export function StreakPill({ value, unit = 'dias', active, bump }) {
  const [anim, setAnim] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (bump && value > prev.current) {
      setAnim(true);
      const t = setTimeout(() => setAnim(false), 450);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value, bump]);
  return (
    <span className={`streak-pill ${active ? 'active' : ''} ${anim ? 'nobi-bump' : ''}`} aria-label={`Sequência: ${value} ${unit}`}>
      <Icon name="flame" size={15} stroke={2.2} className="flame" />
      <span aria-hidden="true">{value} {unit}</span>
    </span>
  );
}

export function Avatar({ user, size = 40, ring, className = '' }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38), background: user?.avatarColor || 'var(--nobi-creme)' };
  const ringClass = ring ? `ring-${ring}` : '';
  let inner = (user?.name || '?').trim().charAt(0).toUpperCase();
  if (user?.avatarUrl === 'broto') {
    style.background = 'var(--nobi-brasa)';
    inner = <BrotoHead size={Math.round(size * 0.92)} />;
  } else if (user?.avatarUrl?.startsWith('data:')) {
    inner = <img src={user.avatarUrl} alt="" />;
  }
  return <span className={`avatar ${ringClass} ${className}`} style={style} aria-hidden="true">{inner}</span>;
}

export function ProgressBar({ value, color = 'var(--nobi-brasa)', height = 8, label }) {
  const pct = Math.round(Math.max(0, Math.min(1, value || 0)) * 100);
  return (
    <div className="bar" style={{ height }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <span style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function RingProgress({ value, size = 72, thickness = 9, children, color = 'var(--nobi-brasa)' }) {
  const pct = Math.round(Math.max(0, Math.min(1, value || 0)) * 100);
  return (
    <div className="ring-progress" style={{ width: size, height: size, background: `conic-gradient(${color} ${pct}%, var(--nobi-track) 0)` }}>
      <div style={{ width: size - thickness * 2, height: size - thickness * 2 }}>{children}</div>
    </div>
  );
}

export function Field({ label, hint, hintTone, children, id: given }) {
  const auto = useId();
  const id = given || auto;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {typeof children === 'function' ? children(id) : children}
      {hint && <span className={`field-hint ${hintTone || ''}`} aria-live="polite">{hint}</span>}
    </div>
  );
}

export function Sheet({ open, onClose, title, children, labelledBy }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('input, textarea, button')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title} aria-labelledby={labelledBy} ref={ref}>
        <span className="sheet-grip" aria-hidden="true" />
        {title && (
          <div className="row between">
            <h2 className="title t-22">{title}</h2>
            <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}><Icon name="close" /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function BackButton({ onClick, label = 'Voltar', className = '' }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} onClick={onClick || (() => window.history.length > 1 ? window.history.back() : (window.location.href = '/'))}>
      <Icon name="back" />
    </button>
  );
}

export function WeekDots({ days, color }) {
  return (
    <div className="week-dots" aria-hidden="true">
      {days.map((d) => {
        const style = {};
        if (d.state === 'done') style.background = color;
        if (d.state === 'done' && !d.today) style.opacity = 0.35;
        if (d.state === 'today') { style.background = 'var(--nobi-card)'; style.boxShadow = `inset 0 0 0 2px ${color}`; }
        if (d.state === 'rest') { style.background = 'transparent'; style.boxShadow = 'inset 0 0 0 1.5px var(--nobi-track)'; }
        return <span key={d.date} style={style} />;
      })}
    </div>
  );
}

export function Skeleton({ height = 120, style }) {
  return <div className="skeleton" style={{ height, ...style }} aria-hidden="true" />;
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="form-error row between gap-12" role="alert">
      <span>{error.message || String(error)}</span>
      {onRetry && <button type="button" className="btn btn-soft sm" onClick={onRetry}>Tentar de novo</button>}
    </div>
  );
}
