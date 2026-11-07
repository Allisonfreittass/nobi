import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Broto from '../components/Broto.jsx';
import Icon from '../components/Icon.jsx';
import PostCard from '../components/PostCard.jsx';
import { Avatar, BackButton, ErrorNote, ProgressBar, Skeleton } from '../components/ui.jsx';
import { useLoad } from '../lib/useLoad.js';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { api } from '../lib/api.js';
import { capitalize, monthName, signed, weekOrder } from '../lib/format.js';

const STAGE_NAME = { broto: 'Broto', muda: 'Muda', botao: 'Botão', flor: 'Flor' };
const NEXT_STAGE = { broto: 10, muda: 25, botao: 50 };
const HEAT = ['var(--nobi-heat-0)', 'var(--nobi-heat-1)', 'var(--nobi-heat-2)', 'var(--nobi-heat-3)'];

function MonthMap({ month, weekStart, audience }) {
  const [y, m] = month.key.split('-').map(Number);
  const order = weekOrder(weekStart).map((w) => w.d);
  const lead = order.indexOf(month.firstWeekday);
  const prev = monthName((m + 10) % 12);
  return (
    <section className="card stack gap-12" aria-label="Mapa do mês">
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <h2 className="title t-18">{capitalize(monthName(m - 1))}{y !== new Date().getFullYear() ? ` ${y}` : ''}</h2>
        <span className="row gap-6 t-12 muted"><Icon name={audience === 'public' ? 'globe' : 'users'} size={14} />Visível para {audience === 'public' ? 'todos' : 'amigos'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }} role="img"
        aria-label={`Dias com registro em ${monthName(m - 1)}: ${month.days.filter((d) => d.count > 0).length}`}>
        {weekOrder(weekStart).map((w) => <span key={w.d} className="t-12 muted center" aria-hidden="true">{w.short}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
        {month.days.map((d) => (
          <span key={d.date} title={`${Number(d.date.slice(8))}: ${d.count} ${d.count === 1 ? 'objetivo' : 'objetivos'}`}
            style={{ aspectRatio: '1', borderRadius: 8, background: d.level == null ? 'transparent' : HEAT[d.level], boxShadow: d.level == null ? 'inset 0 0 0 1.5px var(--nobi-track)' : 'none' }} />
        ))}
      </div>
      <div className="row gap-6 t-12 muted">
        <span>menos</span>{HEAT.map((h) => <span key={h} style={{ width: 12, height: 12, borderRadius: 4, background: h }} />)}<span>mais</span>
        <span className="grow" />
        {month.delta != null && <span className="strong" style={{ color: 'var(--nobi-text)' }}>{signed(month.delta)} vs. {prev}</span>}
      </div>
    </section>
  );
}

function Achievements({ data }) {
  const [all, setAll] = useState(false);
  const items = all ? data.items : [...data.items].sort((a, b) => Boolean(b.earnedAt) - Boolean(a.earnedAt)).slice(0, 8);
  return (
    <section className="stack gap-10" aria-label="Conquistas">
      <div className="section-head">
        <h2 className="title t-20">Conquistas</h2>
        <button type="button" className="btn btn-ghost sm" onClick={() => setAll((v) => !v)}>{data.earned} de {data.total} · {all ? 'menos' : 'ver todas'}</button>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {items.map((a) => (
          <li key={a.code} className="card stack center gap-6" style={{ padding: 10, opacity: a.earnedAt ? 1 : 0.5 }} title={a.desc}>
            <span style={{ width: 44, height: 44, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: a.earnedAt ? (a.seasonal ? 'var(--nobi-orbita)' : a.code.startsWith('sequencia') ? 'var(--nobi-dourado)' : 'var(--nobi-brasa)') : 'var(--nobi-track)', color: a.earnedAt && a.seasonal ? '#FFFFFF' : 'var(--nobi-tinta)' }}>
              <Icon name={a.earnedAt ? (a.code.startsWith('sequencia') ? 'flame' : a.seasonal ? 'sun' : 'medal') : 'lock'} size={20} stroke={2.2} />
            </span>
            <span className="t-12 strong" style={{ lineHeight: 1.2 }}>{a.title}</span>
            <span className="sr-only">{a.earnedAt ? 'conquistada' : 'ainda não'}: {a.desc}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FollowButton({ profile, onChange }) {
  const toast = useToast();
  const rel = profile.relation;
  const label = rel.following === 'accepted' ? (rel.friends ? 'Amigos' : 'Seguindo') : rel.following === 'pending' ? 'Pedido enviado' : rel.followsMe ? 'Seguir de volta' : 'Seguir';
  async function click() {
    try {
      const r = await api(`/users/${profile.id}/follow`, { method: rel.following === 'none' ? 'POST' : 'DELETE' });
      onChange(r.relation);
    } catch (e) { toast(e.message); }
  }
  return (
    <button type="button" className={`btn sm ${rel.following === 'none' ? 'btn-primary' : 'btn-outline'}`} aria-pressed={rel.following !== 'none'} onClick={click}>
      {rel.following === 'accepted' && <Icon name="check" size={16} />}{label}
    </button>
  );
}

export default function Profile() {
  const params = useParams();
  const navigate = useNavigate();
  const { me } = useSession();
  const toast = useToast();
  const username = params.username || me.username;
  const isMe = username === me.username;
  const { data: p, error, reload, setData } = useLoad(`/users/${username}`);
  const posts = useLoad(`/users/${username}/posts`);

  if (error) return <div className="screen"><BackButton /><ErrorNote error={error} onRetry={reload} /></div>;
  if (!p) return <div className="screen"><Skeleton height={120} /><Skeleton height={90} /><Skeleton height={260} /></div>;

  const s = p.stats;
  const stage = isMe ? me.stage : p.stage;
  const golden = isMe ? me.golden : p.golden;
  const level = isMe ? me.level : p.level;
  const xpPct = isMe ? me.levelProgress : null;

  async function block() {
    if (!window.confirm(`Bloquear ${p.name}? Vocês deixam de se seguir e não veem os posts um do outro.`)) return;
    await api(`/users/${p.id}/block`, { method: 'POST' });
    toast('Conta bloqueada.');
    navigate('/', { replace: true });
  }

  return (
    <div className="screen">
      <div className="row between" style={{ margin: '-4px 0 -8px' }}>
        {isMe ? <span /> : <BackButton />}
        <div className="row gap-8">
          {isMe ? (
            <>
              <Link to="/perfil/editar" className="icon-btn" aria-label="Editar perfil"><Icon name="edit" /></Link>
              <Link to="/configuracoes" className="icon-btn" aria-label="Configurações"><Icon name="gear" /></Link>
            </>
          ) : (
            <>
              <FollowButton profile={p} onChange={(relation) => { setData({ ...p, relation }); reload(); posts.reload(); }} />
              <button type="button" className="icon-btn" aria-label="Bloquear conta" onClick={block}><Icon name="ban" /></button>
            </>
          )}
        </div>
      </div>

      <section className="row gap-14">
        <span style={{ position: 'relative' }}>
          <span style={{ width: 76, height: 76, borderRadius: 26, overflow: 'hidden', display: 'inline-flex', boxShadow: 'inset 0 0 0 1px var(--nobi-border)' }}>
            <Avatar user={p} size={76} className="profile-avatar" />
          </span>
          <span style={{ position: 'absolute', right: -6, bottom: -6, padding: '3px 7px', borderRadius: 10, background: 'var(--nobi-orbita)', color: '#FFFFFF', fontSize: 12, fontWeight: 700, boxShadow: '0 0 0 3px var(--nobi-bg)' }}>Nv {level}</span>
        </span>
        <div className="stack grow" style={{ gap: 3 }}>
          <h1 className="title t-22" style={{ fontWeight: 800, fontSize: 24 }}>{p.name}</h1>
          <span className="t-13 muted">@{p.username}</span>
          <span className="row gap-14 t-14">
            <Link to={`/u/${p.username}/seguidores`} className="tap" style={{ minHeight: 32, display: 'inline-flex', alignItems: 'center' }}><strong>{p.followers}</strong>&nbsp;<span className="secondary">{p.followers === 1 ? 'seguidor' : 'seguidores'}</span></Link>
            <Link to={`/u/${p.username}/seguindo`} className="tap" style={{ minHeight: 32, display: 'inline-flex', alignItems: 'center' }}><strong>{p.following}</strong>&nbsp;<span className="secondary">seguindo</span></Link>
          </span>
          {p.bio && <span className="t-14 secondary">{p.bio}</span>}
          {p.season && (
            <span className="row gap-6 t-12 strong" style={{ alignSelf: 'flex-start', marginTop: 4, padding: '4px 10px', borderRadius: 12, background: 'var(--nobi-tinta)', color: '#FFFFFF' }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--nobi-orbita)', boxShadow: '0 0 0 1.5px #FFFFFF' }} />
              Temporada {p.season.name} · sem. {p.season.week}/{p.season.weeks}
            </span>
          )}
        </div>
      </section>

      {p.interests?.length > 0 && <div className="row gap-8 wrap">{p.interests.map((i) => <span key={i} className="tag">{i}</span>)}</div>}

      <section className="card row gap-14 block-creme" aria-label={`${STAGE_NAME[stage]}, nível ${level}`} style={{ color: 'var(--nobi-tinta)' }}>
        <span style={{ background: 'var(--nobi-brasa)', borderRadius: 20, padding: '8px 10px 0', display: 'flex' }}>
          <Broto size={64} stage={stage} golden={golden} shadow={false} />
        </span>
        <div className="stack gap-6 grow">
          <span className="title t-18">{STAGE_NAME[stage]}{golden ? ' dourado' : ''}</span>
          <span className="t-13" style={{ color: '#4A4752' }}>
            {NEXT_STAGE[stage] ? `Nível ${level}. Vira ${STAGE_NAME[{ broto: 'muda', muda: 'botao', botao: 'flor' }[stage]]} no nível ${NEXT_STAGE[stage]}.` : `Nível ${level}. A forma final.`}
            {golden ? ' Folhas douradas: sequência de 7+ dias viva.' : ''}
          </span>
          {xpPct != null && <ProgressBar value={xpPct} color="var(--nobi-tinta)" height={6} label="Progresso até o próximo nível" />}
        </div>
      </section>

      {!p.canSeeProfile && (
        <div className="card empty"><Icon name="lock" size={28} /><p className="t-15">Perfil visível só para amigos.</p></div>
      )}
      {p.canSeeProfile && !p.canSeeStats && (
        <div className="card row gap-10"><Icon name="lock" size={18} /><span className="t-14 secondary">Estatísticas visíveis só para amigos.</span></div>
      )}

      {s && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <div className="card block-brasa" style={{ padding: 14, borderRadius: 20 }}>
              <div className="num t-28" style={{ lineHeight: 1 }}>{s.streak}</div>
              <div className="t-12 strong" style={{ marginTop: 4 }}>dias seguidos</div>
            </div>
            <div className="card" style={{ padding: 14, borderRadius: 20 }}>
              <div className="num t-28" style={{ lineHeight: 1 }}>{s.consistency ?? '–'}{s.consistency != null && '%'}</div>
              <div className="t-12 muted" style={{ marginTop: 4 }}>consistência</div>
            </div>
            <div className="card" style={{ padding: 14, borderRadius: 20 }}>
              <div className="num t-28" style={{ lineHeight: 1 }}>{s.challenges}</div>
              <div className="t-12 muted" style={{ marginTop: 4 }}>{s.challenges === 1 ? 'desafio' : 'desafios'}</div>
            </div>
          </div>
          {isMe && (
            <Link to="/semana" className="card row gap-12 tap">
              <Icon name="share" size={20} />
              <span className="grow stack" style={{ gap: 1 }}><span className="strong t-15">Resumo da semana</span><span className="t-13 muted">card pronto pra postar no Instagram</span></span>
              <Icon name="chevron" size={18} />
            </Link>
          )}
          <MonthMap month={s.month} weekStart={me.prefs.weekStart} audience={p.statsAudience} />
          {p.achievements && <Achievements data={p.achievements} />}
        </>
      )}

      {p.canSeeProfile && (
        <section className="stack gap-12" aria-label="Posts">
          <h2 className="title t-20">Posts</h2>
          {posts.data?.length === 0 && <p className="muted t-14">{isMe ? 'Você ainda não postou. Seus registros ficam só com você até você escolher compartilhar.' : 'Nenhum post visível.'}</p>}
          {(posts.data || []).map((post) => <PostCard key={post.id} post={post} onDelete={(id) => posts.setData((l) => l.filter((x) => x.id !== id))} />)}
        </section>
      )}
    </div>
  );
}
