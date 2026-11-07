import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { BrotoHead } from './Broto.jsx';

/** Switch do sistema: checkbox real com role="switch" (DESIGN.md 8.3). */
export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={Boolean(checked)} aria-label={label} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
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
  const [lit, setLit] = useState(false);
  const prev = useRef({ value, active });
  useEffect(() => {
    const was = prev.current;
    prev.current = { value, active };
    if (!bump) return undefined;
    const timers = [];
    if (value > was.value) { setAnim(true); timers.push(setTimeout(() => setAnim(false), 450)); }
    if (active && !was.active) { setLit(true); timers.push(setTimeout(() => setLit(false), 700)); }
    return () => timers.forEach(clearTimeout);
  }, [value, active, bump]);
  return (
    <span className={`streak-pill ${active ? 'active' : ''} ${anim ? 'nobi-bump' : ''} ${lit ? 'nobi-ignite' : ''}`} aria-label={`Sequência: ${value} ${unit}${active ? ', feita hoje' : ''}`}>
      <Icon name="flame" size={15} stroke={2.2} className="flame" />
      <span aria-hidden="true">{value} {unit}</span>
    </span>
  );
}

export function Avatar({ user, size = 40, ring, className = '' }) {
  const style = { width: size, height: size, containerType: 'inline-size', background: user?.avatarColor || 'var(--nobi-creme)' };
  const ringClass = ring ? `ring-${ring}` : '';
  let inner = <span style={{ fontSize: '38cqi', lineHeight: 1 }}>{(user?.name || '?').trim().charAt(0).toUpperCase()}</span>;
  if (user?.avatarUrl === 'broto') {
    style.background = 'var(--nobi-brasa)';
    inner = <BrotoHead size={Math.round(size * 0.92)} />;
  } else if (user?.avatarUrl) {
    inner = <img src={user.avatarUrl} alt="" loading="lazy" decoding="async" width={size} height={size} />;
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

// Folha que acabou de fechar: se outra abrir em seguida (ex.: o React montando de novo no
// modo de desenvolvimento), reaproveita a entrada do histórico em vez de voltar e empilhar outra.
let closingSheet = null;

/**
 * Folha destacada das bordas (DESIGN.md 8.3), sobre <dialog> nativo: foco preso e aria-modal.
 * Fecha com X, Esc, arrastando para baixo e com o voltar do celular (cada folha aberta
 * ganha uma entrada no histórico).
 */
export function Sheet({ open, onClose, title, children, labelledBy, routed = false, peek = null, header = null }) {
  const dialogRef = useRef(null);
  const sheetRef = useRef(null);
  const boxRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const drag = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const prev = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    // Voltar do celular / gesto do navegador fecha a folha. Folha com rota própria já tem entrada no histórico.
    let id = Math.random().toString(36).slice(2);
    let closedByBack = false;
    if (!routed) {
      if (closingSheet && window.history.state?.nobiSheet === closingSheet.id) {
        clearTimeout(closingSheet.timer);
        id = closingSheet.id;
      } else {
        window.history.pushState({ ...(window.history.state || {}), nobiSheet: id }, '');
      }
      closingSheet = null;
    }
    const onPop = () => {
      if (routed) return;
      if (window.history.state?.nobiSheet !== id) { closedByBack = true; onCloseRef.current?.(); }
    };
    window.addEventListener('popstate', onPop);
    // Foco na própria folha (sem abrir teclado nem destacar o X); Tab segue para os controles
    requestAnimationFrame(() => sheetRef.current?.focus({ preventScroll: true }));
    return () => {
      window.removeEventListener('popstate', onPop);
      if (dialog?.open) dialog.close();
      if (!routed && !closedByBack && window.history.state?.nobiSheet === id) {
        const timer = setTimeout(() => {
          closingSheet = null;
          if (window.history.state?.nobiSheet === id) window.history.back();
        }, 0);
        closingSheet = { id, timer };
      }
      prev?.focus?.();
    };
  }, [open, routed]);

  if (!open) return null;

  const onPointerDown = (e) => {
    if (e.target.closest('button, input, textarea, select, a')) return;
    drag.current = { y: e.clientY, dy: 0 };
    boxRef.current.style.transition = 'none';
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    boxRef.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const { dy } = drag.current;
    drag.current = null;
    boxRef.current.style.transition = '';
    boxRef.current.style.transform = '';
    if (dy > 110) onCloseRef.current?.();
  };

  return (
    <dialog
      ref={dialogRef}
      className="sheet-dialog"
      aria-label={labelledBy ? undefined : title}
      aria-labelledby={labelledBy}
      onCancel={(e) => { e.preventDefault(); onCloseRef.current?.(); }}
      onMouseDown={(e) => { if (e.target === dialogRef.current) onCloseRef.current?.(); }}
    >
      <div className="sheet-box" ref={boxRef}>
        {peek && <div className="sheet-peek" aria-hidden="true">{peek}</div>}
        <div className="sheet" ref={sheetRef} tabIndex={-1}>
          <div className="sheet-head" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <span className="sheet-grip" aria-hidden="true" />
            {header || (title && (
              <div className="row between gap-12">
                <h2 className="title t-20">{title}</h2>
                <button type="button" className="icon-btn" aria-label="Fechar" onClick={() => onCloseRef.current?.()}><Icon name="close" /></button>
              </div>
            ))}
          </div>
          {children}
        </div>
      </div>
    </dialog>
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

/**
 * Linha de ajuste que abre o seletor nativo do sistema (DESIGN.md 8.3).
 * options: [[valor, texto], ...]. O <select> real fica por cima da linha, invisível.
 */
export function SelectRow({ label, value, options, onChange, hint, chevron = 'down' }) {
  const id = useId();
  const current = options.find(([v]) => String(v) === String(value));
  return (
    <div className="select-row">
      <label htmlFor={id} className="grow stack" style={{ gap: 1 }}>
        <span className="t-15" style={{ fontWeight: 500 }}>{label}</span>
        {hint && <span className="t-13 muted">{hint}</span>}
      </label>
      <span className="t-15 secondary" style={{ fontWeight: 600, whiteSpace: 'nowrap' }} aria-hidden="true">
        {current ? current[1] : value} {chevron === 'down' ? '⌄' : '›'}
      </span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </div>
  );
}

/** Linha com switch, no mesmo grupo das linhas de ajuste. */
export function SwitchRow({ label, hint, checked, onChange, disabled }) {
  return (
    <div className="select-row">
      <span className="grow stack" style={{ gap: 1 }}>
        <span className="t-15" style={{ fontWeight: 500 }}>{label}</span>
        {hint && <span className="t-13 muted">{hint}</span>}
      </span>
      <Toggle checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}
