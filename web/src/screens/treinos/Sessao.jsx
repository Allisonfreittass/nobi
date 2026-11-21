import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { BackButton, ErrorNote, Skeleton } from '../../components/ui.jsx';
import { useLoad, invalidateLoad } from '../../lib/useLoad.js';
import { api, localNow } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { useConfirm } from '../../lib/confirm.jsx';
import { useCheckin } from '../../lib/useCheckin.js';
import { exerciseSlug, kg, kgShort, setsText } from './parts.jsx';

const firstInt = (reps) => parseInt(String(reps), 10) || 0;
const isDone = (ex) => ex.sets.length > 0 && ex.sets.every((s) => s.done);

// Rascunho do treino em andamento: o celular pode fechar o app no meio da academia
const draftKey = (planId) => `nobi.treino.rascunho.${planId}`;
function readDraft(planId) {
  try { return JSON.parse(localStorage.getItem(draftKey(planId)) || 'null'); } catch { return null; }
}
function writeDraft(planId, draft) {
  try { localStorage.setItem(draftKey(planId), JSON.stringify(draft)); } catch { /* sem storage */ }
}
function clearDraft(planId) {
  try { localStorage.removeItem(draftKey(planId)); } catch { /* sem storage */ }
}

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
  return day.exercises.map((ex) => {
    const prev = last[`k:${ex.key}`] || last[`n:${exerciseSlug(ex.name)}`] || null;
    return { key: ex.key, name: ex.name, planned: ex, last: prev, sets: startSets(ex, prev) };
  });
}

function summary(ex) {
  const done = ex.sets.filter((s) => s.done);
  if (done.length) {
    const top = Math.max(...done.map((s) => Number(s.load) || 0));
    return `${done.length} de ${ex.sets.length} séries · ${top ? kg(top) : 'peso do corpo'}`;
  }
  const load = ex.sets[0]?.load;
  return `${ex.sets.length} × ${ex.sets[0]?.reps ?? ex.planned?.reps ?? '–'}${load ? ` · ${kg(load)}` : ''}`;
}

