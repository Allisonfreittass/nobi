import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { ErrorNote, RingProgress, Skeleton } from '../../components/ui.jsx';
import { useLoad, invalidateLoad } from '../../lib/useLoad.js';
import { api } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { EmptyTreinos } from './parts.jsx';

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

  const next = plan.next;
  return (
    <article className="card plan-card">
      <Link to={`/treinos/${plan.id}`} className="plan-card-top">
        <RingProgress value={plan.progress.pct} size={58} thickness={7}>
          <span className="t-12 strong" style={{ fontVariantNumeric: 'tabular-nums' }}>{plan.progress.done}/{plan.progress.total}</span>
        </RingProgress>
        <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
          <span className="title t-18 plan-card-name">{plan.name}</span>
          <span className="t-13 secondary ellipsis">
            {completed ? 'Concluído · pronto para arquivar' : `${plan.progress.left} ${plan.progress.left === 1 ? 'treino restante' : 'treinos restantes'}`}
            {plan.goal ? ` · ${plan.goal.title}` : ''}
          </span>
        </span>
        <Icon name="chevron" size={18} className="muted" />
      </Link>
      {completed ? (
        <button type="button" className="btn btn-dark sm" onClick={archive}><Icon name="check" size={17} /> Arquivar no histórico</button>
      ) : next && (
        <div className="plan-next">
          <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
            <span className="t-12 muted strong">{doneToday ? 'Feito hoje' : 'Próximo'}</span>
            <span className="t-15 strong ellipsis">{next.name}</span>
            <span className="t-12 secondary ellipsis">{next.exercises.length} exercícios · {next.exercises.slice(0, 3).map((e) => e.name).join(', ')}</span>
          </span>
          {doneToday
            ? <button type="button" className="btn btn-soft sm" onClick={() => navigate(`/treinos/${plan.id}/sessao`)}>Ajustar</button>
            : <button type="button" className="btn btn-dark sm" onClick={() => navigate(`/treinos/${plan.id}/sessao?dia=${next.key}`)}><Icon name="play" size={16} /> Treinar</button>}
        </div>
      )}
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
