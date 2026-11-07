// Checklist de projeto (DESIGN.md 8.2): etapa → subetapa (2 níveis), data, marco,
// reordenar arrastando pela alça, adicionar no fim e "+ subetapa".
import { useEffect, useRef, useState } from 'react';
import { useOpenAchievement } from '../lib/session.jsx';
import Icon from './Icon.jsx';
import { CheckCircle, shortDay } from './metas/parts.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { afterCheckin, invalidateLoad } from '../lib/useLoad.js';

/** Reordenar arrastando pela alça (funciona com dedo e mouse). */
function useSortable(items, setItems, onCommit) {
  const listRef = useRef(null);
  const drag = useRef(null);
  const latest = useRef(items);
  latest.current = items;
  const start = (e, index) => {
    e.preventDefault();
    drag.current = { index, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!drag.current || !listRef.current) return;
    const rows = [...listRef.current.querySelectorAll(':scope > [data-sort]')];
    const target = rows.findIndex((r) => { const b = r.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
    const to = target === -1 ? rows.length - 1 : target;
    if (to !== drag.current.index) {
      const from = drag.current.index;
      setItems((list) => { const next = [...list]; const [it] = next.splice(from, 1); next.splice(to, 0, it); return next; });
      drag.current = { index: to, moved: true };
    }
  };
  const end = () => {
    const moved = drag.current?.moved;
    drag.current = null;
    if (moved) setTimeout(() => onCommit(latest.current), 0); // depois do último render da nova ordem
  };
  return { listRef, handleProps: (index) => ({ onPointerDown: (e) => start(e, index), onPointerMove: move, onPointerUp: end, onPointerCancel: end }) };
}

function DateChip({ value, onChange, label }) {
  return (
    <label className="chip sm" style={{ position: 'relative', gap: 4, boxShadow: value ? undefined : 'inset 0 0 0 1px var(--nobi-border)', color: value ? 'var(--nobi-text)' : 'var(--nobi-text-muted)' }}>
      <Icon name="calendar" size={14} />{value ? shortDay(value) : 'data'}
      <input type="date" value={value || ''} aria-label={label} onChange={(e) => onChange(e.target.value || null)}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer', fontSize: 'var(--nobi-text-lg)' }} />
    </label>
  );
}

function Title({ task, onRename }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(task.title);
  useEffect(() => setV(task.title), [task.title]);
  if (editing) {
    return (
      <input className="inline-title" autoFocus value={v} maxLength={120} aria-label="Nome da etapa"
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { setEditing(false); if (v.trim() && v.trim() !== task.title) onRename(v.trim()); else setV(task.title); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setV(task.title); setEditing(false); } }} />
    );
  }
  return (
    <button type="button" className="inline-title-btn" onClick={() => setEditing(true)} aria-label={`Renomear ${task.title}`}
      style={{ textDecoration: task.done ? 'line-through' : 'none', color: task.done ? 'var(--nobi-text-muted)' : undefined }}>
      {task.title}
    </button>
  );
}

