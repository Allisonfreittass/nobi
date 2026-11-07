import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import Broto from '../components/Broto.jsx';
import Icon from '../components/Icon.jsx';
import { StreakPill, Toggle, Skeleton } from '../components/ui.jsx';
import { api, localNow } from '../lib/api.js';
import { useSession, useMascotMotion } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { afterCheckin, afterPost, invalidateLoad } from '../lib/useLoad.js';
import { optimisticCheckin } from '../lib/useCheckin.js';
import { CATEGORIES, KIND_LABEL, WEEK, firstName, goalColor, unitShort } from '../lib/format.js';

const BADGE = { daily: 'Novo hábito plantado', count: 'Novo hábito plantado', weekly: 'Nova meta plantada', project: 'Novo projeto plantado' };
const VERB = { treino: 'começou a treinar', leitura: 'começou a ler', estudo: 'começou a estudar' };
const startedPhrase = (goal) => VERB[goal.category] || `começou “${goal.title}”`;

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const dayInfo = (d) => WEEK.find((w) => w.d === d);

function daysText(active) {
  if (active.length === 7) return 'Todos os dias';
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => active.includes(d));
  const consecutive = order.length > 1 && order.every((d, i) => i === 0 || [1, 2, 3, 4, 5, 6, 0].indexOf(d) === [1, 2, 3, 4, 5, 6, 0].indexOf(order[i - 1]) + 1);
  if (consecutive) return `${dayInfo(order[0]).label} a ${dayInfo(order[order.length - 1]).label}`;
  return order.map((d) => dayInfo(d).label).join(', ');
}

function restText(goal) {
  if (goal.kind === 'weekly') return `Conta em semanas: ${goal.target.amount} ${goal.target.unit || 'vezes'} por semana. Os dias você escolhe.`;
  if (goal.kind === 'project') return 'Conta cada dia em que você avançar. Em 7 dias seguidos, seu Broto fica dourado.';
  const rest = [1, 2, 3, 4, 5, 6, 0].filter((d) => !goal.activeDays.includes(d)).map((d) => dayInfo(d).full.toLowerCase());
  const golden = 'Em 7 dias seguidos, seu Broto fica dourado.';
  if (!rest.length) return golden;
  const names = rest.length === 1 ? rest[0] : `${rest.slice(0, -1).join(', ')} e ${rest[rest.length - 1]}`;
  const cap = names.charAt(0).toUpperCase() + names.slice(1);
  return `${cap} ${rest.length === 1 ? 'é' : 'são'} descanso: não quebra a sequência. ${golden}`;
}

/** Vasinho com a muda nascendo, na cor do objetivo. */
function Pot({ color }) {
  return (
    <svg viewBox="0 0 60 80" width="66" height="88" aria-hidden="true" style={{ position: 'absolute', right: 32, bottom: 6 }}>
      <g className="nobi-grow">
        <path d="M30 44 V20" stroke="#141218" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M30 26 C24 16 15 17 13 22 C19 28 26 28 30 26Z" fill={color} stroke="#141218" strokeWidth="2" strokeLinejoin="round" />
        <path d="M30 22 C35 11 46 11 48 16 C43 23 36 24 30 22Z" fill={color} stroke="#141218" strokeWidth="2" strokeLinejoin="round" />
      </g>
      <path d="M10 44 H50 L45 76 C44.5 78 43 79 41 79 H19 C17 79 15.5 78 15 76Z" fill="#FFF1E4" stroke="#141218" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="7" y="40" width="46" height="9" rx="4.5" fill="#FFF1E4" stroke="#141218" strokeWidth="2.5" />
    </svg>
  );
}

