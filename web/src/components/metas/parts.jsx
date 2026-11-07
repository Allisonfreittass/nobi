// Peças da aba Metas (DESIGN.md 8.1): linha de tarefa, card de objetivo com ritmo, linha da rotina.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../Icon.jsx';
import { ProgressBar, StreakPill } from '../ui.jsx';
import GoalActions from '../GoalActions.jsx';
import { actionFor, valueLine } from '../GoalCard.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { useCheckin } from '../../lib/useCheckin.js';
import { afterCheckin, invalidateLoad } from '../../lib/useLoad.js';
import { CATEGORIES, goalColor, unitShort } from '../../lib/format.js';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const shortDay = (iso) => (iso ? `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}` : '');

/** Concluir/desfazer uma tarefa. Marco concluído abre a Conquista. */
export function useTaskToggle(onChange) {
  const toast = useToast();
  const navigate = useNavigate();
  return async (task) => {
    const next = { ...task, done: !task.done };
    onChange?.(next);
    try {
      const r = await api(`/tasks/${task.id}`, { method: 'PATCH', body: { done: next.done } });
      if (r.goal) afterCheckin(r.goal);
      invalidateLoad('/metas?view=semana', '/metas?view=mes', '/metas?view=concluidas');
      if (r.celebration) navigate('/conquista', { state: { celebration: r.celebration } });
      return r;
    } catch (e) {
      onChange?.(task);
      toast(e.message);
      return null;
    }
  };
}

export function CheckCircle({ done, onClick, label, light = false, color }) {
  const [bump, setBump] = useState(false);
  const click = () => {
    if (!done) { setBump(true); setTimeout(() => setBump(false), 450); }
    onClick();
  };
  const ring = light ? 'rgba(255,255,255,0.55)' : 'var(--nobi-toggle-off)';
  const fill = light ? 'var(--nobi-creme)' : color || 'var(--nobi-control-on)';
  return (
    <button type="button" className={`check-circle ${bump ? 'nobi-bump' : ''}`} aria-pressed={done} aria-label={label} onClick={click}
      style={{ background: done ? fill : 'transparent', boxShadow: done ? 'none' : `inset 0 0 0 2px ${ring}`, color: light ? 'var(--nobi-tinta)' : '#FFFFFF' }}>
      {done && <Icon name="check" size={16} stroke={2.8} />}
    </button>
  );
}

/** Linha de tarefa com check, objetivo e data. */
export function TaskRow({ task, onChange, extra, showGoal = true }) {
  const toggle = useTaskToggle(onChange);
  const g = task.goal;
  return (
    <div className="task-row">
      <CheckCircle done={task.done} onClick={() => toggle(task)} label={`${task.done ? 'Desfazer' : 'Concluir'} ${task.title}`} color={g ? goalColor(g.color) : undefined} />
      <div className="grow stack" style={{ gap: 1, minWidth: 0 }}>
        <span className="t-15" style={{ fontWeight: 500, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? 'var(--nobi-text-muted)' : undefined }}>
          {task.isMilestone && <Icon name="flag" size={14} style={{ marginRight: 4, verticalAlign: '-2px', color: 'var(--nobi-orbita)' }} />}
          {task.title}
        </span>
        {(showGoal && g) || task.dueDate ? (
          <span className="row gap-6 t-12 muted ellipsis">
            {showGoal && g && <><span style={{ width: 8, height: 8, borderRadius: 3, background: goalColor(g.color), flexShrink: 0 }} />{g.title}</>}
            {task.dueDate && <span>{showGoal && g ? '· ' : ''}{shortDay(task.dueDate)}</span>}
          </span>
        ) : null}
      </div>
      {extra}
    </div>
  );
}

