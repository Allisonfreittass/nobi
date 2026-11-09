// Comunidade (substitui o Explorar): busca + Desafios · Clubes.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import Broto from '../../components/Broto.jsx';
import PersonRow from '../../components/PersonRow.jsx';
import { Chip, ErrorNote, Sheet, Skeleton } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useLoad, invalidateLoad } from '../../lib/useLoad.js';
import { useBroto, useSession } from '../../lib/session.jsx';
import { useToast } from '../../lib/toast.jsx';
import { CATEGORIES, CATEGORY_ORDER, goalColor } from '../../lib/format.js';
import { ClubGridCard, ClubTile, ChallengeRow, people } from './parts.jsx';

function MyClubCard({ club }) {
  const sub = club.newPosts ? `${club.newPosts} ${club.newPosts === 1 ? 'post novo' : 'posts novos'}` : club.activeChallenge ? 'desafio ativo' : `${people(club.membersCount)} membros`;
  return (
    <Link to={`/clubes/${club.slug}`} className="card row gap-10" style={{ padding: 12, borderRadius: 20, minWidth: 0 }}>
      <ClubTile club={club} size={44} icon />
      <span className="stack" style={{ gap: 2, minWidth: 0 }}>
        <span className="strong t-14" style={{ lineHeight: 1.25, overflowWrap: 'anywhere' }}>{club.name}</span>
        <span className="t-12 secondary">{club.kind === 'private' ? `Grupo privado · ${sub}` : sub}</span>
      </span>
    </Link>
  );
}

const INTEREST_HINTS = {
  treino: ['Corrida', 'Musculação', 'Ciclismo', 'Yoga'], leitura: ['Leitura', 'Clube do livro'], estudo: ['Idiomas', 'Concursos', 'Faculdade'],
  habito: ['Hábitos', 'Acordar cedo', 'Meditação'], projeto: ['Carreira', 'Projetos pessoais'], objetivo: ['Fé e devocional', 'Finanças'],
};

