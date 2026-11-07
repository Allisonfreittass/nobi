import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import Broto from '../components/Broto.jsx';
import Icon from '../components/Icon.jsx';
import { Avatar, ErrorNote, Skeleton } from '../components/ui.jsx';
import { useLoad, afterCheckin } from '../lib/useLoad.js';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { useCheckin } from '../lib/useCheckin.js';
import { useCelebrate, closedTheDay } from '../lib/celebrate.jsx';
import { api } from '../lib/api.js';
import { firstName, unitWord } from '../lib/format.js';
import { useConfirm } from '../lib/confirm.jsx';
import { useStatusBar } from '../lib/statusBar.js';

function Header({ g, seasonName }) {
  const s = g.shared;
  const navigate = useNavigate();
  return (
    <header className="block-orbita" style={{ position: 'relative', overflow: 'hidden', padding: 'calc(20px + env(safe-area-inset-top)) 20px 24px', borderRadius: '0 0 32px 32px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', position: 'relative' }}>
        <div className="row between">
          <button type="button" className="icon-btn on-color" aria-label="Voltar" onClick={() => navigate(-1)}><Icon name="back" /></button>
          <span className="t-13 strong" style={{ padding: '7px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.16)' }}>{s.participants.length} participantes</span>
        </div>
        <p className="label-caps t-13" style={{ marginTop: 18 }}>
          {s.totalDays ? `Desafio de ${s.totalDays} dias` : 'Com amigos'}{seasonName ? ` · Temporada ${seasonName}` : ''}
        </p>
        <h1 className="display" style={{ fontSize: '2.25rem', marginTop: 6, maxWidth: 240, letterSpacing: '-0.03em', lineHeight: 1 }}>{g.title}</h1>
        {s.totalDays && (
          <div className="stack gap-6" style={{ marginTop: 16, width: 220 }}>
            <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }} role="progressbar" aria-valuemin={0} aria-valuemax={s.totalDays} aria-valuenow={s.day} aria-label="Progresso do desafio">
              <div style={{ width: `${(s.day / s.totalDays) * 100}%`, height: '100%', borderRadius: 5, background: 'var(--nobi-creme)', transition: 'width var(--nobi-dur-fill)' }} />
            </div>
            <span className="t-13">{s.ended ? 'Desafio encerrado' : `Dia ${s.day} de ${s.totalDays} · termina em ${s.daysLeft} ${s.daysLeft === 1 ? 'dia' : 'dias'}`}</span>
          </div>
        )}
        <div style={{ position: 'absolute', right: -4, bottom: -34 }} aria-hidden="true"><Broto size={112} expression="foco" shadow={false} /></div>
      </div>
    </header>
  );
}

