// Clube: cabeçalho na cor da categoria + Feed · Desafios · Ranking · Membros (Clube.dc.html)
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import Broto from '../../components/Broto.jsx';
import PostCard from '../../components/PostCard.jsx';
import PersonRow from '../../components/PersonRow.jsx';
import ReportSheet from '../../components/ReportSheet.jsx';
import { Avatar, ErrorNote, Sheet, Skeleton } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useLoad, invalidateLoad } from '../../lib/useLoad.js';
import { useBroto, useSession } from '../../lib/session.jsx';
import { useToast } from '../../lib/toast.jsx';
import { useConfirm } from '../../lib/confirm.jsx';
import { useStatusBar } from '../../lib/statusBar.js';
import { CATEGORIES, firstName } from '../../lib/format.js';
import { ChallengeRow, clubColor, people, useJoin } from './parts.jsx';

const TABS = [['feed', 'Feed'], ['desafios', 'Desafios'], ['ranking', 'Ranking'], ['membros', 'Membros']];
const ROLE = { admin: 'Admin', moderator: 'Moderador' };

function friendsLine(club) {
  const names = club.friendsInside.slice(0, 2).map((u) => firstName(u.name));
  const rest = club.friendsIn - names.length;
  if (!names.length) return null;
  if (rest <= 0) return names.join(' e ');
  return `${names.join(', ')} e mais ${rest} ${rest === 1 ? 'amigo' : 'amigos'}`;
}