/** Card de objetivo com % concluído, dias restantes e marcador de ritmo (nunca "atrasado"). */
export function ObjectiveCard({ o, meId, onRemoved }) {
  const [menu, setMenu] = useState(false);
  const color = goalColor(o.color);
  const pace = o.pace;
  return (
    <article className="card stack gap-10" aria-label={o.title}>
      <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
        <span style={{ width: 40, height: 40, borderRadius: 14, background: color, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true">
          <Icon name={CATEGORIES[o.category]?.icon || 'target'} size={20} stroke={2.2} />
        </span>
        <div className="grow stack" style={{ gap: 1, minWidth: 0 }}>
          <Link to={`/metas/${o.id}`} className="t-16 strong">{o.title}</Link>
          <span className="t-13 muted">
            {pace?.daysLeft != null ? (pace.daysLeft > 0 ? `${pace.daysLeft} ${pace.daysLeft === 1 ? 'dia restante' : 'dias restantes'}` : pace.daysLeft === 0 ? 'vence hoje' : 'prazo passou, sem pressa') : 'sem prazo'}
            {o.total ? ` · ${o.done} de ${o.total} etapas` : ''}
          </span>
        </div>
        <span className="num t-28">{o.pct}%</span>
        {meId && <button type="button" className="icon-btn plain" aria-label={`Opções de ${o.title}`} onClick={() => setMenu(true)} style={{ width: 36, height: 36, marginRight: -8 }}><Icon name="more" size={20} /></button>}
      </div>
      <div className="pace-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={o.pct} aria-label={`Progresso de ${o.title}`}>
        <span className="pace-fill" style={{ width: `${o.pct}%`, background: color }} />
        {pace?.pacePct != null && <span className="pace-mark" style={{ left: `${pace.pacePct}%` }} title={`Ritmo esperado hoje: ${pace.pacePct}%`} />}
      </div>
      {pace?.pacePct != null && (
        <span className="t-13 strong" style={{ color: pace.onPace ? 'var(--nobi-success)' : 'var(--nobi-text-secondary)' }}>
          {pace.onPace ? 'No ritmo' : `Um pouco atrás do ritmo · ${pace.gap} pts`}
        </span>
      )}
      {o.nextStep && <span className="t-13 muted">Próxima etapa: {o.nextStep}</span>}
      {menu && <GoalActions goal={o} meId={meId} open onClose={() => setMenu(false)} onRemoved={onRemoved} />}
    </article>
  );
}

/** Linha da rotina: horário, linha do tempo na cor da categoria, sequência e check. */
export function RoutineRow({ goal, meId, onChange, onRemoved, last }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { checkin, undo } = useCheckin(onChange);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const g = { ...goal, meId, color: goalColor(goal.color) };
  const act = actionFor(g);
  const [value] = valueLine(g);
  const doneToday = g.status.periodDone || g.status.doneToday;
  const rest = !g.status.activeToday && g.kind !== 'weekly';

  async function run() {
    if (act.kind === 'link') return navigate(act.to);
    if (act.done && g.kind === 'count') return undefined;
    setBusy(true);
    try {
      if (act.kind === 'undo') await undo(goal);
      else await checkin({ ...goal, meId }, act.body);
    } catch (e) { toast(e.message); } finally { setBusy(false); }
    return undefined;
  }

  return (
    <div className="routine-row">
      <span className="routine-time t-13 strong">{g.scheduleTime || '—'}</span>
      <span className="routine-line" aria-hidden="true">
        <span className="routine-dot" style={{ background: doneToday ? g.color : 'var(--nobi-card)', boxShadow: `0 0 0 2px ${g.color}` }} />
        {!last && <span className="routine-stem" />}
      </span>
      <div className="card row gap-10 grow" style={{ padding: '10px 8px 10px 14px', opacity: rest ? 0.6 : 1 }}>
        <div className="grow stack" style={{ gap: 2, minWidth: 0 }}>
          <Link to={`/metas/${g.id}`} className="t-15 strong" style={{ lineHeight: 1.25 }}>{g.title}</Link>
          <span className="row gap-6 wrap t-12 muted">
            <StreakPill value={g.streak.current} unit={unitShort(g.streak.unit, g.streak.current)} active={doneToday} bump />
            <span>{rest ? 'Dia de descanso' : value}</span>
          </span>
        </div>
        <CheckCircle done={doneToday} onClick={run} label={act.label} color={g.color} />
        <button type="button" className="icon-btn plain" aria-label={`Opções de ${g.title}`} onClick={() => setMenu(true)} style={{ width: 32, height: 44 }} disabled={busy}><Icon name="more" size={18} /></button>
      </div>
      {menu && <GoalActions goal={goal} meId={meId} open onClose={() => setMenu(false)} onRemoved={onRemoved} onChanged={onChange} />}
    </div>
  );
}