function Tasks({ g, onGoal }) {
  const toast = useToast();
  const celebrate = useCelebrate();
  const [busy, setBusy] = useState(null);
  const done = new Set(g.shared.myTasksToday || []);
  async function flip(t) {
    setBusy(t.key);
    try {
      if (done.has(t.key)) {
        const r = await api(`/goals/${g.id}/checkins/today?taskKey=${encodeURIComponent(t.key)}`, { method: 'DELETE' });
        onGoal(r.goal);
      } else {
        const r = await api(`/goals/${g.id}/checkins`, { method: 'POST', body: { taskKey: t.key } });
        onGoal(r.goal);
        afterCheckin(r.goal);
        if (closedTheDay(g, r.goal)) celebrate(r.goal, { checkinId: r.checkin.id });
      }
    } catch (e) { toast(e.message); } finally { setBusy(null); }
  }
  return (
    <section className="stack gap-10" aria-label="Hoje">
      <div className="section-head"><h2 className="title t-22" style={{ fontSize: '1.3125rem' }}>Hoje</h2><span className="t-14 strong secondary">{done.size} de {g.shared.tasks.length}</span></div>
      <div className="card tight stack gap-6">
        {g.shared.tasks.map((t) => {
          const on = done.has(t.key);
          return (
            <button key={t.key} type="button" aria-pressed={on} disabled={busy === t.key || g.shared.ended} onClick={() => flip(t)}
              className="row gap-12" style={{ height: 50, padding: '0 10px', border: 'none', borderRadius: 16, background: 'transparent', textAlign: 'left', fontSize: 'var(--nobi-text-md)', fontWeight: 500 }}>
              <span style={{ width: 26, height: 26, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background var(--nobi-dur-fast)', background: on ? 'var(--nobi-orbita)' : 'var(--nobi-card)', boxShadow: on ? 'none' : 'inset 0 0 0 2px var(--nobi-toggle-off)', color: '#FFFFFF' }}>
                {on && <Icon name="check" size={16} stroke={2.8} className="nobi-pop" />}
              </span>
              <span className="grow">{t.label}</span>
              <span className="t-13 strong muted">+{t.pts}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Ranking({ ranking }) {
  return (
    <section className="stack gap-10" aria-label="Ranking da semana">
      <div className="section-head"><h2 className="title t-22" style={{ fontSize: '1.3125rem' }}>Ranking da semana</h2><span className="t-13 muted">zera domingo</span></div>
      <ol className="stack gap-6" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {ranking.map((r) => (
          <li key={r.id} className="row gap-12" style={{ height: 54, padding: '0 14px', borderRadius: 18, background: r.me ? 'var(--nobi-tinta)' : 'var(--nobi-card)', color: r.me ? '#FFFFFF' : undefined }}>
            <span className="t-13" style={{ width: 26, height: 26, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, background: r.me ? 'var(--nobi-brasa)' : r.position === 1 ? 'var(--nobi-orbita)' : 'var(--nobi-border)', color: r.me ? 'var(--nobi-tinta)' : r.position === 1 ? '#FFFFFF' : 'var(--nobi-text)' }}>{r.position}</span>
            <Link to={`/u/${r.username}`} className="row gap-12 grow" style={{ color: 'inherit' }}>
              <Avatar user={r} size={34} />
              <span className="grow strong t-15">{r.me ? 'Você' : firstName(r.name)}</span>
            </Link>
            <span className="num t-18">{r.points}</span>
            <span className="sr-only">pontos</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Together({ g, meId, onGoal }) {
  const { checkin, undo } = useCheckin(onGoal);
  const toast = useToast();
  const s = g.shared;
  const mine = s.participants.find((p) => p.id === meId);
  return (
    <>
      {s.mode === 'together' && (
        <section className="card row gap-14">
          <span className="num t-40">{s.groupStreak.current}</span>
          <div className="stack gap-4">
            <span className="strong t-15">{unitWord(s.groupStreak.unit, s.groupStreak.current)} seguidos do grupo</span>
            <span className="t-13 muted">vale quando {s.groupStreak.quorum} de {s.participants.length} marcam. Ninguém é punido por uma pessoa.</span>
          </div>
        </section>
      )}
      {!s.tasks.length && (
        <button type="button" className={`btn block ${mine?.doneToday ? 'btn-soft' : 'btn-primary'}`} style={{ height: 56 }}
          onClick={() => (mine?.doneToday ? undo(g) : checkin(g, g.target?.unit === 'min' ? { minutes: g.status.need } : { value: 1 })).catch((e) => toast(e.message))}>
          {mine?.doneToday ? <><Icon name="check" size={18} /> Feito hoje</> : 'Fiz hoje'}
        </button>
      )}
      <section className="stack gap-10" aria-label="Quem já fez hoje">
        <div className="section-head"><h2 className="title t-20">Quem já fez hoje</h2><span className="t-13 muted">{s.doneTodayCount} de {s.participants.length}</span></div>
        <div className="row gap-12 wrap">
          {s.participants.map((p) => (
            <Link key={p.id} to={`/u/${p.username}`} className="stack center gap-6" style={{ width: 60 }} aria-label={`${p.name}: ${p.doneToday ? 'fez hoje' : 'ainda não'}`}>
              <Avatar user={p} size={48} ring={p.doneToday ? 'posted' : 'none'} />
              <span className="t-12 secondary ellipsis" style={{ maxWidth: 60 }}>{p.id === meId ? 'Você' : firstName(p.name)}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

export default function Challenge() {
  useStatusBar('#6C4DFF'); // topo colorido: faixa do relógio na mesma cor
  const { id } = useParams();
  const { me } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: g, error, reload, setData } = useLoad(`/goals/${id}`);
  const confirm = useConfirm();

  if (error) return <div className="screen no-nav"><ErrorNote error={error} onRetry={reload} /></div>;
  if (!g) return <div className="screen no-nav"><Skeleton height={240} /><Skeleton height={200} /></div>;
  if (!g.shared) return <Navigate to={`/metas/${g.id}`} replace />;

  async function answer(yes) {
    try {
      if (yes) setData(await api(`/goals/${g.id}/join`, { method: 'POST' }));
      else { await api(`/goals/${g.id}/decline`, { method: 'POST' }); navigate('/metas', { replace: true }); }
    } catch (e) { toast(e.message); }
  }
  async function leave() {
    if (!(await confirm({ title: 'Sair do desafio?', message: 'Seus registros ficam no seu histórico, e o grupo continua sem você.', confirmLabel: 'Sair do desafio', danger: true }))) return;
    await api(`/goals/${g.id}`, { method: 'DELETE' });
    navigate('/metas', { replace: true });
  }

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 'calc(var(--nobi-nav-h) + 32px)' }}>
      <Header g={g} seasonName={me.season?.name} />
      <div className="screen" style={{ paddingTop: 22, paddingBottom: 0, gap: 20 }}>
        {g.invited && (
          <div className="card stack gap-10" style={{ boxShadow: 'inset 0 0 0 2px var(--nobi-orbita)' }}>
            <span className="strong t-15">Você foi convidado para este {g.shared.endsAt ? 'desafio' : 'objetivo'}.</span>
            <div className="row gap-8"><button type="button" className="btn btn-orbita grow" onClick={() => answer(true)}>Topar</button><button type="button" className="btn btn-ghost" onClick={() => answer(false)}>Agora não</button></div>
          </div>
        )}
        {!g.invited && g.shared.tasks.length > 0 && <Tasks g={g} onGoal={setData} />}
        {!g.invited && <Together g={g} meId={me.id} onGoal={setData} />}
        {g.shared.ranking && <Ranking ranking={g.shared.ranking} />}
        {!g.invited && <button type="button" className="btn btn-danger block" onClick={leave}><Icon name="logout" size={18} /> Sair do desafio</button>}
      </div>
    </div>
  );
}