export default function Started() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { me, patchMe } = useSession();
  const motion = useMascotMotion();
  const toast = useToast();
  const [goal, setGoal] = useState(state?.goal || null);
  const [error, setError] = useState(false);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!goal) api(`/goals/${id}`).then(setGoal).catch(() => setError(true));
  }, [id, goal]);

  if (error) return <Navigate to="/metas" replace />;
  if (!goal) return <div className="screen no-nav"><Skeleton height={360} /></div>;

  const color = goalColor(goal.color);
  const cat = CATEGORIES[goal.category];
  const today = localNow().date;
  const isActive = (iso) => goal.kind === 'weekly' || goal.activeDays.includes(weekdayOf(iso));
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const todayActive = isActive(today);
  const nextActive = days.slice(1).find(isActive);
  const nextLabel = !nextActive ? 'depois' : nextActive === addDays(today, 1) ? 'amanhã' : dayInfo(weekdayOf(nextActive)).full.toLowerCase();
  const meta = goal.kind === 'weekly' ? `${KIND_LABEL.weekly} · ${goal.target.amount}x por semana` : `${cat.label} · ${daysText(goal.activeDays)} · em ${goal.streak.unit === 'weeks' ? 'semanas' : 'dias'}`;

  async function tellFriends() {
    if (!share) return;
    try {
      await api('/posts', { method: 'POST', body: { goalId: goal.id, start: true, audience: 'friends' } });
      afterPost();
    } catch (e) { toast(e.message); }
  }

  async function leave() {
    await tellFriends();
    invalidateLoad('/goals');
    navigate('/metas', { replace: true });
  }

  async function firstCheckin() {
    setBusy(true);
    const u = goal.target?.unit;
    const body = goal.kind === 'count' || goal.kind === 'weekly' ? { value: 1 } : goal.kind === 'project' ? {} : u === 'min' ? { minutes: goal.status.need } : { value: goal.status.need };
    const before = goal;
    setGoal(optimisticCheckin(goal, body)); // chama acende e o dia preenche no toque
    try {
      const r = await api(`/goals/${goal.id}/checkins`, { method: 'POST', body });
      setGoal(r.goal);
      setDone(true);
      afterCheckin(r.goal);
      patchMe({ level: r.me.level, xp: r.me.xp, golden: r.me.golden, stage: r.me.stage });
      await tellFriends();
      setTimeout(() => navigate('/metas', { replace: true }), 1300);
    } catch (e) {
      setGoal(before);
      toast(e.message);
      setBusy(false);
    }
  }

  const st = goal.status;
  const todayDone = st.doneToday;

  return (
    <div className="screen no-nav" style={{ alignItems: 'center', paddingTop: 'calc(40px + env(safe-area-inset-top))', minHeight: '100dvh' }}>
      <span className="label-caps" style={{ padding: '7px 14px', borderRadius: 16, background: 'color-mix(in srgb, #2E9C6A 14%, var(--nobi-card))', color: '#1F6B47' }}>{BADGE[goal.kind]}</span>

      <div style={{ position: 'relative', width: 280, height: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} aria-hidden="true">
        <div style={{ position: 'absolute', left: 45, top: 4, width: 190, height: 190, borderRadius: 95, background: 'var(--nobi-brasa)' }} />
        <span className="nobi-pop" style={{ position: 'absolute', left: 22, top: 30, width: 12, height: 12, borderRadius: 4, background: 'var(--nobi-brasa)', transform: 'rotate(20deg)' }} />
        <span className="nobi-pop" style={{ position: 'absolute', right: 26, top: 18, width: 14, height: 14, borderRadius: 7, background: '#2E9C6A', animationDelay: '80ms' }} />
        <span className="nobi-pop" style={{ position: 'absolute', right: 8, top: 110, width: 8, height: 18, borderRadius: 4, background: 'var(--nobi-orbita)', transform: 'rotate(-30deg)', animationDelay: '160ms' }} />
        <span className="nobi-pop" style={{ position: 'absolute', left: 6, top: 140, width: 10, height: 10, borderRadius: 5, background: 'var(--nobi-tinta)', animationDelay: '240ms' }} />
        <div className={motion ? 'nobi-hop' : ''} style={{ position: 'relative', marginRight: 40 }}>
          <Broto size={168} stage={me.stage} golden={me.golden} expression="comemorando" arms="wave" />
        </div>
        <Pot color={goal.color === '#141218' ? '#2E9C6A' : goal.color} />
      </div>

      <h1 className="display nobi-pop" style={{ fontSize: 52, textAlign: 'center' }}>{done ? 'É isso!' : 'Começou!'}</h1>
      <p className="t-16" style={{ maxWidth: 310, textAlign: 'center', lineHeight: 1.45, color: 'var(--nobi-text-secondary)' }}>
        {done ? 'Primeiro passo dado. Agora é um dia de cada vez.' : `Você plantou ${goal.kind === 'project' ? 'um projeto novo' : goal.kind === 'weekly' ? 'uma meta nova' : 'um hábito novo'}. O primeiro check-in é o que mais conta, e ele pode ser ${todayActive ? 'hoje' : nextLabel}.`}
      </p>

      <section className="card stack gap-10" style={{ width: '100%', padding: '14px 16px' }} aria-label={goal.title}>
        <div className="row gap-12">
          <span style={{ width: 40, height: 40, borderRadius: 14, background: color, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true">
            <Icon name={cat.icon} size={20} stroke={2.2} />
          </span>
          <span className="stack grow" style={{ gap: 2 }}>
            <span className="strong t-16">{goal.title}</span>
            <span className="t-13 secondary">{meta}</span>
          </span>
          <StreakPill value={goal.streak.current} unit={unitShort(goal.streak.unit, goal.streak.current)} active={st.periodDone || st.doneToday} bump />
        </div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }} aria-label="Próximos 7 dias">
          {days.map((iso, i) => {
            const active = isActive(iso);
            const isToday = i === 0;
            const filled = isToday && todayDone;
            const box = filled
              ? { background: color, color: '#FFFFFF' }
              : isToday
                ? { background: 'var(--nobi-card)', boxShadow: `inset 0 0 0 2px ${color}`, color: 'var(--nobi-text)' }
                : active ? { background: 'var(--nobi-track)' } : { background: 'var(--nobi-bg)', boxShadow: 'inset 0 0 0 1px var(--nobi-border-strong)' };
            return (
              <li key={iso} className="stack center gap-4">
                <span className={filled ? 'nobi-pop' : ''} style={{ width: '100%', aspectRatio: '1', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, transition: 'background 200ms', ...box }}>
                  {filled ? <Icon name="check" size={16} stroke={2.8} /> : isToday ? 'Hoje' : ''}
                </span>
                <span className="t-12" style={{ fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--nobi-text)' : 'var(--nobi-text-muted)' }}>{dayInfo(weekdayOf(iso)).label}</span>
                <span className="sr-only">{filled ? 'feito' : active ? 'conta' : 'descanso'}</span>
              </li>
            );
          })}
        </ol>
        <span className="t-13 secondary" style={{ lineHeight: 1.4 }}>{restText(goal)}</span>
      </section>

      <div className="card row between gap-12" style={{ width: '100%', minHeight: 60, padding: '10px 16px' }}>
        <span className="stack" style={{ gap: 2 }}>
          <span className="t-15" style={{ fontWeight: 600 }}>Contar para os amigos</span>
          <span className="t-12 muted">{share ? `vai um post para os amigos: ${firstName(me.name)} ${startedPhrase(goal)}` : 'nada é postado se você não ligar'}</span>
        </span>
        <Toggle checked={share} onChange={setShare} label="Contar para os amigos" />
      </div>

      <div style={{ flex: 1 }} />
      <div className="stack gap-6" style={{ width: '100%' }}>
        {todayActive && !todayDone && (
          <button type="button" className="btn btn-primary lg block" onClick={firstCheckin} disabled={busy}>Fazer o 1º check-in agora</button>
        )}
        <button type="button" className={`btn block ${todayActive && !todayDone ? 'btn-ghost' : 'btn-primary lg'}`} style={todayActive && !todayDone ? { height: 48 } : undefined} onClick={leave} disabled={busy}>
          {todayDone ? 'Ver minhas metas' : `Começar ${nextLabel}`}
        </button>
      </div>
    </div>
  );
}
