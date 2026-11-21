import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { ErrorNote, ProgressBar, Skeleton } from '../../components/ui.jsx';
import { useLoad, invalidateLoad } from '../../lib/useLoad.js';
import { api } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { EmptyTreinos, progressText } from './parts.jsx';

/** Cartão de um programa ativo: progresso, divisão de hoje e o atalho para treinar. */
export function PlanCard({ plan, onArchived }) {
  const navigate = useNavigate();
  const toast = useToast();
  const doneToday = Boolean(plan.todaySessionId);
  const { completed } = plan.progress;

  async function archive() {
    try {
      await api(`/treinos/${plan.id}/arquivar`, { method: 'POST' });
      invalidateLoad('/treinos', '/treinos/historico');
      onArchived?.(plan);
      toast(`“${plan.name}” foi para o histórico.`);
    } catch (e) { toast(e.message); }
  }

  return (
    <article className="card stack gap-12">
      <Link to={`/treinos/${plan.id}`} className="stack gap-4 plan-link">
        <span className="row between gap-12">
          <span className="title t-18 ellipsis">{plan.name}</span>
          <Icon name="chevron" size={18} className="muted" />
        </span>
        <span className="t-13 secondary">
          {completed ? 'Concluído' : doneToday ? `Feito hoje · ${plan.next?.name || ''}` : plan.next ? `Hoje: ${plan.next.name}` : 'Sem divisões'}
          {plan.goal ? ` · conta em “${plan.goal.title}”` : ''}
        </span>
      </Link>
      <div className="stack gap-6">
        <ProgressBar value={plan.progress.pct} color="var(--nobi-brasa)" label={`Progresso de ${plan.name}`} />
        <span className="t-13 strong">{progressText(plan.progress)}</span>
      </div>
      <div className="row gap-8 wrap">
        {completed ? (
          <button type="button" className="btn btn-dark sm" onClick={archive}><Icon name="check" size={17} /> Arquivar no histórico</button>
        ) : doneToday ? (
          <button type="button" className="btn btn-soft sm" onClick={() => navigate(`/treinos/${plan.id}/sessao`)}><Icon name="edit" size={17} /> Ajustar o de hoje</button>
        ) : plan.next && (
          <button type="button" className="btn btn-dark sm" onClick={() => navigate(`/treinos/${plan.id}/sessao?dia=${plan.next.key}`)}><Icon name="play" size={17} /> Treinar {plan.next.name}</button>
        )}
      </div>
    </article>
  );
}

export default function Treinos() {
  const navigate = useNavigate();
  const { data, error, reload, setData } = useLoad('/treinos');

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="stack" style={{ gap: 2 }}>
          <span className="t-14 secondary">Sua biblioteca</span>
          <h1 className="title t-30">Treinos</h1>
        </div>
        <Link to="/treinos/novo" className="btn btn-dark sm"><Icon name="plus" size={18} /> Novo</Link>
      </header>

      <ErrorNote error={error} onRetry={reload} />
      {!data && !error && <><Skeleton height={150} /><Skeleton height={150} /></>}
      {data?.length === 0 && <EmptyTreinos onCreate={() => navigate('/treinos/novo')} />}
      {data?.map((p) => <PlanCard key={p.id} plan={p} onArchived={() => setData((l) => l.filter((x) => x.id !== p.id))} />)}

      <Link to="/treinos/historico" className="card row gap-12 plan-link">
        <span className="broto-plate round plan-plate"><Icon name="calendar" size={20} /></span>
        <span className="grow stack" style={{ gap: 2 }}>
          <span className="strong t-15">Histórico e comparações</span>
          <span className="t-13 secondary">Treinos arquivados, evolução das cargas e um programa contra o outro</span>
        </span>
        <Icon name="chevron" size={18} className="muted" />
      </Link>
    </div>
  );
}
