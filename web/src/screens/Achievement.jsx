import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Broto from '../components/Broto.jsx';
import Icon from '../components/Icon.jsx';
import { useSession, useMascotMotion } from '../lib/session.jsx';
import { useShare } from '../lib/share.jsx';
import { useToast } from '../lib/toast.jsx';
import { api } from '../lib/api.js';
import { afterPost } from '../lib/useLoad.js';
import { CATEGORIES, WEEK, weekOrder } from '../lib/format.js';
import { useStatusBar } from '../lib/statusBar.js';

const CONFETTI = [
  { left: 40, top: 120, w: 14, h: 14, r: 4, c: 'var(--nobi-creme)', rot: 20 },
  { right: 52, top: 96, w: 18, h: 18, r: 9, c: 'var(--nobi-orbita)' },
  { right: 36, top: 250, w: 10, h: 22, r: 5, c: 'var(--nobi-tinta)', rot: -30 },
  { left: 30, top: 300, w: 12, h: 12, r: 6, c: 'var(--nobi-dourado)' },
  { left: 100, top: 70, w: 8, h: 18, r: 4, c: 'var(--nobi-orbita)', rot: 40 },
];

function texts(c) {
  const cat = CATEGORIES[c.category] || CATEGORIES.objetivo;
  if (c.kind === 'milestone') {
    return {
      title: c.finished ? ['Projeto', 'entregue!'] : ['Marco', 'concluído!'],
      body: c.finished ? `Todos os marcos de “${c.goalTitle}” estão feitos. Que orgulho.` : `“${c.title}” está feito. Um passo a mais em “${c.goalTitle}”.`,
      share: `Marco: ${c.title}`,
    };
  }
  const weeks = c.unit === 'weeks';
  const body = weeks
    ? `Você bateu “${c.goalTitle}” ${c.count} semanas seguidas.`
    : c.count === 7
      ? `Você ${cat.verb} todos os dias desta semana${c.becameGolden ? ' e seu Broto ficou dourado' : ''}. Mantenha a sequência pra ele continuar assim.`
      : `${c.count} dias seguidos de ${cat.label.toLowerCase()}. ${c.golden ? 'O Broto segue dourado.' : ''}`;
  return { title: [`${c.count} ${weeks ? 'semanas' : 'dias'}`, 'seguidos!'], body, share: `${c.count} ${weeks ? 'semanas' : 'dias'} seguidos · ${c.goalTitle}` };
}

export default function Achievement() {
  useStatusBar('#FF5B2E'); // topo colorido: faixa do relógio na mesma cor
  const { state } = useLocation();
  const navigate = useNavigate();
  const { me } = useSession();
  const motion = useMascotMotion();
  const share = useShare();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const c = state?.celebration;
  if (!c) return <Navigate to="/" replace />;
  const t = texts(c);
  const week = c.week || [];
  const order = weekOrder(me?.prefs?.weekStart);
  const done = () => navigate('/', { replace: true });
  const body = { goalId: c.goalId, checkinId: c.checkinId, celebration: c };

  async function onShare() {
    if (state.audience) {
      // A pessoa já escolheu o público ao registrar
      setBusy(true);
      try {
        await api('/posts', { method: 'POST', body: { ...body, audience: state.audience, text: state.text || '', photo: state.photo } });
        afterPost();
        toast('Compartilhado no feed.');
        done();
      } catch (e) { toast(e.message); setBusy(false); }
      return;
    }
    share({ ...body, title: t.share }, done);
  }

  return (
    <div className="block-brasa" style={{ minHeight: '100dvh', position: 'relative', overflow: 'hidden' }}>
      {CONFETTI.map((p, i) => (
        <span key={i} aria-hidden="true" className="nobi-pop" style={{ position: 'absolute', left: p.left, right: p.right, top: p.top, width: p.w, height: p.h, borderRadius: p.r, background: p.c, transform: p.rot ? `rotate(${p.rot}deg)` : undefined, animationDelay: `${i * 80}ms` }} />
      ))}
      <div className="stack center" style={{ maxWidth: 440, margin: '0 auto', minHeight: '100dvh', padding: 'calc(56px + env(safe-area-inset-top)) 24px calc(32px + env(safe-area-inset-bottom))', position: 'relative' }}>
        <span className="label-caps" style={{ padding: '7px 14px', borderRadius: 16, background: 'rgba(20,18,24,0.12)' }}>Nova conquista</span>
        <div className={motion ? 'nobi-hop' : ''} style={{ marginTop: 24 }}>
          <Broto size={210} stage={me?.stage} golden={c.golden ?? me?.golden} expression="comemorando" shadow={false} title="Broto comemorando" />
        </div>
        <div aria-hidden="true" style={{ width: 150, height: 14, borderRadius: '50%', background: 'rgba(20,18,24,0.18)', marginTop: 4 }} />
        <h1 className="display t-64 nobi-pop" style={{ marginTop: 26, textAlign: 'center' }}>{t.title[0]}<br />{t.title[1]}</h1>
        <p className="t-16" style={{ marginTop: 14, textAlign: 'center', maxWidth: 320, fontSize: '1.0625rem', lineHeight: 1.45 }}>{t.body}</p>

        {c.kind === 'streak' && c.unit === 'days' && week.length === 7 && (
          <ol className="row gap-8" style={{ listStyle: 'none', padding: 0, margin: '24px 0 0' }} aria-label="Esta semana">
            {week.map((d, i) => {
              const label = order[i]?.label || WEEK[i].label;
              const isToday = d.today;
              const ok = d.state === 'done';
              return (
                <li key={d.date} className="stack center gap-6">
                  <span className={isToday ? 'nobi-pop' : ''} style={{
                    width: 38, height: 38, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isToday && ok ? 'var(--nobi-creme)' : ok ? 'var(--nobi-tinta)' : 'rgba(20,18,24,0.12)',
                    boxShadow: isToday ? '0 0 0 3px var(--nobi-tinta)' : 'none', color: isToday ? 'var(--nobi-tinta)' : 'var(--nobi-creme)', animationDelay: '300ms',
                  }}>
                    {ok && <Icon name="check" size={18} stroke={2.8} />}
                  </span>
                  <span className="t-12" style={{ fontWeight: isToday ? 700 : 600 }}>{label}</span>
                  <span className="sr-only">{ok ? 'feito' : d.state === 'rest' ? 'descanso' : d.state === 'future' ? 'ainda não chegou' : 'sem registro'}</span>
                </li>
              );
            })}
          </ol>
        )}

        <div style={{ flex: 1, minHeight: 28 }} />
        <div className="stack gap-10" style={{ width: '100%' }}>
          <button type="button" className="btn btn-dark lg block" onClick={onShare} disabled={busy} style={{ background: 'var(--nobi-tinta)', color: '#FFFFFF' }}>
            <Icon name="share" size={19} /> Compartilhar no feed
          </button>
          <button type="button" className="btn btn-ghost block" style={{ height: 52, fontSize: 'var(--nobi-text-lg)', color: 'var(--nobi-tinta)' }} onClick={done}>Agora não</button>
        </div>
      </div>
    </div>
  );
}
