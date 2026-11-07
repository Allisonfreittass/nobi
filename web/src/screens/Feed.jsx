import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Broto from '../components/Broto.jsx';
import PostCard from '../components/PostCard.jsx';
import GoalCard from '../components/GoalCard.jsx';
import FriendsRing from '../components/FriendsRing.jsx';
import ChallengeBanner from '../components/ChallengeBanner.jsx';
import InstallCard from '../components/InstallPrompt.jsx';
import { Logo } from '../components/Logo.jsx';
import { Avatar, ErrorNote, Skeleton, ProgressBar } from '../components/ui.jsx';
import { useUnread } from '../components/Layout.jsx';
import { useLoad, useDesktop, afterCheckin } from '../lib/useLoad.js';
import { useSession } from '../lib/session.jsx';
import { api } from '../lib/api.js';
import { firstName, greeting, longToday, signed } from '../lib/format.js';
import { useToast } from '../lib/toast.jsx';

function Bell() {
  const unread = useUnread();
  return (
    <Link to="/notificacoes" className="icon-btn" aria-label={unread ? `Notificações, ${unread} novas` : 'Notificações'}>
      <Icon name="bell" />
      {unread > 0 && <span className="dot" />}
    </Link>
  );
}

function usePosts() {
  const feed = useLoad('/feed');
  const [more, setMore] = useState([]);
  const [next, setNext] = useState(undefined);
  const cursor = next === undefined ? feed.data?.next : next;
  const posts = [...(feed.data?.posts || []), ...more];
  async function loadMore() {
    const r = await api(`/feed?before=${encodeURIComponent(cursor)}`);
    setMore((m) => [...m, ...r.posts]);
    setNext(r.next);
  }
  const remove = (id) => {
    feed.setData((d) => ({ ...d, posts: d.posts.filter((p) => p.id !== id) }));
    setMore((m) => m.filter((p) => p.id !== id));
  };
  return { ...feed, posts, cursor, loadMore, remove };
}

function EmptyFeed() {
  return (
    <div className="card empty">
      <div className="block-brasa" style={{ borderRadius: 24, padding: '16px 24px 6px' }}><Broto size={96} arms="wave" /></div>
      <h2 className="title t-20">Seu feed começa com amigos</h2>
      <p className="secondary t-14" style={{ maxWidth: 300 }}>Siga quem você conhece e acompanhe a evolução de cada um. Seus registros só aparecem aqui se você escolher postar.</p>
      <Link to="/explorar" className="btn btn-dark">Encontrar pessoas</Link>
    </div>
  );
}

function MobileFeed() {
  const home = useLoad('/home');
  const feed = usePosts();
  return (
    <div className="screen">
      <header className="screen-head">
        <Logo size={34} />
        <Bell />
      </header>
      <InstallCard />
      {home.data ? <FriendsRing ring={home.data.ring} /> : <Skeleton height={80} />}
      {home.data?.challenge && <ChallengeBanner c={home.data.challenge} />}
      <ErrorNote error={feed.error} onRetry={feed.reload} />
      {feed.loading && !feed.data && <><Skeleton height={260} /><Skeleton height={220} /></>}
      {feed.data && feed.posts.length === 0 && <EmptyFeed />}
      {feed.posts.map((p) => <PostCard key={p.id} post={p} onDelete={feed.remove} />)}
      {feed.cursor && <button type="button" className="btn btn-outline block" onClick={feed.loadMore}>Ver mais</button>}
    </div>
  );
}