/** Criar clube: Aberto (qualquer pessoa entra, você vira admin) ou Só amigos (grupo privado). */
function NewClubSheet({ open, onClose, onCreated }) {
  const { me } = useSession();
  const toast = useToast();
  const [kind, setKind] = useState('open');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('treino');
  const [interest, setInterest] = useState('');
  const [online, setOnline] = useState(!me.city);
  const [city, setCity] = useState(me.city || '');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState([]);
  const [friends, setFriends] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isOpen = kind === 'open';
  useEffect(() => {
    if (!open || isOpen || friends) return;
    api(`/users/${me.username}/following`).then((r) => setFriends(r.people.filter((p) => p.relation?.friends))).catch(() => setFriends([]));
  }, [open, isOpen, friends, me.username]);
  const flip = (id) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  async function create() {
    setBusy(true);
    setError(null);
    try {
      const body = isOpen
        ? { kind: 'open', name, category, interest, city: online ? '' : city, description }
        : { kind: 'private', name, category, invite: picked };
      const c = await api('/clubs', { method: 'POST', body });
      invalidateLoad('/community');
      toast(isOpen ? 'Clube criado. Você é admin dele.' : picked.length ? `Grupo criado. ${picked.length === 1 ? 'Convite enviado' : 'Convites enviados'}.` : 'Grupo criado. Chame a galera pelo link.');
      onCreated(c);
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  const ready = name.trim().length >= 3 && (isOpen ? (online || city.trim()) : true);
  return (
    <Sheet open={open} onClose={onClose} title="Criar clube">
      <div className="segmented" role="group" aria-label="Tipo de clube">
        <button type="button" aria-pressed={isOpen} onClick={() => setKind('open')}>Aberto</button>
        <button type="button" aria-pressed={!isOpen} onClick={() => setKind('private')}>Só amigos</button>
      </div>
      <p className="t-14 secondary">
        {isOpen
          ? 'Qualquer pessoa encontra e entra. Você vira admin: fixa recado, escreve as regras e modera o que aparece.'
          : 'Um grupo só de vocês: feed, ranking da semana e desafios. Ninguém de fora vê.'}
      </p>
      <label className="field">Nome<input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={isOpen ? 'Corredores de Lavras' : 'Corredores do prédio'} /></label>
      <div className="stack gap-8">
        <span className="t-14 strong">Categoria</span>
        <span className="t-13 muted">Posts Públicos dessa categoria dos membros aparecem no clube.</span>
        <div className="chips" role="group" aria-label="Categoria">
          {CATEGORY_ORDER.map((c) => (
            <Chip key={c} small on={category === c} onClick={() => { setCategory(c); setInterest(''); }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: CATEGORIES[c].color }} aria-hidden="true" />{CATEGORIES[c].label}
            </Chip>
          ))}
        </div>
      </div>
      {isOpen && (
        <>
          <div className="stack gap-8">
            <label className="field">Interesse (opcional)
              <input className="input" value={interest} maxLength={30} onChange={(e) => setInterest(e.target.value)} placeholder={INTEREST_HINTS[category][0]} />
            </label>
            <div className="row gap-6 wrap">
              {INTEREST_HINTS[category].map((i) => <Chip key={i} small on={interest === i} onClick={() => setInterest(interest === i ? '' : i)}>{i}</Chip>)}
            </div>
          </div>
          <div className="row-group">
            <label className="select-row">
              <span className="grow stack" style={{ gap: 1 }}><span className="t-15" style={{ fontWeight: 500 }}>Online</span><span className="t-13 muted">sem cidade, para gente de qualquer lugar</span></span>
              <span className="switch"><input type="checkbox" role="switch" checked={online} onChange={(e) => setOnline(e.target.checked)} aria-label="Clube online" /></span>
            </label>
          </div>
          {!online && <label className="field">Cidade<input className="input" value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} placeholder="Lavras, MG" /></label>}
          <label className="field">Sobre o clube (opcional)<textarea className="textarea" rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Treinos de rua no fim de semana, todo ritmo é bem-vindo." /></label>
        </>
      )}
      {!isOpen && (
        <div className="stack gap-8">
          <span className="t-14 strong">Convidar amigos (opcional) {picked.length > 0 && <span className="muted">· {picked.length}</span>}</span>
          <span className="t-13 muted">Eles recebem um convite e decidem se entram. Depois de criar, você também ganha um link do grupo para mandar a quem quiser.</span>
          {!friends && <Skeleton height={60} />}
          {friends?.length === 0 && <p className="t-14 muted">Você ainda não tem amigos no app. Sem problema: mande o link do grupo depois de criar.</p>}
          {friends?.length > 0 && (
            <div className="card flush card-list">
              {friends.map((f) => (
                <label key={f.id} className="list-row" style={{ cursor: 'pointer', minHeight: 52 }}>
                  <input type="checkbox" checked={picked.includes(f.id)} onChange={() => flip(f.id)} style={{ width: 20, height: 20, accentColor: 'var(--nobi-tinta)' }} />
                  <span className="t-15 strong grow ellipsis">{f.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      <ErrorNote error={error} />
      <button type="button" className="btn btn-dark block" disabled={busy || !ready} onClick={create}>{busy ? 'Criando…' : isOpen ? 'Criar clube' : 'Criar grupo'}</button>
    </Sheet>
  );
}

function Suggestions() {
  const { data, setData } = useLoad('/users/suggestions');
  if (!data?.length) return null;
  return (
    <section className="stack gap-10" aria-label="Pessoas para seguir">
      <h2 className="title t-20">Pessoas para seguir</h2>
      <div className="card flush card-list">
        {data.slice(0, 5).map((u) => <PersonRow key={u.id} u={u} onRelation={(relation) => setData(data.map((x) => (x.id === u.id ? { ...x, relation } : x)))} />)}
      </div>
    </section>
  );
}

function Clubs() {
  const broto = useBroto();
  const { data, error, reload, setData } = useLoad('/community');
  const [interest, setInterest] = useState(null);
  const [byInterest, setByInterest] = useState(null);
  const [group, setGroup] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (!interest) { setByInterest(null); return; }
    setByInterest(null);
    api(`/clubs?interest=${encodeURIComponent(interest)}`).then(setByInterest).catch(() => setByInterest([]));
  }, [interest]);

  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <><Skeleton height={80} /><Skeleton height={260} /></>;

  const joined = (c) => {
    const mark = (list) => list.map((x) => (x.id === c.id ? { ...x, ...c } : x));
    setData({ ...data, myClubs: [...data.myClubs, { ...c, newPosts: 0 }], nearby: { ...data.nearby, clubs: mark(data.nearby.clubs) } });
    setByInterest((l) => (l ? mark(l) : l));
  };

  return (
    <>
      <section className="stack gap-10" aria-label="Seus clubes">
        <div className="row between">
          <h2 className="title t-20">Seus clubes</h2>
          <button type="button" className="btn btn-ghost sm" onClick={() => setGroup(true)}><Icon name="plus" size={16} /> Criar clube</button>
        </div>
        {data.myClubs.length > 0
          ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>{data.myClubs.map((c) => <MyClubCard key={c.id} club={c} />)}</div>
          : (
            <div className="card empty">
              <div className="broto-plate"><Broto size={96} expression="padrao" {...broto} /></div>
              <h3 className="title t-20">Entre num clube pra evoluir com mais gente</h3>
              <p className="secondary t-14" style={{ maxWidth: 300 }}>Clubes juntam gente com o mesmo objetivo: seus posts Públicos da categoria aparecem lá. Não achou o seu? Crie um.</p>
            </div>
          )}
      </section>

      <section className="stack gap-10" aria-label="Perto de você">
        <div className="row gap-8">
          <Icon name="globe" size={18} />
          <h2 className="title t-20">Perto de você</h2>
          {data.nearby.label && <span className="t-13 secondary">{data.nearby.label}</span>}
        </div>
        {data.needsCity && (
          <Link to="/perfil/editar" className="card row gap-12 tap" style={{ padding: 14 }}>
            <span className="grow t-14">Diga sua cidade para ver os clubes da sua região.</span>
            <span className="btn sm btn-dark">Adicionar</span>
          </Link>
        )}
        {!data.needsCity && data.nearby.clubs.length === 0 && <p className="t-14 secondary">Ainda não tem clube na sua região. Que tal criar o primeiro?</p>}
        {data.nearby.clubs.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {data.nearby.clubs.map((c) => <ClubGridCard key={c.id} club={c} onJoined={joined} />)}
          </div>
        )}
      </section>

      <section className="stack gap-10" aria-label="Por interesse">
        <h2 className="title t-20">Por interesse</h2>
        <div className="row gap-8 wrap">
          {data.interests.map((i) => (
            <Chip key={i.interest} on={interest === i.interest} onClick={() => setInterest(interest === i.interest ? null : i.interest)}>
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 4, background: goalColor(CATEGORIES[i.category]?.color) }} />{i.interest}
            </Chip>
          ))}
        </div>
        {interest && !byInterest && <Skeleton height={200} />}
        {byInterest?.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {byInterest.map((c) => <ClubGridCard key={c.id} club={c} onJoined={joined} />)}
          </div>
        )}
      </section>
      <Suggestions />
      <NewClubSheet open={group} onClose={() => setGroup(false)} onCreated={(c) => { setGroup(false); joined(c); navigate(`/clubes/${c.slug}`); }} />
    </>
  );
}

function Challenges() {
  const { data, error, reload, setData } = useLoad('/community/challenges');
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <><Skeleton height={170} /><Skeleton height={80} /></>;
  const onJoined = (id) => setData({
    featured: data.featured?.id === id ? { ...data.featured, joined: true, participants: data.featured.participants + 1 } : data.featured,
    list: data.list.map((c) => (c.id === id ? { ...c, joined: true, participants: c.participants + 1 } : c)),
  });
  const f = data.featured;
  return (
    <>
      {f && (
        <Link to={`/desafios/${f.id}`} className="block-orbita stack gap-8" style={{ padding: 18, borderRadius: 24 }}>
          <span className="label-caps t-12">Desafio da comunidade</span>
          <span className="title" style={{ fontSize: 'var(--nobi-text-3xl, 1.5rem)', fontWeight: 800, lineHeight: 1.1 }}>{f.title}</span>
          <span className="t-14">{people(f.participants)} participando{f.daysLeft != null ? ` · termina em ${f.daysLeft} ${f.daysLeft === 1 ? 'dia' : 'dias'}` : ''}</span>
          <span className="btn sm" style={{ alignSelf: 'flex-start', marginTop: 4, background: '#FFFFFF', color: '#141218' }}>{f.joined ? 'Você está dentro ✓' : 'Ver desafio'}</span>
        </Link>
      )}
      {data.list.map((ch) => <ChallengeRow key={ch.id} ch={ch} canJoin={!ch.club || ch.club.member} onJoined={onJoined} />)}
      {!f && data.list.length === 0 && <p className="t-14 secondary">Nenhum desafio aberto agora. Entre em clubes para ver os desafios deles.</p>}
      <Link to="/desafios" className="card row gap-12 tap" style={{ padding: '14px 16px' }}>
        <Icon name="users" size={20} />
        <span className="grow stack" style={{ gap: 1 }}><span className="strong t-15">Seus desafios com amigos</span><span className="t-13 muted">criados por você ou para os quais te convidaram</span></span>
        <Icon name="chevron" size={18} />
      </Link>
    </>
  );
}

function SearchResults({ q }) {
  const broto = useBroto();
  const [r, setR] = useState(null);
  useEffect(() => {
    setR(null);
    const t = setTimeout(() => api(`/community/search?q=${encodeURIComponent(q)}`).then(setR).catch(() => setR({ clubs: [], challenges: [], people: [] })), 300);
    return () => clearTimeout(t);
  }, [q]);
  if (!r) return <Skeleton height={160} />;
  const none = !r.clubs.length && !r.challenges.length && !r.people.length;
  return (
    <section className="stack gap-14" aria-label="Resultados">
      {none && (
        <div className="card empty">
          <div className="broto-plate"><Broto size={96} expression="foco" {...broto} /></div>
          <h2 className="title t-20">Nada encontrado para “{q}”</h2>
          <p className="secondary t-14" style={{ maxWidth: 300 }}>Tente outra palavra, o nome de um clube ou um @usuário.</p>
        </div>
      )}
      {r.clubs.length > 0 && (
        <div className="stack gap-10"><h2 className="title t-18">Clubes</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {r.clubs.map((c) => <ClubGridCard key={c.id} club={c} onJoined={(x) => setR({ ...r, clubs: r.clubs.map((y) => (y.id === x.id ? x : y)) })} />)}
          </div>
        </div>
      )}
      {r.challenges.length > 0 && (
        <div className="stack gap-10"><h2 className="title t-18">Desafios</h2>
          {r.challenges.map((ch) => <ChallengeRow key={ch.id} ch={ch} canJoin={!ch.clubId} onJoined={() => setR({ ...r, challenges: r.challenges.map((y) => (y.id === ch.id ? { ...y, joined: true } : y)) })} />)}
        </div>
      )}
      {r.people.length > 0 && (
        <div className="stack gap-10"><h2 className="title t-18">Pessoas</h2>
          <div className="card flush card-list">
            {r.people.map((u) => <PersonRow key={u.id} u={u} onRelation={(relation) => setR({ ...r, people: r.people.map((x) => (x.id === u.id ? { ...x, relation } : x)) })} />)}
          </div>
        </div>
      )}
    </section>
  );
}

export default function Community() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('aba') === 'desafios' ? 'desafios' : 'clubes';
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const setTab = (t) => setParams(t === 'clubes' ? {} : { aba: t }, { replace: true });
  return (
    <div className="screen">
      <header className="screen-head">
        <h1 className="title t-30">Comunidade</h1>
        <button type="button" className="icon-btn" aria-label={searching ? 'Fechar busca' : 'Buscar clubes, desafios e pessoas'} aria-expanded={searching} onClick={() => { setSearching((s) => !s); setQ(''); }}>
          <Icon name={searching ? 'close' : 'search'} />
        </button>
      </header>
      {searching && (
        <label className="input-prefix" style={{ display: 'block' }}>
          <span aria-hidden="true" style={{ display: 'flex' }}><Icon name="search" size={18} /></span>
          <span className="sr-only">Buscar</span>
          <input className="input" type="search" autoFocus style={{ paddingLeft: 44 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Clubes, desafios, pessoas ou @" />
        </label>
      )}
      {searching && q.trim().length >= 2 ? <SearchResults q={q.trim()} /> : (
        <>
          <div role="tablist" aria-label="Seção" className="segmented bg-segment">
            {[['desafios', 'Desafios'], ['clubes', 'Clubes']].map(([v, label]) => (
              <button key={v} type="button" role="tab" aria-selected={tab === v} aria-pressed={tab === v} onClick={() => setTab(v)}>{label}</button>
            ))}
          </div>
          {tab === 'clubes' ? <Clubs /> : <Challenges />}
        </>
      )}
    </div>
  );
}