/** Campo numérico de uma série, sem rótulo visível (o cabeçalho da tabela nomeia a coluna). */
function SetInput({ value, onChange, label, decimal, suffix }) {
  return (
    <span className="set-input">
      <input
        type="number" inputMode={decimal ? 'decimal' : 'numeric'} step={decimal ? 0.5 : 1} min={0} max={decimal ? 2000 : 1000}
        aria-label={label} value={value === '' || value == null ? '' : value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        onFocus={(e) => e.target.select()}
      />
      {suffix && <span aria-hidden="true">{suffix}</span>}
    </span>
  );
}

function ExerciseItem({ ex, index, open, onToggle, onChange, onRemove }) {
  const doneCount = ex.sets.filter((s) => s.done).length;
  const complete = isDone(ex);
  // Mudar reps/carga de uma série leva o valor para as próximas ainda não feitas que estavam iguais
  const setSet = (i, patch) => onChange({
    ...ex,
    sets: ex.sets.map((s, j) => {
      if (j === i) return { ...s, ...patch };
      if (j < i || s.done || patch.done !== undefined) return s;
      const next = { ...s };
      for (const k of ['reps', 'load']) if (k in patch && s[k] === ex.sets[i][k]) next[k] = patch[k];
      return next;
    }),
  }, patch.done === true && i === ex.sets.length - 1);
  const bump = (d) => onChange({ ...ex, sets: ex.sets.map((s) => (s.done ? s : { ...s, load: Math.max(0, (Number(s.load) || 0) + d) })) });
  const title = ex.name || 'Exercício extra';

  return (
    <li className={`ex-item ${open ? 'open' : ''} ${complete ? 'complete' : ''}`} data-ex={index}>
      <button type="button" className="ex-head" aria-expanded={open} onClick={onToggle}>
        <span className="ex-badge" aria-hidden="true">{complete ? <Icon name="check" size={16} stroke={2.8} /> : index + 1}</span>
        <span className="ex-title">
          <span className="ex-name">{title}</span>
          <span className="ex-sub">{summary(ex)}</span>
        </span>
        <span className="sr-only">{complete ? 'concluído' : `${doneCount} de ${ex.sets.length} séries feitas`}</span>
        <Icon name="chevron" size={18} className="ex-chevron" />
      </button>

      {open && (
        <div className="ex-body">
          {!ex.planned && (
            <input className="input" value={ex.name} placeholder="Nome do exercício" maxLength={60} aria-label="Nome do exercício extra"
              onChange={(e) => onChange({ ...ex, name: e.target.value })} />
          )}
          {ex.last && <p className="t-13 muted">Última vez ({ex.last.date.split('-').reverse().slice(0, 2).join('/')}): {setsText(ex.last.sets)}</p>}
          <div className="set-table" role="table" aria-label={`Séries de ${title}`}>
            <div className="set-line set-header" role="row">
              <span role="columnheader">Série</span>
              <span role="columnheader">Reps</span>
              <span role="columnheader">Carga</span>
              <span role="columnheader"><span className="sr-only">Feita</span></span>
            </div>
            {ex.sets.map((s, i) => (
              <div key={i} className={`set-line ${s.done ? 'done' : ''}`} role="row">
                <span className="set-n" role="cell">{i + 1}</span>
                <span role="cell"><SetInput label={`Repetições da série ${i + 1}`} value={s.reps} onChange={(v) => setSet(i, { reps: v })} /></span>
                <span role="cell"><SetInput label={`Carga da série ${i + 1} em kg`} value={s.load} decimal suffix="kg" onChange={(v) => setSet(i, { load: v })} /></span>
                <span role="cell">
                  <button type="button" className={`set-check ${s.done ? 'on' : ''}`} aria-pressed={s.done} aria-label={`Série ${i + 1} feita`}
                    onClick={() => setSet(i, { done: !s.done })}>
                    <Icon name="check" size={18} stroke={2.8} />
                  </button>
                </span>
              </div>
            ))}
          </div>
          <div className="row gap-8 wrap">
            <button type="button" className="chip sm" disabled={ex.sets.length >= 20}
              onClick={() => onChange({ ...ex, sets: [...ex.sets, { ...(ex.sets.at(-1) || { reps: 10, load: 0 }), done: false }] })}>
              <Icon name="plus" size={14} /> Série
            </button>
            {ex.sets.length > 1 && !ex.sets.at(-1).done && (
              <button type="button" className="chip sm" onClick={() => onChange({ ...ex, sets: ex.sets.slice(0, -1) })}><Icon name="minus" size={14} /> Série</button>
            )}
            {ex.sets.some((s) => !s.done) && (
              <button type="button" className="chip sm" onClick={() => bump(2.5)}>+2,5 kg nas próximas</button>
            )}
            {!ex.planned && <button type="button" className="chip sm" onClick={onRemove}><Icon name="trash" size={14} /> Remover</button>}
          </div>
        </div>
      )}
    </li>
  );
}

function useElapsed(start) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.round((now - start) / 60000));
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
  const [openIdx, setOpenIdx] = useState(0);
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [start, setStart] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const elapsed = useElapsed(start);
  const restored = useRef(false);

  // Monta as séries quando a divisão muda. Prioridade: rascunho de hoje → treino de hoje já salvo → planejado.
  const startKey = plan && day ? `${plan.id}:${day.key}` : null;
  useEffect(() => {
    if (!startKey) return;
    const base = fromDay(day, plan.last || {});
    const draft = readDraft(plan.id);
    let list = base;
    if (draft && draft.date === localNow().date && draft.dayKey === day.key && Array.isArray(draft.exercises)) {
      list = draft.exercises;
      setNote(draft.note || '');
      setMinutes(draft.minutes ?? '');
      if (draft.start) setStart(draft.start);
      if (!restored.current) toast('Continuando o treino de onde parou.');
    } else if (today && today.dayKey === day.key) {
      const saved = today.exercises.map((e) => {
        const b = base.find((x) => (e.key && x.key === e.key) || exerciseSlug(x.name) === exerciseSlug(e.name));
        return { ...(b || { key: '', planned: null, last: null }), name: e.name, sets: e.sets.map((s) => ({ ...s })) };
      });
      list = [...saved, ...base.filter((b) => !saved.some((s) => s.key && s.key === b.key))];
      setMinutes(today.minutes || '');
      setNote(today.note || '');
    } else {
      setStart(Date.now());
    }
    restored.current = true;
    setExercises(list);
    const firstOpen = list.findIndex((e) => !isDone(e));
    setOpenIdx(firstOpen === -1 ? -1 : firstOpen);
  }, [startKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guarda o rascunho a cada mudança
  useEffect(() => {
    if (!exercises || !plan || !day) return;
    if (!exercises.some((e) => e.sets.some((s) => s.done)) && !note) return;
    writeDraft(plan.id, { date: localNow().date, dayKey: day.key, exercises, note, minutes, start });
  }, [exercises, note, minutes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Exercício que abriu (pelo toque ou pelo avanço automático) fica à vista, abaixo do topo fixo
  useEffect(() => {
    if (openIdx < 0) return;
    const el = document.querySelector(`[data-ex="${openIdx}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 140 || r.top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [openIdx]);

  const totals = useMemo(() => {
    const all = (exercises || []).flatMap((e) => e.sets);
    const done = all.filter((s) => s.done && s.reps > 0);
    return { sets: all.length, done: done.length, volume: done.reduce((t, s) => t + (s.reps || 0) * (s.load || 0), 0) };
  }, [exercises]);

  if (error) return <div className="screen no-nav"><BackButton /><ErrorNote error={error} onRetry={reload} /></div>;
  if (!plan || !exercises) return <div className="screen no-nav"><Skeleton height={60} /><Skeleton height={72} /><Skeleton height={72} /><Skeleton height={72} /></div>;

  const update = (i, next, finishedLast) => {
    const list = exercises.map((x, j) => (j === i ? next : x));
    setExercises(list);
    // Fechou a última série do exercício: abre o próximo que falta (a ordem é sua, isso é só um atalho)
    if (finishedLast && isDone(next)) {
      const after = [...list.keys()].slice(i + 1).concat([...list.keys()].slice(0, i)).find((j) => !isDone(list[j]));
      setOpenIdx(after ?? -1);
    }
  };

  async function save() {
    let list = exercises;
    if (!totals.done) {
      const ok = await confirm({ title: 'Marcar todas as séries como feitas?', message: 'Nenhuma série foi marcada. Dá para salvar com tudo feito, do jeito que está preenchido.', confirmLabel: 'Marcar e salvar' });
      if (!ok) return;
      list = exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: true })) }));
      setExercises(list);
    }
    const mins = minutes === '' ? (today ? today.minutes : elapsed) : Number(minutes) || 0;
    setBusy(true);
    setSaveError(null);
    try {
      const r = await api(`/treinos/${id}/sessoes`, {
        method: 'POST',
        body: {
          dayKey: day.key, minutes: mins, note,
          exercises: list.filter((e) => e.name.trim()).map((e) => ({ key: e.key, name: e.name, sets: e.sets.map((s) => ({ reps: Number(s.reps) || 0, load: Number(s.load) || 0, done: s.done })) })),
        },
      });
      clearDraft(plan.id);
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
            await checkin(goal, goal.kind === 'count' ? { value: 1 } : goal.target?.unit === 'min' ? { minutes: mins || goal.status.need } : { minutes: mins });
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

  async function discard() {
    if (!(await confirm({ title: 'Descartar o que foi marcado?', message: 'As séries voltam ao planejado. O que já foi salvo hoje continua.', confirmLabel: 'Descartar', danger: true }))) return;
    clearDraft(plan.id);
    setNote('');
    setMinutes('');
    setExercises(fromDay(day, plan.last || {}));
    setOpenIdx(0);
    setStart(Date.now());
  }

  const exDone = exercises.filter(isDone).length;
  const pct = totals.sets ? totals.done / totals.sets : 0;

  return (
    <div className="screen no-nav session-screen">
      <header className="session-top">
        <div className="session-top-row">
          <BackButton />
          <div className="session-title">
            <span className="t-12 secondary ellipsis">{plan.name}</span>
            <h1 className="title t-18 ellipsis">{day.name}{today ? ' · hoje' : ` · ${plan.progress.done + 1}º de ${plan.totalSessions}`}</h1>
          </div>
          <span className="session-timer" aria-label={`${today ? today.minutes : elapsed} minutos de treino`}>
            <Icon name="timer" size={15} /> {today && minutes === '' ? today.minutes : elapsed} min
          </span>
        </div>
        <div className="session-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label="Séries feitas">
          <span style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
        <p className="t-12 muted session-count">{exDone} de {exercises.length} exercícios · {totals.done} de {totals.sets} séries</p>
      </header>

      {plan.days.length > 1 && !today && (
        <div className="chips day-chips" role="group" aria-label="Divisão de hoje">
          {plan.days.map((d) => (
            <button key={d.key} type="button" className="chip" aria-pressed={d.key === day.key} onClick={() => setParams({ dia: d.key }, { replace: true })}>
              <span className="ellipsis">{d.name}</span>
            </button>
          ))}
        </div>
      )}

      <p className="t-13 muted">Toque num exercício para abrir. Faça na ordem que quiser.</p>
      <ol className="ex-list">
        {exercises.map((ex, i) => (
          <ExerciseItem key={`${ex.key}-${i}`} ex={ex} index={i} open={openIdx === i}
            onToggle={() => setOpenIdx((o) => (o === i ? -1 : i))}
            onChange={(next, finishedLast) => update(i, next, finishedLast)}
            onRemove={() => { setExercises((l) => l.filter((_, j) => j !== i)); setOpenIdx(-1); }} />
        ))}
      </ol>
      <button type="button" className="btn btn-outline" onClick={() => {
        setExercises((l) => [...l, { key: '', name: '', planned: null, last: null, sets: [{ reps: 10, load: 0, done: false }] }]);
        setOpenIdx(exercises.length);
      }}>
        <Icon name="plus" size={18} /> Exercício extra
      </button>

      <section className="card stack gap-12" aria-label="Fechamento">
        <div className="row gap-12">
          <label className="field grow">
            Duração (min)
            <input className="input" type="number" inputMode="numeric" min={0} max={600} value={minutes} placeholder={String(today ? today.minutes : elapsed)}
              onChange={(e) => setMinutes(e.target.value === '' ? '' : Math.max(0, Math.min(600, Number(e.target.value))))} />
          </label>
          <div className="stack" style={{ gap: 2, minWidth: 96 }}>
            <span className="t-14 strong">Volume</span>
            <span className="num t-22">{kgShort(Math.round(totals.volume))} <span className="t-13 secondary">kg</span></span>
          </div>
        </div>
        <label className="field">
          Nota
          <textarea className="textarea" rows={2} maxLength={280} value={note} placeholder="Como foi? (opcional)" onChange={(e) => setNote(e.target.value)} />
        </label>
        {exercises.some((e) => e.sets.some((s) => s.done)) && !today && (
          <button type="button" className="btn btn-ghost sm" style={{ alignSelf: 'flex-start' }} onClick={discard}>Descartar e recomeçar</button>
        )}
      </section>

      <ErrorNote error={saveError} />
      <div className="session-bottom">
        <button type="button" className="btn btn-primary lg block" disabled={busy} onClick={save}>
          {busy ? 'Salvando…' : today ? 'Salvar alterações' : totals.done && totals.done === totals.sets ? 'Concluir treino' : `Concluir treino · ${totals.done}/${totals.sets} séries`}
        </button>
      </div>
    </div>
  );
}