function ProjectCard({ goal, onChange }) {
  const toast = useToast();
  const navigate = useNavigate();
  async function toggle(m) {
    try {
      const r = await api(`/goals/${goal.id}/milestones/${m.id}`, { method: 'PATCH', body: { done: !m.done } });
      onChange(r.goal);
      afterCheckin(r.goal);
      if (r.celebration) navigate('/conquista', { state: { celebration: r.celebration } });
    } catch (e) { toast(e.message); }
  }
  const nextIdx = goal.milestones.findIndex((m) => !m.done);
  return (
    <section className="card stack gap-14" aria-label={goal.title}>
      <div className="row between gap-12">
        <div className="stack gap-4">
          <span className="label-caps t-12 muted">Projeto</span>
          <Link to={`/metas/${goal.id}`} className="title t-20">{goal.title}</Link>
        </div>
        <span className="num t-30">{Math.round(goal.pct * 100)}%</span>
      </div>
      <ProgressBar value={goal.pct} color="var(--nobi-goal-ink)" label="Progresso do projeto" />
      <span className="t-13 muted">{goal.deadline ? `prazo ${new Date(`${goal.deadline}T12:00`).toLocaleDateString('pt-BR', { month: 'long' })} · ` : ''}{goal.streak.current} dias seguidos avançando</span>
      <ol className="stack gap-4" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {goal.milestones.map((m, i) => (
          <li key={m.id}>
            <button type="button" className="list-row" style={{ minHeight: 48, padding: '6px 4px', borderRadius: 12 }} aria-pressed={m.done} onClick={() => toggle(m)}>
              <span style={{ width: 26, height: 26, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: m.done ? 'var(--nobi-goal-ink)' : 'var(--nobi-card)', boxShadow: m.done ? 'none' : 'inset 0 0 0 2px var(--nobi-toggle-off)', color: '#FFFFFF' }}>
                {m.done && <Icon name="check" size={16} stroke={2.6} />}
              </span>
              <span className="grow t-15" style={{ fontWeight: 500 }}>{m.title}</span>
              <span className="t-12 strong" style={{ color: m.done ? 'var(--nobi-success)' : i === nextIdx ? 'var(--nobi-text-streak)' : 'var(--nobi-text-muted)' }}>
                {m.done ? 'Concluído' : i === nextIdx ? 'Agora' : 'Depois'}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Consistency12({ stats }) {
  return (
    <section className="card stack gap-14" aria-label="Consistência">
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div className="stack gap-4">
          <h2 className="title t-18">Consistência</h2>
          <span className="t-13 muted">últimas 12 semanas</span>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end' }}>
          <span className="num t-30">{stats.consistency12 ?? '–'}{stats.consistency12 != null && '%'}</span>
          {stats.consistency12Delta != null && <span className="t-12 strong" style={{ color: 'var(--nobi-success)' }}>{signed(stats.consistency12Delta)} vs. período anterior</span>}
        </div>
      </div>
      <div className="row gap-6" style={{ alignItems: 'flex-end', height: 96 }} role="img" aria-label={`Consistência semanal: ${stats.weeks12.map((w) => (w.pct == null ? 'sem dados' : `${w.pct}%`)).join(', ')}`}>
        {stats.weeks12.map((w, i) => (
          <span key={w.weekStart} title={w.pct == null ? 'sem dados' : `${w.pct}%`}
            style={{ flex: 1, height: `${Math.max(6, w.pct ?? 0)}%`, borderRadius: 6, background: i === stats.weeks12.length - 1 ? 'var(--nobi-brasa)' : w.pct == null ? 'var(--nobi-track)' : 'var(--nobi-heat-2)', opacity: i === stats.weeks12.length - 1 ? 1 : 0.75, transition: 'height var(--nobi-dur-fill)' }} />
        ))}
      </div>
    </section>
  );
}

function RankingMini({ goal }) {
  if (!goal?.shared?.ranking) return null;
  return (
    <section className="card stack gap-10" aria-label={`Ranking de ${goal.title}`}>
      <div className="row between">
        <Link to={`/desafios/${goal.id}`} className="title t-18">{goal.title}</Link>
        <span className="t-12 muted">dia {goal.shared.day} de {goal.shared.totalDays}</span>
      </div>
      <ol className="stack gap-6" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {goal.shared.ranking.slice(0, 3).map((r) => (
          <li key={r.id} className="row gap-10 t-14" style={{ fontWeight: r.me ? 700 : 500 }}>
            <span className="num" style={{ width: 22 }}>{r.position}.</span>
            <Avatar user={r} size={28} />
            <span className="grow">{r.me ? 'Você' : firstName(r.name)}</span>
            <span className="num">{r.points}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DesktopFeed() {
  const { me } = useSession();
  const navigate = useNavigate();
  const goals = useLoad('/goals');
  const stats = useLoad('/me/stats');
  const feed = usePosts();
  const list = goals.data || [];
  const update = (g) => goals.setData((l) => l.map((x) => (x.id === g.id ? g : x)));
  const daily = list.filter((g) => g.kind !== 'project' && !g.shared?.tasks?.length);
  const project = list.find((g) => g.kind === 'project');
  const challenge = list.find((g) => g.shared?.ranking);
  const pending = daily.filter((g) => g.status.activeToday && !g.status.periodDone).length;

  return (
    <div className="screen wide" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 28, alignItems: 'start' }}>
      <div className="stack gap-20">
        <header className="row between gap-16">
          <div className="stack gap-4">
            <span className="t-14 secondary">{longToday()}</span>
            <h1 className="title t-30">{greeting()}, {firstName(me.name)}.{goals.data ? (pending ? ` ${pending === 1 ? "Falta" : "Faltam"} ${pending} hoje.` : ' Dia completo!') : ''}</h1>
          </div>
          <div className="row gap-8">
            <Bell />
            <button type="button" className="btn btn-dark" onClick={() => navigate('/metas/novo')}><Icon name="plus" size={18} /> Novo objetivo</button>
          </div>
        </header>
        <ErrorNote error={goals.error} onRetry={goals.reload} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {goals.loading && !goals.data && [1, 2, 3].map((i) => <Skeleton key={i} height={170} />)}
          {daily.map((g) => <GoalCard key={g.id} goal={g} meId={me.id} onChange={update} />)}
        </div>
        {project && <ProjectCard goal={project} onChange={update} />}
        {stats.data && <Consistency12 stats={stats.data} />}
      </div>
      <aside className="stack gap-16" style={{ position: 'sticky', top: 24 }}>
        <h2 className="title t-20">Seus amigos agora</h2>
        <div className="stack gap-12" style={{ maxHeight: 'calc(100dvh - 300px)', overflowY: 'auto', paddingRight: 4 }}>
          {feed.data && feed.posts.length === 0 && <EmptyFeed />}
          {feed.posts.slice(0, 10).map((p) => <PostCard key={p.id} post={p} compact onDelete={feed.remove} />)}
        </div>
        <RankingMini goal={challenge} />
      </aside>
    </div>
  );
}

export default function Feed() {
  return useDesktop() ? <DesktopFeed /> : <MobileFeed />;
}
