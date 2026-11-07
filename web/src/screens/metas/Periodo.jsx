// Metas: Semana, Mês e Concluídas (DESIGN.md 8.1)
import Icon from '../../components/Icon.jsx';
import { ErrorNote, Skeleton } from '../../components/ui.jsx';
import { TaskRow, ObjectiveCard, shortDay } from '../../components/metas/parts.jsx';
import { useLoad } from '../../lib/useLoad.js';
import { useShare } from '../../lib/share.jsx';
import { goalColor, weekOrder } from '../../lib/format.js';

const DAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function useView(view) {
  const r = useLoad(`/metas?view=${view}`);
  const fallback = r.error ? <ErrorNote error={r.error} onRetry={r.reload} /> : (!r.data ? <><Skeleton height={180} /><Skeleton height={160} /></> : null);
  return { ...r, fallback };
}

function GoalDot({ g }) {
  return <span style={{ width: 10, height: 10, borderRadius: 4, background: goalColor(g?.color), flexShrink: 0 }} aria-hidden="true" />;
}

export function Semana({ me }) {
  const { data, setData, fallback } = useView('semana');
  if (fallback) return fallback;
  const order = weekOrder(me.prefs?.weekStart).map((w) => w);
  const byWd = new Map(data.habits.days.map((d) => [d.weekday, d]));
  const pct = data.habits.total ? Math.round((data.habits.done / data.habits.total) * 100) : null;
  const update = (t) => setData((d) => ({ ...d, taskGroups: d.taskGroups.map((gr) => ({ ...gr, tasks: gr.tasks.map((x) => (x.id === t.id ? t : x)) })) }));
  return (
    <>
      <section className="card stack gap-14" aria-label="Hábitos da semana">
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div className="stack gap-4">
            <h2 className="title t-18">Hábitos</h2>
            <span className="t-13 muted">{shortDay(data.start)} – {shortDay(data.end)}</span>
          </div>
          <div className="stack" style={{ alignItems: 'flex-end' }}>
            <span className="num t-30">{data.habits.done}/{data.habits.total}</span>
            {pct != null && <span className="t-12 muted">{pct}% cumpridos</span>}
          </div>
        </div>
        <div className="week-bars" role="img" aria-label={order.map((w) => { const d = byWd.get(w.d); return `${w.full}: ${d?.rest ? 'descanso' : `${d?.done || 0} de ${d?.active || 0}`}`; }).join(', ')}>
          {order.map((w) => {
            const d = byWd.get(w.d);
            const h = d && d.active ? Math.max(8, (d.done / d.active) * 100) : 0;
            return <div key={w.d} className="week-bar" style={{ height: '100%', opacity: d?.future ? 0.45 : 1 }}>{!d?.rest && !d?.future && <span style={{ height: `${h}%` }} />}</div>;
          })}
        </div>
        <div className="week-bars" style={{ height: 'auto' }} aria-hidden="true">
          {order.map((w) => { const d = byWd.get(w.d); return <span key={w.d} className="t-12 center" style={{ color: d?.rest ? 'var(--nobi-text-muted)' : 'var(--nobi-text)', fontWeight: 600 }}>{d?.rest ? 'desc.' : w.short}</span>; })}
        </div>
        {data.weekly.length > 0 && (
          <div className="stack gap-6">
            {data.weekly.map((g) => (
              <span key={g.id} className="row gap-8 t-14"><GoalDot g={g} /><span className="grow">{g.title}</span><strong>{g.value} de {g.need}</strong></span>
            ))}
          </div>
        )}
      </section>

      <section className="stack gap-10" aria-label="Tarefas da semana">
        <h2 className="title t-20">Tarefas da semana</h2>
        {data.taskGroups.length === 0 && <p className="t-14 muted">Nenhuma tarefa com data nesta semana.</p>}
        {data.taskGroups.map((gr) => (
          <div key={gr.goal?.id} className="card stack" style={{ padding: '10px 14px' }}>
            <span className="row gap-8 t-13 strong muted" style={{ paddingBottom: 4 }}><GoalDot g={gr.goal} />{gr.goal?.title}</span>
            <div className="task-list">{gr.tasks.map((t) => <TaskRow key={t.id} task={t} onChange={update} showGoal={false} />)}</div>
          </div>
        ))}
      </section>
    </>
  );
}

