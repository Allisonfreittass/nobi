import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { ProgressBar, StreakPill, WeekDots } from './ui.jsx';
import { CATEGORIES, KIND_LABEL, firstName, unitShort, goalColor } from '../lib/format.js';
import { useCheckin } from '../lib/useCheckin.js';
import GoalActions from './GoalActions.jsx';
import { useToast } from '../lib/toast.jsx';

const singular = (u) => ({ copos: 'copo', treinos: 'treino', lições: 'lição', páginas: 'página', corridas: 'corrida', min: 'min' }[u] || u || 'vez');

export function metaLine(g) {
  if (g.shared) {
    const others = g.shared.participants.filter((p) => p.id !== g.meId).map((p) => firstName(p.name));
    const names = others.length > 2 ? `${others.slice(0, 2).join(', ')} e +${others.length - 2}` : others.join(' e ');
    const mode = g.shared.mode === 'together' ? 'juntos' : 'disputa';
    return others.length ? `Com ${names} · ${mode}` : `Com amigos · ${mode} · aguardando`;
  }
  const posts = g.postsCount === 0 ? 'nenhum post ainda' : `${g.postsCount} ${g.postsCount === 1 ? 'post' : 'posts'}`;
  if (g.kind === 'project') return `Projeto${g.deadline ? ` · até ${new Date(`${g.deadline}T12:00`).toLocaleDateString('pt-BR', { month: 'long' })}` : ''} · ${posts}`;
  return `${KIND_LABEL[g.kind]} · ${posts}`;
}

export function valueLine(g) {
  const st = g.status;
  const u = g.target?.unit;
  if (g.kind === 'project') return [`${Math.round(g.pct * 100)}% concluído`, g.nextMilestone ? `próximo marco: ${g.nextMilestone}` : 'todos os marcos feitos'];
  if (g.shared?.tasks?.length) return [`${g.shared.myTasksToday?.length || 0} de ${g.shared.tasks.length} tarefas hoje`, g.shared.ranking ? `${g.shared.ranking.find((r) => r.me)?.position}º lugar na semana` : ''];
  if (g.kind === 'weekly') {
    const others = (g.shared?.participants || []).filter((p) => p.id !== g.meId).map((p) => `${firstName(p.name)} ${p.weekValue}/${st.need}`);
    return [`${st.weekValue} de ${st.need} ${u || 'vezes'}`, others.join(' · ') || (st.doneToday ? 'feito hoje' : 'nesta semana')];
  }
  if (st.need > 1) return [`${st.todayValue} de ${st.need} ${u || ''}`.trim(), g.kind === 'count' && st.periodDone ? 'meta do dia batida' : ''];
  return [st.doneToday ? 'Feito hoje' : st.activeToday ? 'Ainda não hoje' : 'Dia de descanso', g.shared ? `${g.shared.doneTodayCount} de ${g.shared.participants.length} já fizeram` : ''];
}

export function actionFor(g) {
  const st = g.status;
  const u = g.target?.unit;
  if (g.shared?.tasks?.length) return { label: 'Abrir desafio', kind: 'link', to: `/desafios/${g.id}` };
  if (g.kind === 'project') return { label: st.doneToday ? 'Avançou hoje' : 'Atualizar', kind: 'link', to: `/metas/${g.id}`, done: st.doneToday };
  if (g.kind === 'count') return st.periodDone ? { label: 'Meta batida', kind: 'add', done: true, body: { value: 1 } } : { label: `+1 ${singular(u)}`, kind: 'add', body: { value: 1 } };
  if (g.kind === 'weekly') {
    if (st.doneToday) return { label: st.periodDone ? 'Semana fechada' : 'Feito hoje', kind: 'undo', done: true };
    return { label: `Registrar ${singular(u)}`, kind: 'add', body: { value: 1 } };
  }
  if (st.doneToday) return { label: 'Feito hoje', kind: 'undo', done: true };
  return { label: 'Check-in', kind: 'add', body: u === 'min' ? { minutes: st.need } : { value: Math.max(1, st.need - st.todayValue) } };
}

export default function GoalCard({ goal, meId, onChange, onRemove, compact }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { checkin, undo } = useCheckin(onChange);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const g = { ...goal, meId, color: goalColor(goal.color) };
  const cat = CATEGORIES[g.category];
  const [value, hint] = valueLine(g);
  const act = actionFor(g);
  const streakActive = g.status.periodDone || g.status.doneToday;
  const streakValue = g.shared?.mode === 'together' ? g.shared.groupStreak.current : g.streak.current;

  async function run() {
    if (act.kind === 'link') return navigate(act.to);
    setBusy(true);
    try {
      if (act.kind === 'undo') await undo(goal);
      else if (!(act.done && g.kind === 'count')) await checkin({ ...goal, meId }, act.body);
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  const title = g.shared?.endsAt ? <Link to={`/desafios/${g.id}`}>{g.title}</Link> : <Link to={`/metas/${g.id}`}>{g.title}</Link>;

  return (
    <article className="card stack gap-12" aria-label={g.title}>
      <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
        <span style={{ width: 40, height: 40, borderRadius: 14, flexShrink: 0, background: g.color, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
          <Icon name={cat.icon} size={20} stroke={2.2} />
        </span>
        <div className="grow stack" style={{ gap: 2 }}>
          <h3 className="t-16 strong" style={{ lineHeight: 1.25 }}>{title}</h3>
          <span className="t-13 muted ellipsis">{metaLine(g)}</span>
        </div>
        <StreakPill value={streakValue} unit={unitShort(g.streak.unit, streakValue)} active={streakActive} bump />
        <button type="button" className="icon-btn plain" aria-label={`Opções de ${g.title}`} onClick={() => setMenu(true)} style={{ width: 36, height: 36, marginRight: -8, marginTop: -2 }}>
          <Icon name="more" size={20} />
        </button>
      </div>
      {!compact && (
        <>
          <div className="row between gap-8" style={{ alignItems: 'baseline' }}>
            <span className="strong t-15">{value}</span>
            {hint && <span className="t-13 muted ellipsis" style={{ textAlign: 'right' }}>{hint}</span>}
          </div>
          <ProgressBar value={g.pct} color={g.color} label={`Progresso de ${g.title}`} />
        </>
      )}
      <div className="row between gap-12">
        <WeekDots days={g.status.last7} color={g.color} />
        <button type="button" className={`btn sm ${act.done ? 'btn-soft' : 'btn-dark'}`} onClick={run} disabled={busy || (act.done && g.kind === 'count')} aria-pressed={act.kind === 'undo' ? true : undefined}>
          {act.done && <Icon name="check" size={17} stroke={2.4} />}
          {act.label}
        </button>
      </div>
      {menu && <GoalActions goal={goal} meId={meId} open onClose={() => setMenu(false)} onRemoved={onRemove} onChanged={(ng) => onChange?.(ng)} />}
    </article>
  );
}
