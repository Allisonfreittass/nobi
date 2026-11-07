import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Broto from '../components/Broto.jsx';
import GoalCard from '../components/GoalCard.jsx';
import { Avatar, Chip, ErrorNote, RingProgress, Skeleton } from '../components/ui.jsx';
import { useLoad } from '../lib/useLoad.js';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { api } from '../lib/api.js';
import { longToday } from '../lib/format.js';

const FILTERS = [
  ['todos', 'Todos', () => true],
  ['habito', 'Hábitos', (g) => g.category === 'habito'],
  ['treino', 'Treino', (g) => g.category === 'treino'],
  ['leitura', 'Leitura', (g) => g.category === 'leitura'],
  ['estudo', 'Estudo', (g) => g.category === 'estudo'],
  ['projeto', 'Projetos', (g) => g.kind === 'project'],
  ['amigos', 'Com amigos', (g) => Boolean(g.shared)],
  ['pessoais', 'Pessoais', (g) => !g.shared],
];

function Invites({ onJoined }) {
  const { data, setData } = useLoad('/goals/invites');
  const toast = useToast();
  const navigate = useNavigate();
  if (!data?.length) return null;
  async function answer(inv, yes) {
    try {
      await api(`/goals/${inv.id}/${yes ? 'join' : 'decline'}`, { method: 'POST' });
      setData((l) => l.filter((x) => x.id !== inv.id));
      if (yes) { onJoined(); toast(`Você entrou em “${inv.title}”.`); if (inv.endsAt) navigate(`/desafios/${inv.id}`); }
    } catch (e) { toast(e.message); }
  }
  return (
    <section className="stack gap-8" aria-label="Convites">
      {data.map((inv) => (
        <div key={inv.id} className="card row gap-12" style={{ boxShadow: 'inset 0 0 0 2px var(--nobi-orbita)' }}>
          <Avatar user={inv.owner} size={40} />
          <div className="grow stack" style={{ gap: 2 }}>
            <span className="t-14"><strong>{inv.owner?.name.split(' ')[0]}</strong> chamou você para</span>
            <span className="strong t-15 ellipsis">{inv.title}</span>
            <span className="t-12 muted">{inv.mode === 'together' ? 'Juntos · sem competição' : 'Disputa · ranking semanal'}</span>
          </div>
          <div className="stack gap-6">
            <button type="button" className="btn btn-orbita sm" onClick={() => answer(inv, true)}>Topar</button>
            <button type="button" className="btn btn-ghost sm" onClick={() => answer(inv, false)}>Agora não</button>
          </div>
        </div>
      ))}
    </section>
  );
}

export default function Goals() {
  const { me } = useSession();
  const navigate = useNavigate();
  const { data, error, loading, reload, setData } = useLoad('/goals');
  const [filter, setFilter] = useState('todos');
  const list = data || [];
  const today = list.filter((g) => g.status.activeToday);
  const doneCount = today.filter((g) => g.status.periodDone || g.status.doneToday).length;
  const all = today.length > 0 && doneCount === today.length;
  const shown = list.filter(FILTERS.find((f) => f[0] === filter)[2]);
  const update = (g) => setData((l) => l.map((x) => (x.id === g.id ? g : x)));
  const filters = FILTERS.filter(([k, , fn]) => k === 'todos' || list.some(fn));

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="stack" style={{ gap: 2 }}>
          <span className="t-14 secondary">{longToday()}</span>
          <h1 className="title t-30">Meus objetivos</h1>
        </div>
        <Link to="/metas/novo" className="btn btn-dark sm"><Icon name="plus" size={18} /> Novo</Link>
      </header>

      <Invites onJoined={reload} />
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data && <><Skeleton height={104} /><Skeleton height={180} /><Skeleton height={180} /></>}

      {data && list.length === 0 && (
        <div className="card empty">
          <div className="block-brasa" style={{ borderRadius: 24, padding: '16px 24px 6px' }}><Broto size={100} stage={me.stage} golden={me.golden} /></div>
          <h2 className="title t-20">O que você quer construir?</h2>
          <p className="secondary t-14" style={{ maxWidth: 300 }}>Crie um objetivo e ganhe uma sequência só dele. Pode ser pessoal ou com amigos.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/metas/novo')}>Criar objetivo</button>
        </div>
      )}

      {list.length > 0 && (
        <>
          <section className="card row gap-16" aria-label="Resumo de hoje">
            <RingProgress value={today.length ? doneCount / today.length : 0}>
              <span className="num t-18">{doneCount}/{today.length}</span>
            </RingProgress>
            <div className="stack gap-4 grow">
              <h2 className="title t-20">{all ? 'Dia completo!' : today.length ? `${today.length - doneCount === 1 ? "Falta" : "Faltam"} ${today.length - doneCount} hoje` : 'Dia de descanso'}</h2>
              <p className="t-13 secondary">{all ? 'Todas as sequências seguem vivas. O Broto está orgulhoso.' : 'Cada objetivo tem a sua própria sequência. Não precisa fazer tudo pra não perder as outras.'}</p>
            </div>
          </section>
          <div className="chips" role="group" aria-label="Filtrar por categoria">
            {filters.map(([k, label]) => <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>{label}</Chip>)}
          </div>
          <div className="stack gap-12">
            {shown.map((g) => <GoalCard key={g.id} goal={g} meId={me.id} onChange={update} />)}
            {shown.length === 0 && <p className="muted t-14 center" style={{ padding: 20 }}>Nada por aqui neste filtro.</p>}
          </div>
        </>
      )}
    </div>
  );
}
