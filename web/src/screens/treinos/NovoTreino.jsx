import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { BackButton, Chip, ErrorNote, SelectRow, Skeleton } from '../../components/ui.jsx';
import { useLoad, invalidateLoad } from '../../lib/useLoad.js';
import { api } from '../../lib/api.js';
import { NumField } from './parts.jsx';

const LENGTHS = [12, 24, 36, 48];
const letter = (i) => String.fromCharCode(65 + i);
const blankExercise = () => ({ name: '', sets: 3, reps: '10', load: '' });
const blankDay = (i) => ({ name: `Treino ${letter(i)}`, exercises: [blankExercise()] });

function ExerciseEditor({ ex, index, total, onChange, onRemove, onMove, canRemove }) {
  const set = (k) => (v) => onChange({ ...ex, [k]: v });
  return (
    <div className="exercise-edit stack gap-8">
      <div className="row between gap-8">
        <span className="t-13 strong muted">Exercício {index + 1}</span>
        <span className="row" style={{ gap: 0 }}>
          {total > 1 && <button type="button" className="icon-btn plain" aria-label="Subir exercício" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>}
          {total > 1 && <button type="button" className="icon-btn plain" aria-label="Descer exercício" disabled={index === total - 1} onClick={() => onMove(1)}>↓</button>}
          {canRemove && <button type="button" className="icon-btn plain" aria-label={`Remover ${ex.name || `exercício ${index + 1}`}`} onClick={onRemove}><Icon name="trash" size={18} /></button>}
        </span>
      </div>
      <input className="input" placeholder={index === 0 ? 'Ex.: Supino reto' : 'Nome do exercício'} value={ex.name} maxLength={60}
        aria-label={`Nome do exercício ${index + 1}`} onChange={(e) => set('name')(e.target.value)} />
      <div className="num-row">
        <NumField label="Séries" value={ex.sets} min={1} max={20} onChange={(v) => set('sets')(v === '' ? '' : Math.max(1, Math.min(20, v)))} />
        <label className="num-field">
          <span className="num-field-label">Reps</span>
          <span className="num-field-box"><input value={ex.reps} maxLength={12} placeholder="8-12" onChange={(e) => set('reps')(e.target.value)} onFocus={(e) => e.target.select()} /></span>
        </label>
        <NumField label="Carga" value={ex.load} step={0.5} decimal suffix="kg" onChange={set('load')} />
      </div>
    </div>
  );
}

