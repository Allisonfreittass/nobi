import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { BackButton, ErrorNote, RingProgress, Sheet, Skeleton } from '../../components/ui.jsx';
import { useLoad, invalidateLoad } from '../../lib/useLoad.js';
import { api } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { useConfirm } from '../../lib/confirm.jsx';
import { shortDate } from '../../lib/format.js';
import { Delta, kg, plannedText, progressText, setsText, volume } from './parts.jsx';

export default function Treino() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: plan, error, reload, setData } = useLoad(`/treinos/${id}`);
  const [menu, setMenu] = useState(false);
  const [openSession, setOpenSession] = useState(null);

  if (error) return <div className="screen no-nav"><BackButton /><ErrorNote error={error} onRetry={reload} /></div>;
  if (!plan) return <div className="screen no-nav"><Skeleton height={180} /><Skeleton height={220} /></div>;

  const archived = Boolean(plan.archivedAt);
  const { completed } = plan.progress;
  const refresh = () => invalidateLoad('/treinos', '/treinos/historico', '/treinos/exercicios');

  async function archive() {
    setMenu(false);
    try {
      await api(`/treinos/${plan.id}/${archived ? 'restaurar' : 'arquivar'}`, { method: 'POST' });
      refresh();
      setData((p) => ({ ...p, archivedAt: archived ? null : new Date().toISOString() }));
      toast(archived ? 'Treino de volta aos ativos.' : `“${plan.name}” foi para o histórico.`);
    } catch (e) { toast(e.message); }
  }
  async function destroy() {
    setMenu(false);
    if (!(await confirm({ title: `Excluir “${plan.name}” de vez?`, message: 'Apaga o programa e todas as sessões com as cargas. Os check-ins no objetivo continuam. Não dá para desfazer.', confirmLabel: 'Excluir de vez', danger: true }))) return;
    try {
      await api(`/treinos/${plan.id}`, { method: 'DELETE' });
      refresh();
      navigate('/treinos', { replace: true });
      toast('Treino excluído.');
    } catch (e) { toast(e.message); }
  }
  async function removeSession(s) {
    if (!(await confirm({ title: `Apagar o treino de ${shortDate(s.date)}?`, message: 'As cargas desse dia saem do histórico e o progresso volta um treino. O check-in no objetivo continua.', confirmLabel: 'Apagar', danger: true }))) return;
    try {
      await api(`/treinos/${plan.id}/sessoes/${s.id}`, { method: 'DELETE' });
      refresh();
      setOpenSession(null);
      reload();
    } catch (e) { toast(e.message); }
  }

  const evolution = plan.summary.exercises.filter((e) => e.sessions > 1 || e.bestLoad > 0).slice(0, 8);

  return (
    <div className="screen no-nav">
      <header className="screen-head">
        <BackButton onClick={() => navigate(archived ? '/treinos/historico' : '/treinos')} />
        <button type="button" className="icon-btn" aria-label="Opções do treino" onClick={() => setMenu(true)}><Icon name="more" /></button>
      </header>

      <section className="card row gap-16 plan-hero">
        <RingProgress value={plan.progress.pct} size={84} thickness={10}>
          <span className="num t-20">{Math.round(plan.progress.pct * 100)}%</span>
        </RingProgress>
        <div className="stack grow" style={{ gap: 4, minWidth: 0 }}>
          <span className="label-caps t-12">{archived ? 'Arquivado' : completed ? 'Concluído' : 'Treino'}</span>
          <h1 className="title t-22">{plan.name}</h1>
          <span className="t-14 strong">{progressText(plan.progress)}</span>
          <span className="t-13 secondary">
            Desde {shortDate(plan.startedAt)}{plan.goal ? ` · conta em “${plan.goal.title}”` : ''}
          </span>
        </div>
      </section>

      {!archived && (completed ? (
        <section className="card stack gap-10">
          <h2 className="title t-18">Você fechou os {plan.totalSessions} treinos!</h2>
          <p className="t-14 secondary">Arquive para guardar as cargas no histórico e comparar com o próximo programa. Se quiser continuar, aumente o total em Editar.</p>
          <button type="button" className="btn btn-primary" onClick={archive}>Arquivar no histórico</button>
        </section>
      ) : plan.todaySessionId ? (
        <button type="button" className="btn btn-soft lg block" onClick={() => navigate(`/treinos/${plan.id}/sessao`)}><Icon name="check" size={18} /> Feito hoje · ajustar</button>
      ) : plan.next && (
        <button type="button" className="btn btn-primary lg block" onClick={() => navigate(`/treinos/${plan.id}/sessao?dia=${plan.next.key}`)}>
          <Icon name="play" size={18} /> Treinar {plan.next.name}
        </button>
      ))}

      <section className="stack gap-10" aria-label="Divisões">
        <h2 className="title t-18">Divisões</h2>
        {plan.days.map((d) => (
          <div key={d.key} className="card flush card-list">
            <div className="list-row between">
              <span className="strong t-15">{d.name}{plan.next?.key === d.key && !archived && !completed ? <span className="tag" style={{ marginLeft: 8 }}>{plan.todaySessionId ? 'hoje' : 'próximo'}</span> : null}</span>
              {!archived && !plan.todaySessionId && <Link to={`/treinos/${plan.id}/sessao?dia=${d.key}`} className="btn btn-ghost sm">Fazer este</Link>}
            </div>
            {d.exercises.map((ex) => (
              <div key={ex.key} className="list-row between" style={{ minHeight: 48 }}>
                <span className="t-15 ellipsis">{ex.name}</span>
                <span className="t-13 secondary" style={{ whiteSpace: 'nowrap' }}>{plannedText(ex)}</span>
              </div>
            ))}
          </div>
        ))}
      </section>

      {evolution.length > 0 && (
        <section className="stack gap-10" aria-label="Evolução das cargas">
          <div className="section-head"><h2 className="title t-18">Evolução das cargas</h2><span className="t-13 muted">1º treino → melhor</span></div>
          <div className="card flush card-list">
            {evolution.map((e) => (
              <Link key={e.slug} to={`/treinos/historico?aba=exercicios&ex=${e.slug}`} className="list-row">
                <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
                  <span className="t-15 strong ellipsis">{e.name}</span>
                  <span className="t-13 secondary">{kg(e.firstLoad)} → {kg(e.bestLoad)} · {e.sessions} {e.sessions === 1 ? 'treino' : 'treinos'}</span>
                </span>
                <Delta from={e.firstLoad} to={e.bestLoad} />
                <Icon name="chevron" size={16} className="muted" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="stack gap-10" aria-label="Sessões">
        <div className="section-head">
          <h2 className="title t-18">Sessões</h2>
          {plan.summary.volume > 0 && <span className="t-13 muted">{volume(plan.summary.volume)} no total</span>}
        </div>
        {plan.sessions.length === 0 ? (
          <p className="t-14 secondary">Nenhum treino feito ainda. O primeiro é o mais importante.</p>
        ) : (
          <div className="card flush card-list">
            {plan.sessions.map((s) => (
              <button key={s.id} type="button" className="list-row" onClick={() => setOpenSession(s)}>
                <span className="grow stack" style={{ gap: 2 }}>
                  <span className="t-15 strong">{s.dayName || 'Treino'} · {shortDate(s.date)}</span>
                  <span className="t-13 secondary">{s.exercises.length} exercícios · {volume(s.volume)}{s.minutes ? ` · ${s.minutes} min` : ''}</span>
                </span>
                <Icon name="chevron" size={16} className="muted" />
              </button>
            ))}
          </div>
        )}
      </section>

      <Sheet open={menu} onClose={() => setMenu(false)} title={plan.name}>
        <div className="card flush card-list">
          {!archived && <button type="button" className="list-row" onClick={() => { setMenu(false); navigate(`/treinos/${plan.id}/editar`); }}><Icon name="edit" size={20} /> <span className="grow t-15 strong">Editar treino</span></button>}
          <button type="button" className="list-row" onClick={archive}><Icon name={archived ? 'sprout' : 'download'} size={20} /> <span className="grow t-15 strong">{archived ? 'Restaurar aos ativos' : 'Arquivar no histórico'}</span></button>
          <button type="button" className="list-row" onClick={destroy}><Icon name="trash" size={20} /> <span className="grow t-15 strong">Excluir de vez</span></button>
        </div>
      </Sheet>

      <Sheet open={Boolean(openSession)} onClose={() => setOpenSession(null)} title={openSession ? `${openSession.dayName || 'Treino'} · ${shortDate(openSession.date)}` : ''}>
        {openSession && (
          <div className="stack gap-12">
            <div className="card flush card-list">
              {openSession.exercises.map((e, i) => (
                <div key={i} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <span className="grow stack" style={{ gap: 2 }}>
                    <span className="t-15 strong">{e.name}</span>
                    <span className="t-13 secondary">{setsText(e.sets)}</span>
                  </span>
                </div>
              ))}
            </div>
            {openSession.note && <p className="t-14 secondary">“{openSession.note}”</p>}
            <p className="t-13 muted">{volume(openSession.volume)}{openSession.minutes ? ` · ${openSession.minutes} min` : ''}</p>
            {!archived && <button type="button" className="btn btn-ghost" onClick={() => removeSession(openSession)}><Icon name="trash" size={17} /> Apagar este treino</button>}
          </div>
        )}
      </Sheet>
    </div>
  );
}
