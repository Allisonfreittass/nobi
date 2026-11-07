import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import PostCard from '../components/PostCard.jsx';
import { Avatar, Skeleton } from '../components/ui.jsx';
import Broto from '../components/Broto.jsx';
import { useLoad } from '../lib/useLoad.js';
import InviteSheet from '../components/InviteSheet.jsx';
import { useSession } from '../lib/session.jsx';
import { shareInvite } from '../lib/invite.js';
import { useToast } from '../lib/toast.jsx';
import { api } from '../lib/api.js';

function PersonRow({ u, onRelation }) {
  const toast = useToast();
  const rel = u.relation;
  const label = rel.following === 'accepted' ? (rel.friends ? 'Amigos' : 'Seguindo') : rel.following === 'pending' ? 'Pedido enviado' : rel.followsMe ? 'Seguir de volta' : 'Seguir';
  async function click() {
    try {
      const r = await api(`/users/${u.id}/follow`, { method: rel.following === 'none' ? 'POST' : 'DELETE' });
      onRelation(r.relation);
    } catch (e) { toast(e.message); }
  }
  return (
    <div className="list-row">
      <Link to={`/u/${u.username}`} className="row gap-12 grow" style={{ minWidth: 0 }}>
        <Avatar user={u} size={44} />
        <span className="stack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="strong t-15 ellipsis">{u.name}</span>
          <span className="t-13 muted ellipsis">@{u.username}{u.bio ? ` · ${u.bio}` : ''}</span>
        </span>
      </Link>
      <button type="button" className={`btn sm ${rel.following === 'none' ? 'btn-primary' : 'btn-outline'}`} aria-pressed={rel.following !== 'none'} onClick={click}>{label}</button>
    </div>
  );
}

function Invite() {
  const { me } = useSession();
  const [sheet, setSheet] = useState(false);
  async function share() {
    if ((await shareInvite(me.username)) === 'unavailable') setSheet(true);
  }
  return (
    <div className="card empty">
      <div className="block-brasa" style={{ borderRadius: 24, padding: '16px 24px 6px' }}><Broto size={96} arms="wave" /></div>
      <h2 className="title t-20">Fica melhor com amigos</h2>
      <p className="secondary t-14" style={{ maxWidth: 300 }}>Mande seu link. Quem entrar por ele já vira seu amigo: um acompanha a evolução do outro e dá para criar desafios juntos.</p>
      <button type="button" className="btn btn-dark" onClick={share}><Icon name="share" size={18} /> Convidar amigos</button>
      <InviteSheet open={sheet} onClose={() => setSheet(false)} username={me.username} />
    </div>
  );
}

function People({ list, setList }) {
  return (
    <div className="card flush card-list">
      {list.map((u) => <PersonRow key={u.id} u={u} onRelation={(relation) => setList((l) => l.map((x) => (x.id === u.id ? { ...x, relation } : x)))} />)}
    </div>
  );
}

export default function Explore() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const sugg = useLoad('/users/suggestions');
  const posts = useLoad('/feed/explore');

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return undefined; }
    const t = setTimeout(() => api(`/users/search?q=${encodeURIComponent(q.trim())}`).then(setResults).catch(() => setResults([])), 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="screen">
      <h1 className="title t-30">Explorar</h1>
      <label className="input-prefix" style={{ display: 'block' }}>
        <span aria-hidden="true" style={{ display: 'flex' }}><Icon name="search" size={18} /></span>
        <span className="sr-only">Buscar pessoas</span>
        <input className="input" type="search" style={{ paddingLeft: 44 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoas por nome ou @" />
      </label>

      {results ? (
        <section className="stack gap-10" aria-label="Resultados">
          {results.length ? <People list={results} setList={setResults} /> : <p className="muted t-14">Ninguém encontrado.</p>}
        </section>
      ) : (
        <>
          {sugg.data?.length > 0 && (
            <section className="stack gap-10" aria-label="Sugestões">
              <h2 className="title t-20">Pessoas para seguir</h2>
              <People list={sugg.data} setList={sugg.setData} />
            </section>
          )}
          {!posts.data && <Skeleton height={200} />}
          {posts.data?.length > 0 && (
            <section className="stack gap-12" aria-label="Em alta">
              <h2 className="title t-20">Em alta no público</h2>
              {posts.data.map((p) => <PostCard key={p.id} post={p} />)}
            </section>
          )}
          {posts.data?.length === 0 && sugg.data && <Invite />}
        </>
      )}
    </div>
  );
}