function Header({ club, onJoin, joining, onMenu, onShare }) {
  const navigate = useNavigate();
  const bg = clubColor(club);
  const cat = CATEGORIES[club.category];
  const line = friendsLine(club);
  return (
    <header style={{ background: bg, color: '#FFFFFF', padding: 'calc(16px + env(safe-area-inset-top)) 20px 20px', borderRadius: '0 0 28px 28px' }}>
      <div className="stack gap-14" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="row between">
          <button type="button" className="icon-btn on-color" aria-label="Voltar" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/comunidade'))}><Icon name="back" /></button>
          <div className="row gap-8">
            <button type="button" className="icon-btn on-color" aria-label={club.kind === 'private' ? 'Convidar amigos' : 'Compartilhar clube'} onClick={onShare}><Icon name="share" /></button>
            <button type="button" className="icon-btn on-color" aria-label="Mais opções: regras, denunciar, sair do clube" onClick={onMenu}><Icon name="more" /></button>
          </div>
        </div>
        <div className="row gap-14">
          <span aria-hidden="true" style={{ width: 64, height: 64, borderRadius: 20, background: '#FFFFFF', color: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={cat?.icon || 'users'} size={30} />
          </span>
          <div className="stack" style={{ gap: 3, minWidth: 0 }}>
            <h1 className="title" style={{ fontSize: 'var(--nobi-text-3xl, 1.625rem)', fontWeight: 800, lineHeight: 1.05 }}>{club.name}</h1>
            <span className="t-13">{[club.kind === 'private' ? 'Grupo privado' : club.interest, club.city, `${people(club.membersCount)} ${club.membersCount === 1 ? 'membro' : 'membros'}`].filter(Boolean).join(' · ')}</span>
          </div>
        </div>
        <div className="row between gap-12">
          <div className="row gap-8" style={{ minWidth: 0 }}>
            {line && (
              <>
                <span className="row" style={{ paddingLeft: 8 }}>
                  {club.friendsInside.slice(0, 3).map((u) => <span key={u.id} style={{ marginLeft: -8, borderRadius: 99, boxShadow: `0 0 0 2px ${bg}` }}><Avatar user={u} size={28} /></span>)}
                </span>
                <span className="t-13 ellipsis">{line}</span>
              </>
            )}
          </div>
          {club.kind !== 'private' && (club.member
            ? <span className="btn sm" style={{ height: 44, background: 'rgba(255,255,255,0.18)', color: '#FFFFFF', flexShrink: 0 }}>Membro ✓</span>
            : <button type="button" className="btn sm btn-dark" style={{ height: 44, flexShrink: 0, boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.35)' }} disabled={joining || club.banned} onClick={onJoin}>{club.banned ? 'Indisponível' : 'Entrar'}</button>)}
        </div>
      </div>
    </header>
  );
}

function Feed({ club }) {
  const broto = useBroto();
  const { me } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, error, reload, setData } = useLoad(`/clubs/${club.slug}/feed`);
  const [more, setMore] = useState(false);
  const cat = CATEGORIES[club.category];
  const mod = { slug: club.slug, canModerate: club.canModerate };
  const remove = (id) => setData({ ...data, posts: data.posts.filter((p) => p.id !== id) });
  async function loadMore() {
    setMore(true);
    try {
      const r = await api(`/clubs/${club.slug}/feed?before=${encodeURIComponent(data.next)}`);
      setData({ posts: [...data.posts, ...r.posts], next: r.next });
    } finally { setMore(false); }
  }
  return (
    <>
      {club.member && (
        <button type="button" className="card row gap-10 tap" style={{ padding: '10px 12px', borderRadius: 20, border: 'none', textAlign: 'left', width: '100%' }}
          onClick={() => navigate('/registrar', { state: { backgroundLocation: location, preset: { category: club.category, share: true, audience: 'public' } } })}>
          <Avatar user={me} size={36} />
          <span className="grow t-15 muted">Compartilhe {club.category === 'leitura' ? 'sua leitura' : club.category === 'treino' ? 'seu treino' : 'seu avanço'} de hoje…</span>
          <span className="t-12 strong" style={{ padding: '6px 10px', borderRadius: 12, background: 'var(--nobi-track)' }}>Público</span>
        </button>
      )}
      {club.pinned && (
        <div className="row gap-10" style={{ padding: '12px 14px', borderRadius: 18, background: 'var(--nobi-track)', alignItems: 'flex-start' }}>
          <Icon name="flag" size={18} />
          <span className="grow t-13"><strong>Fixado:</strong> {club.pinned}</span>
        </div>
      )}
      <ErrorNote error={error} onRetry={reload} />
      {!data && !error && <><Skeleton height={180} /><Skeleton height={140} /></>}
      {data?.posts.length === 0 && (
        <div className="card empty">
          <div className="broto-plate"><Broto size={96} expression="padrao" {...broto} /></div>
          <h2 className="title t-20">Seja o primeiro a postar</h2>
          <p className="secondary t-14" style={{ maxWidth: 300 }}>Posts <strong>Públicos</strong> de {cat?.label.toLowerCase()} dos membros aparecem no clube.</p>
        </div>
      )}
      {data?.posts.map((p) => (
        <PostCard key={p.id} post={p} club={mod} onRemoved={remove} onDelete={remove}
          note={!p.mine && !p.isFriend ? 'fora dos seus amigos' : null} />
      ))}
      {data?.next && <button type="button" className="btn btn-soft block" disabled={more} onClick={loadMore}>{more ? 'Carregando…' : 'Ver mais'}</button>}
    </>
  );
}

function Challenges({ club }) {
  const { data, error, reload, setData } = useLoad(`/clubs/${club.slug}/challenges`);
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Skeleton height={120} />;
  if (!data.length) return <p className="t-14 secondary">Nenhum desafio no clube agora. A moderação cria desafios de tempos em tempos.</p>;
  const [first, ...rest] = data;
  const joined = (id) => setData(data.map((c) => (c.id === id ? { ...c, joined: true, participants: c.participants + 1 } : c)));
  return (
    <>
      <Link to={`/desafios/${first.id}`} className="card stack gap-6" style={{ padding: 18, borderRadius: 24, boxShadow: `inset 0 0 0 2px ${clubColor(club)}` }}>
        <span className="label-caps t-12" style={{ color: 'var(--nobi-orbita-ink, var(--nobi-orbita))' }}>Desafio do clube</span>
        <span className="title t-22" style={{ fontWeight: 800 }}>{first.title}</span>
        <span className="t-14 secondary">
          {[`${people(first.participants)} participando`, first.myPosition ? `você está em ${first.myPosition}º` : null, first.daysLeft != null ? `termina em ${first.daysLeft} ${first.daysLeft === 1 ? 'dia' : 'dias'}` : null].filter(Boolean).join(' · ')}
        </span>
      </Link>
      {!first.joined && club.member && <ChallengeRow ch={{ ...first, club: null }} onJoined={joined} />}
      {rest.map((ch) => <ChallengeRow key={ch.id} ch={ch} canJoin={club.member} onJoined={joined} />)}
    </>
  );
}

function Ranking({ club }) {
  const { data, error, reload } = useLoad(`/clubs/${club.slug}/ranking`);
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Skeleton height={160} />;
  const byMinutes = data.some((r) => r.minutes > 0);
  const word = CATEGORIES[club.category]?.label.toLowerCase();
  return (
    <>
      {data.length === 0
        ? <p className="t-14 secondary">Ninguém postou no clube nesta semana ainda. O primeiro post Público já entra no ranking.</p>
        : (
          <ol className="card flush card-list" aria-label="Ranking da semana" style={{ padding: '4px 16px' }}>
            {data.map((r) => (
              <li key={r.user.id} className="row gap-12" style={{ minHeight: 52, padding: 0, background: r.me ? 'var(--nobi-bg)' : undefined }}>
                <span className="strong" style={{ width: 24, fontWeight: 800 }}>{r.position}</span>
                <Link to={`/u/${r.user.username}`} className="row gap-10 grow" style={{ minWidth: 0 }}>
                  <Avatar user={r.user} size={32} />
                  <span className="strong ellipsis">{r.me ? 'Você' : r.user.name}</span>
                </Link>
                <span className="num" style={{ fontWeight: 800 }}>{byMinutes ? `${r.minutes} min` : `${r.posts} ${r.posts === 1 ? 'post' : 'posts'}`}</span>
              </li>
            ))}
          </ol>
        )}
      <span className="t-12 secondary">{byMinutes ? `Minutos de ${word} postados no clube nesta semana.` : 'Posts no clube nesta semana.'} Zera no domingo.</span>
    </>
  );
}

function MemberActions({ club, member, open, onClose, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  async function act(action) {
    if (action === 'ban' && !(await confirm({ title: `Banir ${member.name}?`, message: 'A pessoa sai do clube, os posts dela somem do feed do clube e ela não pode voltar.', confirmLabel: 'Banir', danger: true }))) return;
    try {
      await api(`/clubs/${club.slug}/members/${member.id}/${action}`, { method: 'POST' });
      toast(action === 'ban' ? 'Pessoa banida do clube.' : action === 'unban' ? 'Banimento desfeito.' : 'Papel atualizado.');
      onChanged();
      onClose();
    } catch (e) { toast(e.message); }
  }
  const isAdmin = club.role === 'admin';
  return (
    <Sheet open={open} onClose={onClose} title={member.name}>
      <div className="card flush card-list">
        {member.status === 'banned'
          ? <button type="button" className="list-row" onClick={() => act('unban')}><Icon name="check" size={20} /><span className="t-15 strong grow">Desfazer banimento</span></button>
          : (
            <>
              {isAdmin && member.role === 'member' && <button type="button" className="list-row" onClick={() => act('moderator')}><Icon name="shield" size={20} /><span className="t-15 strong grow">Tornar moderador</span></button>}
              {isAdmin && member.role === 'moderator' && <button type="button" className="list-row" onClick={() => act('member')}><Icon name="user" size={20} /><span className="t-15 strong grow">Tirar moderação</span></button>}
              {member.role !== 'admin' && <button type="button" className="list-row" style={{ color: 'var(--nobi-danger)' }} onClick={() => act('ban')}><Icon name="ban" size={20} /><span className="t-15 strong grow">Banir do clube</span></button>}
            </>
          )}
      </div>
    </Sheet>
  );
}

function Members({ club, onInvite }) {
  const [banned, setBanned] = useState(false);
  const { data, error, reload, setData } = useLoad(`/clubs/${club.slug}/members${banned ? '?banned=1' : ''}`);
  const [acting, setActing] = useState(null);
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  return (
    <>
      {club.kind === 'private' && club.member && (
        <button type="button" className="btn btn-soft block" onClick={onInvite}><Icon name="plus" size={16} /> Convidar amigos</button>
      )}
      {club.canModerate && (
        <div className="segmented compact bg-segment" role="group" aria-label="Lista">
          <button type="button" aria-pressed={!banned} onClick={() => setBanned(false)}>Membros</button>
          <button type="button" aria-pressed={banned} onClick={() => setBanned(true)}>Banidos</button>
        </div>
      )}
      {!data ? <Skeleton height={200} /> : data.length === 0 ? <p className="t-14 secondary">{banned ? 'Ninguém banido.' : 'Ninguém por aqui ainda.'}</p> : (
        <div className="card flush card-list">
          {data.map((u) => (
            <PersonRow key={u.id} u={{ ...u, bio: [ROLE[u.role], u.relation.friends && !u.relation.self ? 'amizade' : ''].filter(Boolean).join(' · ') }}
              onRelation={(relation) => setData(data.map((x) => (x.id === u.id ? { ...x, relation } : x)))}
              extra={(
                <>
                  {club.canModerate && !u.relation.self && u.role !== 'admin' && (
                    <button type="button" className="icon-btn plain" aria-label={`Moderar ${u.name}`} style={{ width: 36 }} onClick={() => setActing(u)}><Icon name="more" size={18} /></button>
                  )}
                </>
              )} />
          ))}
        </div>
      )}
      {acting && <MemberActions club={club} member={acting} open={Boolean(acting)} onClose={() => setActing(null)} onChanged={reload} />}
    </>
  );
}

/** Grupo privado: escolher amigos que ainda não estão no grupo e trazê-los para dentro. */
function InviteSheet({ club, open, onClose, onInvited }) {
  const { me } = useSession();
  const toast = useToast();
  const [friends, setFriends] = useState(null);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setPicked([]);
    setFriends(null);
    Promise.all([api(`/users/${me.username}/following`), api(`/clubs/${club.slug}/members`)])
      .then(([f, members]) => {
        const inside = new Set(members.map((u) => u.id));
        setFriends(f.people.filter((p) => p.relation?.friends && !inside.has(p.id)));
      })
      .catch(() => setFriends([]));
  }, [open, me.username, club.slug]);
  const flip = (id) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  async function send() {
    setBusy(true);
    try {
      const r = await api(`/clubs/${club.slug}/invite`, { method: 'POST', body: { invite: picked } });
      toast(r.added === 1 ? '1 amigo entrou no grupo.' : `${r.added} amigos entraram no grupo.`);
      onInvited();
      onClose();
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Convidar amigos">
      <p className="t-14 secondary">Quem você escolher entra direto no grupo. Só aparecem amigos (vocês se seguem) que ainda não estão aqui.</p>
      {!friends && <Skeleton height={60} />}
      {friends?.length === 0 && <p className="t-14 muted">Todos os seus amigos já estão no grupo.</p>}
      {friends?.length > 0 && (
        <div className="card flush card-list">
          {friends.map((f) => (
            <label key={f.id} className="list-row" style={{ cursor: 'pointer', minHeight: 52 }}>
              <input type="checkbox" checked={picked.includes(f.id)} onChange={() => flip(f.id)} style={{ width: 20, height: 20, accentColor: 'var(--nobi-tinta)' }} />
              <Avatar user={f} size={32} />
              <span className="t-15 strong grow ellipsis">{f.name}</span>
            </label>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-dark block" disabled={busy || !picked.length} onClick={send}>
        {busy ? 'Convidando…' : picked.length ? `Convidar ${picked.length}` : 'Escolha pelo menos 1 amigo'}
      </button>
    </Sheet>
  );
}

/** Denúncias abertas do clube, para a moderação resolver. */
function ReportsSheet({ club, open, onClose, onChanged }) {
  const toast = useToast();
  const [list, setList] = useState(null);
  useEffect(() => { if (open) api(`/clubs/${club.slug}/reports`).then(setList).catch(() => setList([])); }, [open, club.slug]);
  const REASON = { spam: 'Spam', assedio: 'Assédio', improprio: 'Impróprio', falso: 'Falso', outro: 'Outro' };
  async function resolve(r, how) {
    try {
      if (how === 'remover') await api(`/clubs/${club.slug}/posts/${r.targetId}/remove`, { method: 'POST' });
      else if (how === 'banir') await api(`/clubs/${club.slug}/members/${r.targetId}/ban`, { method: 'POST' });
      else await api(`/reports/${r.id}/resolve`, { method: 'POST', body: { resolution: 'mantido' } });
      setList((l) => l.filter((x) => x.id !== r.id));
      onChanged();
      toast('Denúncia resolvida.');
    } catch (e) { toast(e.message); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Denúncias">
      {!list && <Skeleton height={120} />}
      {list?.length === 0 && <p className="t-14 secondary">Nenhuma denúncia aberta.</p>}
      {list?.map((r) => (
        <div key={r.id} className="card stack gap-10">
          <span className="t-13 strong">{REASON[r.reason]}{r.details ? ` · ${r.details}` : ''}</span>
          {r.post && <span className="t-14 secondary">Post de {r.post.user.name}: “{r.post.text || r.post.title}”</span>}
          {r.user && <span className="t-14 secondary">Conta: {r.user.name} (@{r.user.username})</span>}
          {!r.post && !r.user && <span className="t-14 muted">O conteúdo já foi apagado.</span>}
          <div className="row gap-8 wrap">
            {r.targetType === 'post' && r.post && <button type="button" className="btn sm btn-dark" onClick={() => resolve(r, 'remover')}>Remover do clube</button>}
            {r.targetType === 'user' && r.user && <button type="button" className="btn sm btn-dark" onClick={() => resolve(r, 'banir')}>Banir</button>}
            <button type="button" className="btn sm btn-soft" onClick={() => resolve(r, 'manter')}>Manter</button>
          </div>
        </div>
      ))}
    </Sheet>
  );
}

function EditSheet({ club, open, onClose, onSaved }) {
  const toast = useToast();
  const [pinned, setPinned] = useState(club.pinned || '');
  const [rules, setRules] = useState(club.rules || '');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api(`/clubs/${club.slug}`, { method: 'PATCH', body: { pinned, rules } });
      toast('Clube atualizado.');
      onSaved();
      onClose();
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Recado e regras">
      <label className="field">Recado fixado<textarea className="textarea" rows={2} maxLength={280} value={pinned} onChange={(e) => setPinned(e.target.value)} placeholder="Livro de novembro: …" /></label>
      <label className="field">Regras<textarea className="textarea" rows={6} maxLength={1500} value={rules} onChange={(e) => setRules(e.target.value)} placeholder="Uma regra por linha" /></label>
      <button type="button" className="btn btn-dark block" disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar'}</button>
    </Sheet>
  );
}

export default function Club() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([v]) => v === params.get('aba')) ? params.get('aba') : 'feed';
  const { data: club, error, reload, setData } = useLoad(`/clubs/${slug}`);
  const [sheet, setSheet] = useState(null); // menu | rules | report | reports | edit | invite
  const [membersKey, setMembersKey] = useState(0);
  const { join, busy } = useJoin((c) => { setData({ ...club, ...c }); invalidateLoad(`/clubs/${slug}/feed`); });
  useStatusBar(club ? clubColor(club) : null);

  if (error) return <div className="screen"><ErrorNote error={error} onRetry={reload} /><Link to="/comunidade" className="btn btn-soft">Voltar para a Comunidade</Link></div>;
  if (!club) return <div className="screen"><Skeleton height={200} /><Skeleton height={300} /></div>;

  async function share() {
    const url = `${window.location.origin}/clubes/${club.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: club.name, text: `Bora evoluir junto no clube ${club.name} do Nobi`, url });
      else { await navigator.clipboard.writeText(url); toast('Link copiado.'); }
    } catch { /* cancelou */ }
  }
  async function leave() {
    setSheet(null);
    if (!(await confirm({ title: `Sair de ${club.name}?`, message: 'Seus posts continuam no seu perfil. Dá para voltar quando quiser.', confirmLabel: 'Sair do clube', danger: true }))) return;
    const r = await api(`/clubs/${club.slug}/membership`, { method: 'DELETE' });
    invalidateLoad('/community');
    toast(r.deleted ? 'Você era a última pessoa do clube, então ele foi encerrado.' : 'Você saiu do clube.');
    if (club.kind === 'private' || r.deleted) navigate('/comunidade', { replace: true });
    else reload();
  }
  const Item = ({ icon, label, desc, onClick, danger }) => (
    <button type="button" className="list-row" onClick={onClick} style={{ color: danger ? 'var(--nobi-danger)' : undefined }}>
      <Icon name={icon} size={20} />
      <span className="grow stack" style={{ gap: 1 }}><span className="t-15 strong">{label}</span>{desc && <span className="t-13 muted">{desc}</span>}</span>
    </button>
  );

  return (
    <div style={{ minHeight: '100dvh' }}>
      <Header club={club} onJoin={() => join(club)} joining={busy} onMenu={() => setSheet('menu')} onShare={club.kind === 'private' ? () => setSheet('invite') : share} />
      <div className="screen" style={{ paddingTop: 16 }}>
        <div role="tablist" aria-label="Seção do clube" className="segmented bg-segment">
          {TABS.map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={tab === v} aria-pressed={tab === v} onClick={() => setParams(v === 'feed' ? {} : { aba: v }, { replace: true })}>{label}</button>
          ))}
        </div>
        {tab === 'feed' && <Feed club={club} />}
        {tab === 'desafios' && <Challenges club={club} />}
        {tab === 'ranking' && <Ranking club={club} />}
        {tab === 'membros' && <Members key={membersKey} club={club} onInvite={() => setSheet('invite')} />}
      </div>

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title={club.name}>
        <div className="card flush card-list">
          {club.kind === 'private' && club.member && <Item icon="plus" label="Convidar amigos" desc="eles entram direto no grupo" onClick={() => setSheet('invite')} />}
          <Item icon="help" label="Regras" desc="o combinado do clube" onClick={() => setSheet('rules')} />
          {club.canModerate && <Item icon="edit" label="Recado e regras" desc="moderação" onClick={() => setSheet('edit')} />}
          {club.canModerate && <Item icon="shield" label={`Denúncias${club.openReports ? ` (${club.openReports})` : ''}`} desc="moderação" onClick={() => setSheet('reports')} />}
          {club.kind !== 'private' && <Item icon="flag" label="Denunciar clube" onClick={() => setSheet('report')} />}
          {club.member && <Item icon="logout" label="Sair do clube" danger onClick={leave} />}
        </div>
      </Sheet>
      <Sheet open={sheet === 'rules'} onClose={() => setSheet(null)} title="Regras do clube">
        {club.description && <p className="t-15">{club.description}</p>}
        <ul className="stack gap-8" style={{ paddingLeft: 18, listStyle: 'disc' }}>
          {(club.rules || 'Respeito acima de tudo.\nSem spam nem propaganda.\nSó posts sobre o tema do clube.').split('\n').filter(Boolean).map((r, i) => <li key={i} className="t-15">{r}</li>)}
        </ul>
        <p className="t-13 muted">Viu algo fora das regras? Use “Denunciar” no ⋯ do post. A moderação do clube resolve.</p>
      </Sheet>
      {club.kind === 'private' && club.member && (
        <InviteSheet club={club} open={sheet === 'invite'} onClose={() => setSheet(null)}
          onInvited={() => { reload(); invalidateLoad('/community', `/clubs/${slug}/members`); setMembersKey((k) => k + 1); }} />
      )}
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} targetType="club" targetId={club.id} />
      {club.canModerate && <ReportsSheet club={club} open={sheet === 'reports'} onClose={() => setSheet(null)} onChanged={() => { reload(); invalidateLoad(`/clubs/${slug}/feed`); }} />}
      {club.canModerate && sheet === 'edit' && <EditSheet club={club} open onClose={() => setSheet(null)} onSaved={reload} />}
    </div>
  );
}