export default function ProjectChecklist({ goal, onGoal }) {
  const toast = useToast();
  const openAchievement = useOpenAchievement();
  const [steps, setSteps] = useState(goal.tasks || []);
  const [newStep, setNewStep] = useState('');
  const [subFor, setSubFor] = useState(null);
  const [newSub, setNewSub] = useState('');
  useEffect(() => setSteps(goal.tasks || []), [goal.tasks]);

  async function refresh() {
    const g = await api(`/goals/${goal.id}`);
    onGoal(g);
    afterCheckin(g);
    invalidateLoad('/metas?view=hoje');
  }
  const run = async (fn) => { try { await fn(); } catch (e) { toast(e.message); await refresh(); } };

  const patch = (task, body) => run(async () => {
    const r = await api(`/tasks/${task.id}`, { method: 'PATCH', body });
    if (r.goal) { onGoal(r.goal); afterCheckin(r.goal); }
    invalidateLoad('/metas?view=hoje', '/metas?view=semana', '/metas?view=mes', '/metas?view=concluidas');
    if (r.celebration) openAchievement({ celebration: r.celebration });
  });
  const toggle = (task) => {
    const flip = (t) => (t.id === task.id ? { ...t, done: !t.done } : { ...t, children: t.children?.map(flip) });
    setSteps((l) => l.map(flip));
    patch(task, { done: !task.done });
  };
  const remove = (task) => run(async () => { await api(`/tasks/${task.id}`, { method: 'DELETE' }); await refresh(); });
  const add = (e) => {
    e.preventDefault();
    if (!newStep.trim()) return;
    const title = newStep;
    setNewStep('');
    run(async () => { await api(`/tasks/goal/${goal.id}`, { method: 'POST', body: { title } }); await refresh(); });
  };
  const addSub = (e, parent) => {
    e.preventDefault();
    if (!newSub.trim()) return;
    const title = newSub;
    setNewSub('');
    run(async () => { await api(`/tasks/goal/${goal.id}`, { method: 'POST', body: { title, parentId: parent.id } }); await refresh(); });
  };
  const commitOrder = (list) => run(() => api('/tasks/reorder', { method: 'POST', body: { ids: list.map((t) => t.id) } }));

  const top = useSortable(steps, setSteps, commitOrder);

  return (
    <section className="card stack gap-8" aria-label="Etapas do projeto">
      <div className="row between">
        <h2 className="title t-18">Etapas do projeto</h2>
        {goal.taskProgress?.total > 0 && <span className="t-13 muted">{goal.taskProgress.done} de {goal.taskProgress.total}</span>}
      </div>
      <ol className="checklist" ref={top.listRef}>
        {steps.map((s, i) => (
          <li key={s.id} data-sort className="stack">
            <div className="checklist-row">
              <button type="button" className="drag-handle" aria-label={`Arrastar ${s.title}`} {...top.handleProps(i)}><Icon name="grip" size={18} /></button>
              <CheckCircle done={s.done} onClick={() => (s.children.length ? toast('Essa etapa fica feita quando todas as subetapas estiverem feitas.') : toggle(s))} label={`${s.done ? 'Desfazer' : 'Concluir'} ${s.title}`} color={goal.color === '#141218' ? 'var(--nobi-goal-ink)' : goal.color} />
              <div className="grow stack" style={{ gap: 4, minWidth: 0 }}>
                <Title task={s} onRename={(title) => patch(s, { title })} />
                <div className="row gap-6 wrap">
                  <DateChip value={s.dueDate} onChange={(d) => patch(s, { dueDate: d })} label={`Data de ${s.title}`} />
                  <button type="button" className="chip sm" aria-pressed={s.isMilestone} onClick={() => patch(s, { isMilestone: !s.isMilestone })}><Icon name="flag" size={14} />Marco</button>
                  <button type="button" className="chip sm" onClick={() => { setSubFor(subFor === s.id ? null : s.id); setNewSub(''); }}><Icon name="plus" size={14} />subetapa</button>
                </div>
              </div>
              <button type="button" className="icon-btn plain" aria-label={`Remover ${s.title}`} onClick={() => remove(s)} style={{ width: 36 }}><Icon name="close" size={16} /></button>
            </div>
            {(s.children.length > 0 || subFor === s.id) && (
              <SubList parent={s} goal={goal} setSteps={setSteps} onToggle={toggle} onPatch={patch} onRemove={remove} commitOrder={commitOrder}
                adding={subFor === s.id} newSub={newSub} setNewSub={setNewSub} onAdd={(e) => addSub(e, s)} />
            )}
          </li>
        ))}
      </ol>
      <form className="row gap-8" onSubmit={add}>
        <label className="grow"><span className="sr-only">Nova etapa</span>
          <input className="input" value={newStep} maxLength={120} onChange={(e) => setNewStep(e.target.value)} placeholder="Adicionar etapa" /></label>
        <button type="submit" className="btn btn-dark sm" disabled={!newStep.trim()}>Adicionar</button>
      </form>
      <p className="t-12 muted">Dois níveis no máximo: etapa e subetapa. Concluir um marco vira comemoração.</p>
    </section>
  );
}

function SubList({ parent, goal, setSteps, onToggle, onPatch, onRemove, commitOrder, adding, newSub, setNewSub, onAdd }) {
  const children = parent.children;
  const setChildren = (fn) => setSteps((l) => l.map((s) => (s.id === parent.id ? { ...s, children: typeof fn === 'function' ? fn(s.children) : fn } : s)));
  const sort = useSortable(children, setChildren, commitOrder);
  return (
    <div className="sublist">
      <ol className="checklist" ref={sort.listRef}>
        {children.map((c, i) => (
          <li key={c.id} data-sort className="checklist-row">
            <button type="button" className="drag-handle" aria-label={`Arrastar ${c.title}`} {...sort.handleProps(i)}><Icon name="grip" size={16} /></button>
            <CheckCircle done={c.done} onClick={() => onToggle(c)} label={`${c.done ? 'Desfazer' : 'Concluir'} ${c.title}`} color={goal.color === '#141218' ? 'var(--nobi-goal-ink)' : goal.color} />
            <div className="grow stack" style={{ gap: 4, minWidth: 0 }}>
              <Title task={c} onRename={(title) => onPatch(c, { title })} />
              <div className="row gap-6"><DateChip value={c.dueDate} onChange={(d) => onPatch(c, { dueDate: d })} label={`Data de ${c.title}`} /></div>
            </div>
            <button type="button" className="icon-btn plain" aria-label={`Remover ${c.title}`} onClick={() => onRemove(c)} style={{ width: 36 }}><Icon name="close" size={16} /></button>
          </li>
        ))}
      </ol>
      {adding && (
        <form className="row gap-8" onSubmit={onAdd} style={{ paddingLeft: 36 }}>
          <label className="grow"><span className="sr-only">Nova subetapa de {parent.title}</span>
            <input className="input" autoFocus value={newSub} maxLength={120} onChange={(e) => setNewSub(e.target.value)} placeholder="Nova subetapa" style={{ minHeight: 44 }} /></label>
          <button type="submit" className="btn btn-soft sm" disabled={!newSub.trim()}>Adicionar</button>
        </form>
      )}
    </div>
  );
}