export default function NovoTreino() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { data: existing, error: loadError } = useLoad(editing ? `/treinos/${id}` : null, { skip: !editing });
  const { data: goals } = useLoad('/goals');
  const linkable = (goals || []).filter((g) => g.kind !== 'project' && !g.shared?.tasks?.length && !g.shared?.endsAt)
    .sort((a, b) => (a.category === 'treino' ? -1 : 0) - (b.category === 'treino' ? -1 : 0));

  const [name, setName] = useState('');
  const [total, setTotal] = useState(36);
  const [goalId, setGoalId] = useState(undefined); // undefined = ainda não escolhido
  const [days, setDays] = useState([blankDay(0)]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(!editing);

  useEffect(() => {
    if (!existing || ready) return;
    setName(existing.name);
    setTotal(existing.totalSessions);
    setGoalId(existing.goal?.id || '');
    setDays(existing.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e, load: e.load || '' })) })));
    setReady(true);
  }, [existing, ready]);

  // Na criação, já liga ao primeiro objetivo de treino (dá para trocar)
  useEffect(() => {
    if (editing || goalId !== undefined || !goals) return;
    setGoalId(linkable.find((g) => g.category === 'treino')?.id || '');
  }, [goals]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDay = (i, d) => setDays((l) => l.map((x, j) => (j === i ? d : x)));
  const removeDay = (i) => { setDays((l) => l.filter((_, j) => j !== i)); setActive((a) => Math.max(0, Math.min(a, days.length - 2))); };
  const addDay = () => { setDays((l) => [...l, blankDay(l.length)]); setActive(days.length); };
  const moveEx = (i, j, dir) => updateDay(i, { ...days[i], exercises: (() => { const l = [...days[i].exercises]; const [it] = l.splice(j, 1); l.splice(j + dir, 0, it); return l; })() });

  const filled = days.some((d) => d.exercises.some((e) => e.name.trim()));
  const canSubmit = name.trim() && total >= 1 && filled && !busy;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        name, totalSessions: Number(total), goalId: goalId || null,
        days: days.map((d) => ({
          key: d.key, name: d.name,
          exercises: d.exercises.filter((e) => e.name.trim()).map((e) => ({ ...e, sets: Number(e.sets) || 1, load: Number(e.load) || 0, reps: String(e.reps || '').trim() || '10' })),
        })),
      };
      const plan = await api(editing ? `/treinos/${id}` : '/treinos', { method: editing ? 'PATCH' : 'POST', body });
      invalidateLoad('/treinos', `/treinos/${plan.id}`, '/treinos/historico');
      navigate(`/treinos/${plan.id}`, { replace: true });
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  if (loadError) return <div className="screen no-nav"><BackButton /><ErrorNote error={loadError} /></div>;
  if (!ready) return <div className="screen no-nav"><Skeleton height={60} /><Skeleton height={240} /></div>;

  return (
    <div className="screen no-nav">
      <header className="screen-head">
        <BackButton />
        <h1 className="title t-20">{editing ? 'Editar treino' : 'Novo treino'}</h1>
        <span style={{ width: 44 }} />
      </header>

      <section className="stack gap-10">
        <label className="field">
          Nome do treino
          <input className="input" value={name} maxLength={60} placeholder="Ex.: Hipertrofia ABC" onChange={(e) => setName(e.target.value)} />
        </label>
      </section>

      <section className="stack gap-10">
        <h2 className="t-15 strong">Quantos treinos ele dura?</h2>
        <div className="row gap-8 wrap">
          {LENGTHS.map((n) => <Chip key={n} on={Number(total) === n} onClick={() => setTotal(n)}>{n} treinos</Chip>)}
          <span className="num-inline">
            <NumField label="Outro" value={total} min={1} max={365} onChange={(v) => setTotal(v === '' ? '' : Math.max(1, Math.min(365, v)))} />
          </span>
        </div>
        <p className="t-13 muted">Conta treinos feitos, não dias no calendário: se faltar um dia, o programa espera por você.</p>
      </section>

      {linkable.length > 0 && (
        <section className="card flush card-list">
          <SelectRow label="Contar no objetivo" hint="Concluir o treino faz o check-in dele" value={goalId || ''}
            options={[['', 'Nenhum'], ...linkable.map((g) => [g.id, g.title])]} onChange={setGoalId} />
        </section>
      )}

      <section className="stack gap-10" aria-label="Divisões">
        <div className="section-head"><h2 className="t-15 strong">Divisões</h2><span className="t-13 muted">{days.length} de 7</span></div>
        <div className="chips day-chips" role="group" aria-label="Escolha a divisão para editar">
          {days.map((d, i) => (
            <button key={d.key || i} type="button" className="chip" aria-pressed={i === active} onClick={() => setActive(i)}>
              <span className="ellipsis">{d.name || `Treino ${letter(i)}`}</span>
              <span className="t-12 muted">{d.exercises.filter((e) => e.name.trim()).length}</span>
            </button>
          ))}
          {days.length < 7 && <button type="button" className="chip" onClick={addDay}><Icon name="plus" size={14} /> Divisão</button>}
        </div>
        {(() => {
          const i = Math.min(active, days.length - 1);
          const d = days[i];
          return (
            <section className="card stack gap-12" aria-label={d.name}>
              <div className="row gap-8">
                <input className="inline-title grow" value={d.name} maxLength={40} aria-label="Nome da divisão"
                  onChange={(e) => updateDay(i, { ...d, name: e.target.value })} />
                {days.length > 1 && <button type="button" className="icon-btn plain" aria-label={`Remover ${d.name}`} onClick={() => removeDay(i)}><Icon name="trash" size={18} /></button>}
              </div>
              {d.exercises.map((ex, j) => (
                <ExerciseEditor key={ex.key || `${i}-${j}`} ex={ex} index={j} total={d.exercises.length} canRemove={d.exercises.length > 1}
                  onChange={(next) => updateDay(i, { ...d, exercises: d.exercises.map((x, k) => (k === j ? next : x)) })}
                  onMove={(dir) => moveEx(i, j, dir)}
                  onRemove={() => updateDay(i, { ...d, exercises: d.exercises.filter((_, k) => k !== j) })} />
              ))}
              {d.exercises.length < 20 && (
                <button type="button" className="btn btn-soft sm" style={{ alignSelf: 'flex-start' }} onClick={() => updateDay(i, { ...d, exercises: [...d.exercises, blankExercise()] })}>
                  <Icon name="plus" size={17} /> Exercício
                </button>
              )}
            </section>
          );
        })()}
      </section>

      <ErrorNote error={error} />
      <button type="button" className="btn btn-primary lg block" disabled={!canSubmit} onClick={submit}>
        {busy ? 'Salvando…' : editing ? 'Salvar treino' : 'Criar treino'}
      </button>
    </div>
  );
}
