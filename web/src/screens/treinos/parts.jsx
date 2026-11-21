import Icon from '../../components/Icon.jsx';

/** 42,5 kg · 1.250 kg. Zero vira "peso do corpo". */
export function kg(n) {
  if (!n) return 'peso do corpo';
  return `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
}
export const kgShort = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
export const volume = (n) => `${Math.round(n || 0).toLocaleString('pt-BR')} kg`;

/** "12 de 36 treinos" */
export const progressText = (p) => `${p.done} de ${p.total} ${p.total === 1 ? 'treino' : 'treinos'}`;

/** Resumo de um exercício planejado: 3 × 10 · 40 kg */
export const plannedText = (ex) => `${ex.sets} × ${ex.reps}${ex.load ? ` · ${kg(ex.load)}` : ''}`;

/** Resumo das séries feitas: 10 · 10 · 8 com 40 kg (ou cargas diferentes por série). */
export function setsText(sets) {
  const done = (sets || []).filter((s) => s.done !== false && s.reps > 0);
  if (!done.length) return 'sem séries feitas';
  const loads = [...new Set(done.map((s) => s.load))];
  if (loads.length === 1) return `${done.map((s) => s.reps).join(' · ')} com ${kg(loads[0])}`;
  return done.map((s) => `${s.reps}×${kgShort(s.load)}`).join(' · ');
}

/** Mesmo nome que o servidor usa para casar o exercício entre programas. */
export const exerciseSlug = (name) => String(name || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Diferença de carga, sem vermelho: subir é verde, igual ou menos fica neutro (DESIGN.md §8, regra 5). */
export function Delta({ from, to }) {
  const d = Math.round(((to || 0) - (from || 0)) * 10) / 10;
  if (!d) return <span className="t-13 muted">igual</span>;
  return (
    <span className={`t-13 strong ${d > 0 ? 'delta-up' : 'secondary'}`}>
      {d > 0 ? '+' : '−'}{kgShort(Math.abs(d))} kg
    </span>
  );
}

/** Campo numérico compacto para séries, repetições e carga. */
export function NumField({ label, value, onChange, step = 1, min = 0, max = 2000, suffix, decimal = false }) {
  return (
    <label className="num-field">
      <span className="num-field-label">{label}</span>
      <span className="num-field-box">
        <input
          type="number" inputMode={decimal ? 'decimal' : 'numeric'} step={step} min={min} max={max}
          value={value === '' || value == null ? '' : value}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          onFocus={(e) => e.target.select()}
        />
        {suffix && <span aria-hidden="true">{suffix}</span>}
      </span>
    </label>
  );
}

export function EmptyTreinos({ onCreate }) {
  return (
    <section className="card empty">
      <span className="broto-plate round plan-plate" style={{ width: 72, height: 72 }}><Icon name="dumbbell" size={34} /></span>
      <h2 className="title t-20">Monte seu primeiro treino</h2>
      <p className="t-14 secondary" style={{ maxWidth: 320 }}>
        Dê um nome, diga quantos treinos ele dura e cadastre as divisões com exercícios, séries e carga. Cada treino feito avança o progresso.
      </p>
      <button type="button" className="btn btn-dark" onClick={onCreate}><Icon name="plus" size={18} /> Criar treino</button>
    </section>
  );
}
