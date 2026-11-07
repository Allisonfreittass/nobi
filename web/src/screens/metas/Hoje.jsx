import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import Broto from '../../components/Broto.jsx';
import { ErrorNote, Sheet, SelectRow, Skeleton, RingProgress } from '../../components/ui.jsx';
import { TaskRow, ObjectiveCard, RoutineRow, CheckCircle, useTaskToggle, shortDay } from '../../components/metas/parts.jsx';
import { api } from '../../lib/api.js';
import { useLoad } from '../../lib/useLoad.js';
import { useToast } from '../../lib/toast.jsx';
import { goalColor } from '../../lib/format.js';

const MAX = 3;

/** Escolher uma tarefa existente ou criar uma nova como prioridade de hoje. */
function AddPriority({ open, onClose, candidates, goals, onAdded }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [goalId, setGoalId] = useState('');
  const [busy, setBusy] = useState(false);
  const gid = goalId || goals[0]?.id || '';
  async function pick(t) {
    setBusy(true);
    try { await api(`/tasks/${t.id}`, { method: 'PATCH', body: { priority: true } }); onAdded(); onClose(); } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  async function create(e) {
    e.preventDefault();
    if (!title.trim() || !gid) return;
    setBusy(true);
    try { await api(`/tasks/goal/${gid}`, { method: 'POST', body: { title, priority: true } }); setTitle(''); onAdded(); onClose(); } catch (err) { toast(err.message); } finally { setBusy(false); }
  }
  return (
    <Sheet open={open} routed onClose={onClose} title="Prioridade de hoje">
      <form className="stack gap-12" onSubmit={create}>
        <label className="field">Nova tarefa<input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: revisar as telas do feed" /></label>
        {goals.length > 0 && (
          <div className="row-group">
            <SelectRow label="Objetivo" value={gid} onChange={setGoalId} options={goals.map((g) => [g.id, g.title])} />
          </div>
        )}
        <button type="submit" className="btn btn-dark block" disabled={busy || !title.trim() || !gid}>Adicionar</button>
      </form>
      {candidates.length > 0 && (
        <section className="stack gap-6">
          <h3 className="t-14 strong muted">Ou escolha uma tarefa</h3>
          <div className="card flush card-list">
            {candidates.map((t) => (
              <button key={t.id} type="button" className="list-row" onClick={() => pick(t)} disabled={busy}>
                <span style={{ width: 10, height: 10, borderRadius: 4, background: goalColor(t.goal?.color), flexShrink: 0 }} aria-hidden="true" />
                <span className="grow stack" style={{ gap: 1 }}>
                  <span className="t-15" style={{ fontWeight: 500 }}>{t.title}</span>
                  <span className="t-12 muted">{t.goal?.title}{t.dueDate ? ` · ${shortDay(t.dueDate)}` : ''}</span>
                </span>
                <Icon name="plus" size={18} />
              </button>
            ))}
          </div>
        </section>
      )}
    </Sheet>
  );
}

function Priorities({ items, setItems, candidates, goals, reload }) {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const toggle = useTaskToggle((t) => setItems((l) => l.map((x) => (x.id === t.id ? t : x))));
  const open = location.hash === '#prioridade';
  const done = items.filter((t) => t.done).length;
  async function unpick(t) {
    setItems((l) => l.filter((x) => x.id !== t.id));
    try { await api(`/tasks/${t.id}`, { method: 'PATCH', body: { priority: false } }); } catch (e) { toast(e.message); reload(); }
  }
  return (
    <section className="card priorities stack gap-6" aria-label="3 prioridades de hoje">
      <div className="row between">
        <h2 className="title t-18">3 prioridades de hoje</h2>
        <span className="t-13" style={{ opacity: 0.7 }}>{done} de {items.length || MAX}</span>
      </div>
      {items.length === 0 && <p className="t-14" style={{ opacity: 0.75 }}>Escolha até 3 coisas que fariam o dia valer. O resto pode esperar.</p>}
      <div className="stack">
        {items.map((t) => (
          <div key={t.id} className="task-row">
            <CheckCircle light done={t.done} onClick={() => toggle(t)} label={`${t.done ? 'Desfazer' : 'Concluir'} ${t.title}`} />
            <div className="grow stack" style={{ gap: 1, minWidth: 0 }}>
              <span className="t-15" style={{ fontWeight: 600, textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.6 : 1 }}>{t.title}</span>
              <span className="row gap-6 t-12 ellipsis" style={{ opacity: 0.7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: t.goal?.color === '#141218' ? '#8B8594' : t.goal?.color, flexShrink: 0 }} />{t.goal?.title}
              </span>
            </div>
            <button type="button" className="icon-btn plain" aria-label={`Tirar ${t.title} das prioridades`} onClick={() => unpick(t)} style={{ color: 'inherit', opacity: 0.6, width: 36 }}><Icon name="close" size={16} /></button>
          </div>
        ))}
      </div>
      {items.length < MAX && (
        <button type="button" className="btn sm" style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.12)', color: 'inherit' }} onClick={() => navigate('#prioridade')}>
          <Icon name="plus" size={16} /> Adicionar prioridade
        </button>
      )}
      <AddPriority open={open} onClose={() => navigate(-1)} candidates={candidates} goals={goals} onAdded={reload} />
    </section>
  );
}

