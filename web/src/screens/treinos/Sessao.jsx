import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { BackButton, ErrorNote, Segmented, Skeleton } from '../../components/ui.jsx';
import { CheckCircle } from '../../components/metas/parts.jsx';
import { useLoad, invalidateLoad } from '../../lib/useLoad.js';
import { api } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { useConfirm } from '../../lib/confirm.jsx';
import { useCheckin } from '../../lib/useCheckin.js';
import { NumField, exerciseSlug, kg, setsText } from './parts.jsx';

const firstInt = (reps) => parseInt(String(reps), 10) || 0;

/**
 * Séries de hoje a partir do planejado, usando o que foi feito na última vez como sugestão
 * (mesmas repetições e carga). Nada vem marcado: quem treina confirma cada série.
 */
function startSets(planned, last) {
  const prev = last?.sets || [];
  return Array.from({ length: planned.sets }, (_, i) => {
    const p = prev[i] || prev.at(-1);
    return { reps: p ? p.reps : firstInt(planned.reps), load: p ? p.load : planned.load || 0, done: false };
  });
}

function fromDay(day, last) {
  return day.exercises.map((ex) => ({
    key: ex.key, name: ex.name, planned: ex,
    last: last[`k:${ex.key}`] || last[`n:${exerciseSlug(ex.name)}`] || null,
    sets: startSets(ex, last[`k:${ex.key}`] || last[`n:${exerciseSlug(ex.name)}`]),
  }));
}

function ExerciseLog({ ex, onChange, onRemove }) {
  const setSet = (i, patch) => onChange({
    ...ex,
    sets: ex.sets.map((s, j) => {
      if (j === i) return { ...s, ...patch };
      if (j < i || s.done || patch.done !== undefined) return s;
      // Subiu a carga na 1ª série? As próximas que estavam iguais acompanham
      const next = { ...s };
      for (const k of ['reps', 'load']) if (k in patch && s[k] === ex.sets[i][k]) next[k] = patch[k];
      return next;
    }),
  });
  const doneCount = ex.sets.filter((s) => s.done).length;
  return (
    <section className="card stack gap-10" aria-label={ex.name}>
      <div className="row between gap-8">
        <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          {ex.planned ? <h2 className="title t-18 ellipsis">{ex.name}</h2> : (
            <input className="inline-title" value={ex.name} placeholder="Nome do exercício" maxLength={60} aria-label="Nome do exercício extra"
              onChange={(e) => onChange({ ...ex, name: e.target.value })} />
          )}
          <span className="t-13 muted">
            {ex.last ? `Última vez: ${setsText(ex.last.sets)}` : ex.planned ? `Planejado: ${ex.planned.sets} × ${ex.planned.reps}${ex.planned.load ? ` · ${kg(ex.planned.load)}` : ''}` : 'Exercício extra'}
          </span>
        </div>
        <span className="t-13 strong secondary" aria-label={`${doneCount} de ${ex.sets.length} séries feitas`}>{doneCount}/{ex.sets.length}</span>
        {!ex.planned && <button type="button" className="icon-btn plain" aria-label="Remover exercício extra" onClick={onRemove}><Icon name="trash" size={18} /></button>}
      </div>
      <ol className="set-list">
        {ex.sets.map((s, i) => (
          <li key={i} className={`set-row ${s.done ? 'done' : ''}`}>
            <span className="set-index" aria-hidden="true">{i + 1}</span>
            <NumField label="Reps" value={s.reps} max={1000} onChange={(v) => setSet(i, { reps: v })} />
            <NumField label="Carga" value={s.load} step={0.5} decimal suffix="kg" onChange={(v) => setSet(i, { load: v })} />
            <CheckCircle done={s.done} label={`Série ${i + 1} ${s.done ? 'feita' : 'não feita'}`} onClick={() => setSet(i, { done: !s.done })} />
          </li>
        ))}
      </ol>
      <div className="row gap-8">
        <button type="button" className="btn btn-soft sm" disabled={ex.sets.length >= 20}
          onClick={() => onChange({ ...ex, sets: [...ex.sets, { ...(ex.sets.at(-1) || { reps: 10, load: 0 }), done: false }] })}>
          <Icon name="plus" size={16} /> Série
        </button>
        {ex.sets.length > 1 && (
          <button type="button" className="btn btn-ghost sm" onClick={() => onChange({ ...ex, sets: ex.sets.slice(0, -1) })}><Icon name="minus" size={16} /> Série</button>
        )}
      </div>
    </section>
  );
}

