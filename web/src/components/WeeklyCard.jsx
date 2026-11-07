import { Link } from 'react-router-dom';
import { useState } from 'react';
import Broto from './Broto.jsx';
import Icon from './Icon.jsx';
import { useLoad } from '../lib/useLoad.js';
import { useSession } from '../lib/session.jsx';

const KEY = 'nobi.weekly.seen';
// Domingo a partir das 18h, segunda e terça (para quem não abriu no domingo)
function inWindow(d = new Date()) {
  const day = d.getDay();
  return (day === 0 && d.getHours() >= 18) || day === 1 || day === 2;
}
const seen = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

/** Cartão no Feed: "Sua semana virou story". */
export default function WeeklyCard() {
  const { me } = useSession();
  const show = inWindow();
  const { data } = useLoad(show ? '/me/weekly' : null);
  const [hidden, setHidden] = useState(false);
  if (!show || hidden || !data?.activeDays || seen() === data.start) return null;
  const dismiss = () => { try { localStorage.setItem(KEY, data.start); } catch { /* ok */ } setHidden(true); };
  return (
    <section className="card row gap-14 tap" style={{ padding: 12, background: 'var(--nobi-tinta)', color: '#FFFFFF', position: 'relative' }} aria-label="Resumo da semana">
      <Link to="/semana" onClick={dismiss} className="row gap-14 grow" style={{ color: 'inherit' }}>
        <span className="block-brasa" style={{ width: 64, height: 88, borderRadius: 14, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }} aria-hidden="true">
          <Broto size={58} stage={me.stage} golden={me.golden} expression="comemorando" shadow={false} />
        </span>
        <span className="stack grow" style={{ gap: 2 }}>
          <span className="label-caps t-12" style={{ opacity: 0.7 }}>{data.label}</span>
          <span className="title t-20" style={{ fontWeight: 800 }}>Sua semana virou story</span>
          <span className="t-13" style={{ opacity: 0.8 }}>{data.activeDays} de 7 dias ativos. Pronto pra postar.</span>
        </span>
      </Link>
      <button type="button" className="icon-btn plain" aria-label="Dispensar" onClick={dismiss} style={{ color: 'inherit', alignSelf: 'flex-start' }}><Icon name="close" size={18} /></button>
    </section>
  );
}
