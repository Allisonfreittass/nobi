import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Broto from '../components/Broto.jsx';
import GoalCard from '../components/GoalCard.jsx';
import { PushCard } from '../components/PushPrompt.jsx';
import { ShieldNotice } from '../components/Shields.jsx';
import { Avatar, Chip, ErrorNote, RingProgress, Skeleton } from '../components/ui.jsx';
import { useLoad } from '../lib/useLoad.js';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { api } from '../lib/api.js';
import { longToday } from '../lib/format.js';
import { useConfirm } from '../lib/confirm.jsx';

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

function Archived({ onRestored }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const { data, setData } = useLoad('/goals/archived');
  const confirm = useConfirm();
  if (!data?.length) return null;
  async function restore(g) {
    try {
      const fresh = await api(`/goals/${g.id}/restore`, { method: 'POST' });
      setData((l) => l.filter((x) => x.id !== g.id));
      onRestored(fresh);
      toast('Objetivo de volta.');
    } catch (e) { toast(e.message); }
  }
  async function destroy(g) {
    if (!(await confirm({ title: `Excluir “${g.title}” de vez?`, message: 'Apaga os registros e os posts dele, com fotos. Não dá para desfazer.', confirmLabel: 'Excluir de vez', danger: true }))) return;
    try {
      await api(`/goals/${g.id}?modo=excluir`, { method: 'DELETE' });
      setData((l) => l.filter((x) => x.id !== g.id));
      toast('Objetivo excluído.');
    } catch (e) { toast(e.message); }
  }
  return (
    <section className="stack gap-8" aria-label="Arquivados">
      <button type="button" className="btn btn-ghost" aria-expanded={open} onClick={() => setOpen((v) => !v)} style={{ alignSelf: 'center' }}>
        Arquivados ({data.length}) <Icon name="chevron" size={16} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform var(--nobi-dur-fast)' }} />
      </button>
      {open && (
        <div className="card flush card-list">
          {data.map((g) => (
            <div key={g.id} className="list-row">
              <span style={{ width: 10, height: 10, borderRadius: 4, background: g.color, flexShrink: 0 }} aria-hidden="true" />
              <span className="grow t-15 strong ellipsis">{g.title}</span>
              <button type="button" className="btn btn-outline sm" onClick={() => restore(g)}>Restaurar</button>
              <button type="button" className="icon-btn plain" aria-label={`Excluir ${g.title} de vez`} onClick={() => destroy(g)}><Icon name="trash" size={18} /></button>
            </div>
          ))}
        </div>
      )}
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
  const update = (g, opts) => setData((l) => (opts?.restored || !l.some((x) => x.id === g.id) ? [...l, g] : l.map((x) => (x.id === g.id ? g : x))));
  const remove = (id) => setData((l) => l.filter((x) => x.id !== id));
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

      <ShieldNotice />
      <Invites onJoined={reload} />
      <PushCard />
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
            {shown.map((g) => <GoalCard key={g.id} goal={g} meId={me.id} onChange={update} onRemove={remove} />)}
            {shown.length === 0 && <p className="muted t-14 center" style={{ padding: 20 }}>Nada por aqui neste filtro.</p>}
          </div>
        </>
      )}
      <Archived onRestored={(g) => update(g, { restored: true })} />
    </div>
  );
}