function Late({ items, setItems }) {
  const toast = useToast();
  async function patch(t, body, msg) {
    setItems((l) => l.filter((x) => x.id !== t.id));
    try { await api(`/tasks/${t.id}`, { method: 'PATCH', body }); toast(msg); } catch (e) { toast(e.message); setItems((l) => [...l, t]); }
  }
  async function remove(t) {
    setItems((l) => l.filter((x) => x.id !== t.id));
    try { await api(`/tasks/${t.id}`, { method: 'DELETE' }); toast('Tarefa removida.'); } catch (e) { toast(e.message); }
  }
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return (
    <section className="stack gap-8" aria-label="Ficou pra trás">
      <div className="section-head"><h2 className="title t-20">Ficou pra trás</h2><span className="t-13 muted">sem pressa, decide aqui</span></div>
      <div className="card late-card stack" style={{ padding: '4px 14px' }}>
        <div className="task-list">
          {items.map((t) => (
            <div key={t.id} className="stack gap-6" style={{ padding: '10px 0' }}>
              <div className="row gap-10">
                <span style={{ width: 10, height: 10, borderRadius: 4, background: goalColor(t.goal?.color), flexShrink: 0 }} aria-hidden="true" />
                <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
                  <span className="t-15" style={{ fontWeight: 500 }}>{t.title}</span>
                  <span className="t-12 muted">{t.goal?.title} · era para {shortDay(t.dueDate)}</span>
                </span>
                <button type="button" className="icon-btn plain" aria-label={`Remover ${t.title}`} onClick={() => remove(t)} style={{ width: 36 }}><Icon name="close" size={16} /></button>
              </div>
              <div className="row gap-8" style={{ paddingLeft: 20 }}>
                <button type="button" className="btn btn-soft sm" onClick={() => patch(t, { dueDate: iso }, 'Foi para hoje.')}>Fazer hoje</button>
                <label className="btn btn-soft sm" style={{ position: 'relative' }}>
                  Reagendar
                  <input type="date" min={iso} aria-label={`Nova data para ${t.title}`} onChange={(e) => e.target.value && patch(t, { dueDate: e.target.value }, `Reagendada para ${shortDay(e.target.value)}.`)}
                    style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer', fontSize: 'var(--nobi-text-lg)' }} />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Hoje({ me }) {
  const navigate = useNavigate();
  const { data, error, loading, reload, setData } = useLoad('/metas?view=hoje');
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (loading && !data) return <><Skeleton height={160} /><Skeleton height={240} /></>;
  if (!data) return null;
  const setPart = (key) => (fn) => setData((d) => ({ ...d, [key]: typeof fn === 'function' ? fn(d[key]) : fn }));
  const updateGoal = (g) => setData((d) => ({ ...d, routine: d.routine.map((x) => (x.id === g.id ? g : x)) }));
  const removeGoal = (id) => setData((d) => ({ ...d, routine: d.routine.filter((x) => x.id !== id), objectives: d.objectives.filter((x) => x.id !== id) }));
  const goalsForTasks = [...data.routine, ...data.objectives].filter((g, i, a) => a.findIndex((x) => x.id === g.id) === i);
  const todays = data.routine.filter((g) => g.status.activeToday || g.kind === 'weekly');
  const doneCount = todays.filter((g) => g.status.periodDone || g.status.doneToday).length;
  const empty = !data.routine.length && !data.objectives.length;

  if (empty) {
    return (
      <div className="card empty">
        <div className="block-brasa" style={{ borderRadius: 24, padding: '16px 24px 6px' }}><Broto size={100} stage={me.stage} golden={me.golden} /></div>
        <h2 className="title t-20">O que você quer construir?</h2>
        <p className="secondary t-14" style={{ maxWidth: 300 }}>Crie um objetivo e ganhe uma sequência só dele. Pode ser pessoal ou com amigos.</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/metas/novo')}>Criar objetivo</button>
      </div>
    );
  }

  return (
    <>
      <Priorities items={data.priorities} setItems={setPart('priorities')} candidates={data.candidates} goals={goalsForTasks} reload={reload} />

      {data.routine.length > 0 && (
        <section className="stack gap-10" aria-label="Rotina">
          <div className="section-head">
            <h2 className="title t-20">Rotina</h2>
            <span className="row gap-8 t-13 muted">
              <RingProgress value={todays.length ? doneCount / todays.length : 0} size={26} thickness={4}><span /></RingProgress>
              {doneCount} de {todays.length} hoje
            </span>
          </div>
          <div className="routine-list">
            {data.routine.map((g, i) => <RoutineRow key={g.id} goal={g} meId={me.id} onChange={updateGoal} onRemoved={removeGoal} last={i === data.routine.length - 1} />)}
          </div>
          <p className="t-12 muted">Cada hábito tem a sua sequência. Dê um horário a ele (em Editar) para entrar na linha do tempo.</p>
        </section>
      )}

      {data.overdue.length > 0 && <Late items={data.overdue} setItems={setPart('overdue')} />}

      {data.objectives.length > 0 && (
        <section className="stack gap-10" aria-label="Objetivos">
          <h2 className="title t-20">Objetivos</h2>
          {data.objectives.map((o) => <ObjectiveCard key={o.id} o={o} meId={me.id} onRemoved={removeGoal} />)}
        </section>
      )}
    </>
  );
}

export { TaskRow };