export default function Sessao() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { checkin } = useCheckin();
  const { data: plan, error, reload } = useLoad(`/treinos/${id}`);
  const today = plan?.todaySessionId ? plan.sessions.find((s) => s.id === plan.todaySessionId) : null;
  // Já treinou hoje: a sessão do dia é uma só, então só dá para ajustar a divisão que foi feita
  const dayKey = today?.dayKey || params.get('dia') || plan?.next?.key || plan?.days?.[0]?.key;
  const day = plan?.days.find((d) => d.key === dayKey) || plan?.days?.[0];

  const [exercises, setExercises] = useState(null);
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Monta as séries quando a divisão muda. Treino de hoje já salvo: volta como estava.
  const startKey = plan && day ? `${plan.id}:${day.key}` : null;
  useEffect(() => {
    if (!startKey) return;
    const base = fromDay(day, plan.last || {});
    if (today && today.dayKey === day.key) {
      const saved = today.exercises.map((e) => {
        const b = base.find((x) => (e.key && x.key === e.key) || exerciseSlug(x.name) === exerciseSlug(e.name));
        return { ...(b || { key: '', planned: null, last: null }), name: e.name, sets: e.sets.map((s) => ({ ...s })) };
      });
      const missing = base.filter((b) => !saved.some((s) => s.key && s.key === b.key));
      setExercises([...saved, ...missing]);
      setMinutes(today.minutes || '');
      setNote(today.note || '');
    } else {
      setExercises(base);
    }
  }, [startKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    const all = (exercises || []).flatMap((e) => e.sets);
    const done = all.filter((s) => s.done && s.reps > 0);
    return { sets: all.length, done: done.length, volume: done.reduce((t, s) => t + (s.reps || 0) * (s.load || 0), 0) };
  }, [exercises]);

  if (error) return <div className="screen no-nav"><BackButton /><ErrorNote error={error} onRetry={reload} /></div>;
  if (!plan || !exercises) return <div className="screen no-nav"><Skeleton height={60} /><Skeleton height={200} /><Skeleton height={200} /></div>;

  async function save() {
    let list = exercises;
    if (!totals.done) {
      const ok = await confirm({ title: 'Marcar todas as séries como feitas?', message: 'Nenhuma série foi marcada. Dá para salvar com tudo feito, do jeito que está preenchido.', confirmLabel: 'Marcar e salvar' });
      if (!ok) return;
      list = exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: true })) }));
      setExercises(list);
    }
    setBusy(true);
    setSaveError(null);
    try {
      const r = await api(`/treinos/${id}/sessoes`, {
        method: 'POST',
        body: {
          dayKey: day.key, minutes: Number(minutes) || 0, note,
          exercises: list.filter((e) => e.name.trim()).map((e) => ({ key: e.key, name: e.name, sets: e.sets.map((s) => ({ reps: Number(s.reps) || 0, load: Number(s.load) || 0, done: s.done })) })),
        },
      });
      invalidateLoad('/treinos', `/treinos/${id}`, '/treinos/historico', '/treinos/exercicios');
      navigate(`/treinos/${id}`, { replace: true });
      const p = r.plan.progress;
      if (r.finishedNow) toast(`Programa concluído: ${p.total} treinos! Arquive para guardar no histórico.`);
      else if (!r.firstToday) toast('Treino de hoje atualizado.');
      else if (!r.plan.goal) toast(`Treino ${p.done} de ${p.total} feito!`);
      // Primeiro treino do dia num programa ligado a um objetivo: faz o check-in (sequência, XP, Broto)
      if (r.firstToday && r.plan.goal) {
        try {
          const goal = await api(`/goals/${r.plan.goal.id}`);
          if (!goal.status.doneToday) {
            await checkin(goal, goal.kind === 'count' ? { value: 1 } : goal.target?.unit === 'min' ? { minutes: Number(minutes) || goal.status.need } : { minutes: Number(minutes) || 0 });
          } else if (!r.finishedNow) toast(`Treino ${p.done} de ${p.total} feito!`);
        } catch {
          toast(`Treino ${p.done} de ${p.total} salvo. O check-in em “${r.plan.goal.title}” não deu certo: registre por lá.`);
        }
      }
    } catch (e) {
      setSaveError(e);
      setBusy(false);
    }
  }

  return (
    <div className="screen no-nav">
      <header className="screen-head">
        <BackButton />
        <div className="stack center" style={{ gap: 0, minWidth: 0 }}>
          <span className="t-13 secondary ellipsis">{plan.name}</span>
          <h1 className="title t-20">{today ? 'Treino de hoje' : `Treino ${plan.progress.done + 1} de ${plan.totalSessions}`}</h1>
        </div>
        <span style={{ width: 44 }} />
      </header>

      {plan.days.length > 1 && !today && (
        <Segmented label="Divisão" value={day.key} options={plan.days.map((d) => [d.key, d.name])}
          onChange={(k) => setParams({ dia: k }, { replace: true })} />
      )}

      {exercises.map((ex, i) => (
        <ExerciseLog key={`${ex.key}-${i}`} ex={ex}
          onChange={(next) => setExercises((l) => l.map((x, j) => (j === i ? next : x)))}
          onRemove={() => setExercises((l) => l.filter((_, j) => j !== i))} />
      ))}
      <button type="button" className="btn btn-outline" onClick={() => setExercises((l) => [...l, { key: '', name: '', planned: null, last: null, sets: [{ reps: 10, load: 0, done: false }] }])}>
        <Icon name="plus" size={18} /> Exercício extra
      </button>

      <section className="card stack gap-12">
        <div className="num-row">
          <NumField label="Duração" value={minutes} max={600} suffix="min" onChange={setMinutes} />
          <div className="stack" style={{ gap: 2 }}>
            <span className="num-field-label">Volume</span>
            <span className="num t-22">{Math.round(totals.volume).toLocaleString('pt-BR')} <span className="t-13 secondary">kg</span></span>
          </div>
          <div className="stack" style={{ gap: 2 }}>
            <span className="num-field-label">Séries</span>
            <span className="num t-22">{totals.done}<span className="t-13 secondary">/{totals.sets}</span></span>
          </div>
        </div>
        <label className="field">
          Nota
          <textarea className="textarea" rows={2} maxLength={280} value={note} placeholder="Como foi? (opcional)" onChange={(e) => setNote(e.target.value)} />
        </label>
      </section>

      <ErrorNote error={saveError} />
      <button type="button" className="btn btn-primary lg block" disabled={busy} onClick={save}>
        {busy ? 'Salvando…' : today ? 'Salvar alterações' : 'Concluir treino'}
      </button>
    </div>
  );
}
