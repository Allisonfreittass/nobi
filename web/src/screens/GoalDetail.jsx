import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Avatar, BackButton, ErrorNote, ProgressBar, Skeleton, StreakPill, WeekDots } from '../components/ui.jsx';
import { useLoad, afterCheckin } from '../lib/useLoad.js';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { useShare } from '../lib/share.jsx';
import { useCheckin } from '../lib/useCheckin.js';
import GoalActions from '../components/GoalActions.jsx';
import { api } from '../lib/api.js';
import { CATEGORIES, KIND_LABEL, unitShort, unitWord, firstName, goalColor } from '../lib/format.js';

export default function GoalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { me } = useSession();
  const toast = useToast();
  const share = useShare();
  const { data: g, error, setData, reload } = useLoad(`/goals/${id}`);
  const { checkin, undo } = useCheckin((goal) => setData(goal));
  const [menu, setMenu] = useState(false);
  const [newMs, setNewMs] = useState('');

  if (error) return <div className="screen no-nav"><BackButton /><ErrorNote error={error} onRetry={reload} /></div>;
  if (!g) return <div className="screen no-nav"><Skeleton height={200} /><Skeleton height={160} /></div>;
  if (g.shared?.endsAt) return <Navigate to={`/desafios/${g.id}`} replace />;

  const cat = CATEGORIES[g.category];

  async function toggleMilestone(m) {
    try {
      const r = await api(`/goals/${g.id}/milestones/${m.id}`, { method: 'PATCH', body: { done: !m.done } });
      setData(r.goal);
      afterCheckin(r.goal);
      if (r.celebration) navigate('/conquista', { state: { celebration: r.celebration } });
    } catch (e) { toast(e.message); }
  }
  async function addMilestone(e) {
    e.preventDefault();
    if (!newMs.trim()) return;
    try { setData(await api(`/goals/${g.id}/milestones`, { method: 'POST', body: { title: newMs } })); setNewMs(''); } catch (err) { toast(err.message); }
  }
  return (
    <div className="screen no-nav">
      <header className="screen-head">
        <BackButton />
        <button type="button" className="icon-btn" aria-label="Opções do objetivo" onClick={() => setMenu(true)}><Icon name="more" /></button>
      </header>

      <section className="card stack gap-14" style={{ background: goalColor(g.color), color: g.color === '#141218' || g.color === '#6C4DFF' ? '#FFFFFF' : 'var(--nobi-tinta)' }}>
        <span className="label-caps t-12">{cat.label} · {KIND_LABEL[g.kind]}</span>
        <h1 className="title t-28">{g.title}</h1>
        <div className="row gap-24">
          <div className="stack"><span className="num t-40">{g.shared?.groupStreak ? g.shared.groupStreak.current : g.streak.current}</span><span className="t-13 strong">{unitWord(g.streak.unit, g.streak.current)} seguidos{g.shared?.groupStreak ? ' (grupo)' : ''}</span></div>
          <div className="stack"><span className="num t-40">{g.streak.best}</span><span className="t-13 strong">melhor sequência</span></div>
        </div>
      </section>

      <section className="card stack gap-12">
        <div className="row between"><h2 className="title t-18">Últimos 7 dias</h2><StreakPill value={g.streak.current} unit={unitShort(g.streak.unit, g.streak.current)} active={g.status.periodDone || g.status.doneToday} bump /></div>
        <WeekDots days={g.status.last7} color={goalColor(g.color)} />
        {g.kind === 'project' && <ProgressBar value={g.pct} color={goalColor(g.color)} label="Progresso do projeto" />}
        <div className="row gap-8 wrap">
          {g.status.doneToday
            ? <button type="button" className="btn btn-soft sm" onClick={() => undo(g).catch((e) => toast(e.message))}><Icon name="check" size={17} /> {g.kind === 'project' ? 'Avançou hoje' : 'Feito hoje'}</button>
            : <button type="button" className="btn btn-dark sm" onClick={() => checkin(g, g.kind === 'count' ? { value: 1 } : g.target?.unit === 'min' ? { minutes: g.status.need } : {}).catch((e) => toast(e.message))}>{g.kind === 'project' ? 'Avancei hoje' : 'Registrar'}</button>}
          {g.postsCount === 0 && g.streak.current > 0 && (
            <button type="button" className="btn btn-outline sm" onClick={() => share({ goalId: g.id, title: `${g.title} · ${g.streak.current} ${unitWord(g.streak.unit, g.streak.current)} seguidos` })}><Icon name="share" size={17} /> Compartilhar</button>
          )}
        </div>
      </section>

      {g.kind === 'project' && (
        <section className="card stack gap-8" aria-label="Marcos">
          <h2 className="title t-18">Marcos</h2>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }} className="stack gap-4">
            {g.milestones.map((m) => (
              <li key={m.id}>
                <button type="button" className="list-row" style={{ padding: '6px 4px', minHeight: 48, borderRadius: 12 }} aria-pressed={m.done} onClick={() => toggleMilestone(m)}>
                  <span style={{ width: 26, height: 26, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.done ? goalColor(g.color) : 'var(--nobi-card)', boxShadow: m.done ? 'none' : 'inset 0 0 0 2px var(--nobi-toggle-off)', color: '#FFFFFF' }}>{m.done && <Icon name="check" size={16} stroke={2.6} />}</span>
                  <span className="grow t-15" style={{ textDecoration: m.done ? 'line-through' : 'none', color: m.done ? 'var(--nobi-text-muted)' : undefined }}>{m.title}</span>
                </button>
              </li>
            ))}
          </ol>
          <form className="row gap-8" onSubmit={addMilestone}>
            <label className="grow"><span className="sr-only">Novo marco</span><input className="input" value={newMs} onChange={(e) => setNewMs(e.target.value)} placeholder="Novo marco" maxLength={80} /></label>
            <button type="submit" className="btn btn-dark sm" disabled={!newMs.trim()}>Adicionar</button>
          </form>
        </section>
      )}

      {g.shared && (
        <section className="card stack gap-10" aria-label="Participantes">
          <h2 className="title t-18">Quem já fez hoje</h2>
          {g.shared.participants.map((p) => (
            <div key={p.id} className="row gap-12">
              <Avatar user={p} size={36} />
              <span className="grow strong t-15">{p.id === me.id ? 'Você' : firstName(p.name)}</span>
              <span className="t-13 strong" style={{ color: p.doneToday ? 'var(--nobi-success)' : 'var(--nobi-text-muted)' }}>{p.doneToday ? 'Fez hoje' : 'Ainda não'}</span>
            </div>
          ))}
          {g.shared.mode === 'together' && <p className="t-13 muted">A sequência do grupo conta quando {g.shared.groupStreak.quorum} de {g.shared.participants.length} marcam no dia.</p>}
        </section>
      )}

      {menu && <GoalActions goal={g} meId={me.id} open showDetails={false} onClose={() => setMenu(false)} onRemoved={() => navigate('/metas', { replace: true })} onChanged={(ng) => setData(ng)} />}
    </div>
  );
}
