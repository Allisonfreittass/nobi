import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Broto from '../components/Broto.jsx';
import GoalCard from '../components/GoalCard.jsx';
import { PushCard } from '../components/PushPrompt.jsx';
import { ShieldNotice } from '../components/Shields.jsx';
import { Avatar, Segmented } from '../components/ui.jsx';
import Hoje from './metas/Hoje.jsx';
import { Semana, Mes, Concluidas } from './metas/Periodo.jsx';
import { useLoad, invalidateLoad } from '../lib/useLoad.js';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { api } from '../lib/api.js';
import { longToday } from '../lib/format.js';
import { useConfirm } from '../lib/confirm.jsx';

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

const VIEWS = [['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês'], ['concluidas', 'Concluídas']];

export default function Goals() {
  const { me } = useSession();
  const [params, setParams] = useSearchParams();
  const view = VIEWS.some(([v]) => v === params.get('visao')) ? params.get('visao') : 'hoje';
  const { reload } = useLoad('/goals');
  const [round, setRound] = useState(0);

  return (
    <div className="screen">
      <header className="screen-head">
        <div className="stack" style={{ gap: 2 }}>
          <span className="t-14 secondary">{longToday()}</span>
          <h1 className="title t-30">Metas</h1>
        </div>
        <Link to="/metas/novo" className="btn btn-dark sm"><Icon name="plus" size={18} /> Novo</Link>
      </header>

      <Segmented label="Período" className="bg-segment" value={view} options={VIEWS}
        onChange={(v) => setParams(v === 'hoje' ? {} : { visao: v }, { replace: true })} />

      {view === 'hoje' && (
        <>
          <ShieldNotice />
          <Invites onJoined={reload} />
          <PushCard />
        </>
      )}
      {view === 'hoje' && <Hoje key={round} me={me} />}
      {view === 'semana' && <Semana me={me} />}
      {view === 'mes' && <Mes me={me} />}
      {view === 'concluidas' && <Concluidas />}
      {view === 'hoje' && <Archived onRestored={() => { invalidateLoad('/metas?view=hoje'); setRound((n) => n + 1); }} />}
    </div>
  );
}