export function Mes({ me }) {
  const { data, setData, fallback } = useView('mes');
  if (fallback) return fallback;
  const update = (t) => setData((d) => ({ ...d, dueThisMonth: d.dueThisMonth.map((x) => (x.id === t.id ? t : x)) }));
  const stats = [
    [data.habitsPct != null ? `${data.habitsPct}%` : '–', 'dos hábitos cumpridos'],
    [data.tasksDone, data.tasksDone === 1 ? 'tarefa feita' : 'tarefas feitas'],
    [data.milestones.length, data.milestones.length === 1 ? 'marco batido' : 'marcos batidos'],
  ];
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {stats.map(([v, l]) => (
          <div key={l} className="card" style={{ padding: 14, borderRadius: 20 }}>
            <div className="num t-28" style={{ lineHeight: 1 }}>{v}</div>
            <div className="t-12 muted" style={{ marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>
      {data.milestones.length > 0 && (
        <section className="card stack gap-6" aria-label="Marcos do mês">
          <h2 className="title t-18">Marcos batidos</h2>
          {data.milestones.map((t) => <span key={t.id} className="row gap-8 t-14"><Icon name="flag" size={16} style={{ color: 'var(--nobi-orbita)' }} /><span className="grow">{t.title}</span><span className="muted t-12">{t.goal?.title}</span></span>)}
        </section>
      )}
      <section className="stack gap-10" aria-label="Vence até o fim do mês">
        <h2 className="title t-20">Vence até o fim do mês</h2>
        {data.dueThisMonth.length === 0 ? <p className="t-14 muted">Nada com prazo até o fim do mês.</p> : (
          <div className="card" style={{ padding: '4px 14px' }}><div className="task-list">{data.dueThisMonth.map((t) => <TaskRow key={t.id} task={t} onChange={update} />)}</div></div>
        )}
      </section>
      {data.objectives.length > 0 && (
        <section className="stack gap-10" aria-label="Objetivos">
          <h2 className="title t-20">Objetivos</h2>
          {data.objectives.map((o) => <ObjectiveCard key={o.id} o={o} meId={me.id} />)}
        </section>
      )}
    </>
  );
}

export function Concluidas() {
  const { data, setData, fallback } = useView('concluidas');
  const share = useShare();
  if (fallback) return fallback;
  const total = data.days.reduce((s, d) => s + d.tasks.length, 0);
  const update = (t) => setData((d) => ({ ...d, days: d.days.map((day) => ({ ...day, tasks: day.tasks.map((x) => (x.id === t.id ? t : x)) })) }));
  return (
    <>
      <section className="card row gap-16" aria-label="Últimos 30 dias">
        <div className="stack"><span className="num t-30">{total}</span><span className="t-12 muted">{total === 1 ? 'tarefa concluída' : 'tarefas concluídas'}</span></div>
        <div className="stack"><span className="num t-30">{data.checkins}</span><span className="t-12 muted">registros de hábito</span></div>
        <span className="t-12 muted grow" style={{ textAlign: 'right' }}>últimos 30 dias</span>
      </section>
      {data.days.length === 0 && <p className="t-14 muted center" style={{ padding: 20 }}>Nada concluído nos últimos 30 dias ainda. O primeiro check é o que mais conta.</p>}
      {data.days.map((day) => (
        <section key={day.date} className="stack gap-6" aria-label={day.date}>
          <h2 className="t-13 strong muted label-caps">{DAY_NAMES[new Date(`${day.date}T12:00:00Z`).getUTCDay()]}, {shortDay(day.date)}</h2>
          <div className="card" style={{ padding: '4px 14px' }}>
            <div className="task-list">
              {day.tasks.map((t) => (
                <TaskRow key={t.id} task={t} onChange={update} extra={t.isMilestone ? (
                  <button type="button" className="btn btn-soft sm" onClick={() => share({ goalId: t.goalId, celebration: { kind: 'milestone', title: t.title }, title: `Marco: ${t.title}` })}>Postar</button>
                ) : null} />
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
