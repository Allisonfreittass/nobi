import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Logo } from './Logo.jsx';
import { api } from '../lib/api.js';
import { useLoad } from '../lib/useLoad.js';

const NAV = [
  { to: '/', label: 'Feed', icon: 'home', end: true },
  { to: '/explorar', label: 'Explorar', icon: 'compass' },
  { to: '/metas', label: 'Metas', icon: 'target' },
  { to: '/perfil', label: 'Perfil', icon: 'user' },
];

/** Barra de abas flutuante (DESIGN.md 8.3): pílula destacada da borda, aba ativa marcada, "+" separado. */
function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <nav className="tabbar" aria-label="Principal">
      <ul className="tabbar-pill">
        {NAV.map((it) => (
          <li key={it.to}>
            <NavLink to={it.to} end={it.end} className="tab" aria-label={it.label}>
              <Icon name={it.icon} size={22} />
              <span className="tab-label">{it.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      <button type="button" className="tabbar-fab" aria-label="Registrar" onClick={() => navigate('/registrar', { state: { backgroundLocation: location } })}>
        <Icon name="plus" size={26} stroke={2.6} />
      </button>
    </nav>
  );
}

const FOCUS_SECONDS = 25 * 60;

/** Sessão de foco (PC): 25 min que contam no objetivo escolhido ao terminar. */
function FocusSession() {
  const navigate = useNavigate();
  const { data: goals } = useLoad('/goals');
  const options = (goals || []).filter((g) => g.kind !== 'project' && !g.shared?.tasks?.length);
  const [goalId, setGoalId] = useState('');
  const [left, setLeft] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);

  useEffect(() => {
    if (!goalId && options.length) setGoalId((options.find((g) => g.target?.unit === 'min') || options[0]).id);
  }, [options, goalId]);

  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        setRunning(false);
        setLeft(FOCUS_SECONDS);
        navigate('/registrar', { state: { goalId, minutes: 25, fromFocus: true, backgroundLocation: window.location.pathname === '/registrar' ? null : { pathname: window.location.pathname } } });
      }
    }, 500);
    return () => clearInterval(t);
  }, [running, goalId, navigate]);

  const toggle = () => {
    if (running) { setRunning(false); return; }
    endAt.current = Date.now() + left * 1000;
    setRunning(true);
  };
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const goal = options.find((g) => g.id === goalId);

  return (
    <section className="card stack gap-10" style={{ background: 'var(--nobi-tinta)', color: '#FFFFFF', marginTop: 'auto' }} aria-label="Sessão de foco">
      <span className="row gap-8 t-13 strong"><Icon name="timer" size={16} /> Sessão de foco</span>
      <span className="num t-40" aria-live="off" role="timer">{mm}:{ss}</span>
      {options.length > 0 ? (
        <label className="stack gap-4 t-12" style={{ color: 'rgba(255,255,255,.75)' }}>
          conta no objetivo
          <select value={goalId} onChange={(e) => setGoalId(e.target.value)} disabled={running}
            style={{ height: 44, borderRadius: 12, border: 'none', padding: '0 10px', background: 'rgba(255,255,255,.12)', color: '#FFFFFF', fontWeight: 600 }}>
            {options.map((g) => <option key={g.id} value={g.id} style={{ color: '#141218' }}>{g.title}</option>)}
          </select>
        </label>
      ) : <span className="t-13" style={{ color: 'rgba(255,255,255,.75)' }}>Crie um objetivo para contar o foco.</span>}
      <div className="row gap-8">
        <button type="button" className="btn grow" style={{ height: 46, background: 'var(--nobi-creme)', color: 'var(--nobi-tinta)' }} onClick={toggle} disabled={!goal}>
          <Icon name={running ? 'pause' : 'play'} size={18} /> {running ? 'Pausar' : left < FOCUS_SECONDS ? 'Continuar' : 'Começar'}
        </button>
        {left < FOCUS_SECONDS && !running && (
          <button type="button" className="icon-btn on-color" aria-label="Zerar" onClick={() => setLeft(FOCUS_SECONDS)}><Icon name="close" /></button>
        )}
      </div>
    </section>
  );
}

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const links = [NAV[0], NAV[2], { to: '/desafios', label: 'Desafios', icon: 'trophy' }, NAV[1], NAV[3]];
  return (
    <aside className="sidebar" aria-label="Menu">
      <div style={{ padding: '0 8px 18px' }}><Logo size={34} /></div>
      <button type="button" className="btn btn-primary block" style={{ marginBottom: 14 }} onClick={() => navigate('/registrar', { state: { backgroundLocation: location } })}>
        <Icon name="plus" size={20} stroke={2.6} /> Registrar
      </button>
      <nav className="stack gap-4" aria-label="Principal">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className="side-link"><Icon name={l.icon} size={21} />{l.label}</NavLink>
        ))}
        <NavLink to="/notificacoes" className="side-link"><Icon name="bell" size={21} />Notificações</NavLink>
        <NavLink to="/configuracoes" className="side-link"><Icon name="gear" size={21} />Configurações</NavLink>
      </nav>
      <FocusSession />
    </aside>
  );
}

export default function Layout({ nav = true }) {
  const { pathname } = useLocation();
  useEffect(() => { if (pathname !== '/registrar') window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="app-shell with-nav">
      <Sidebar />
      <main id="conteudo">
        <Outlet />
      </main>
      {nav && <BottomNav />}
    </div>
  );
}

/** Bolinha de não lidas no sino. */
export function useUnread() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => api('/home/notifications').then((d) => alive && setUnread(d.unread)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return unread;
}
