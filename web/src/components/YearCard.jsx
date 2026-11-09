// Cartão no Feed em dezembro e no começo de janeiro: "Seu ano no Nobi está pronto".
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Broto from './Broto.jsx';
import Icon from './Icon.jsx';
import { useLoad } from '../lib/useLoad.js';
import { brotoOf, useSession } from '../lib/session.jsx';
import { APP_NAME } from '../config.js';

const KEY = 'nobi.year.seen';
const inWindow = (d = new Date()) => d.getMonth() === 11 || (d.getMonth() === 0 && d.getDate() <= 15);
const seen = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

export default function YearCard() {
  const { me } = useSession();
  const show = inWindow();
  const { data } = useLoad(show ? '/me/year' : null);
  const [hidden, setHidden] = useState(false);
  if (!show || hidden || !data?.activeDays || seen() === String(data.year)) return null;
  const dismiss = () => { try { localStorage.setItem(KEY, String(data.year)); } catch { /* ok */ } setHidden(true); };
  return (
    <section className="card row gap-14 tap" style={{ padding: 12, background: 'var(--nobi-orbita)', color: '#FFFFFF' }} aria-label="Retrospectiva do ano">
      <Link to="/ano" onClick={dismiss} className="row gap-14 grow" style={{ color: 'inherit' }}>
        <span className="block-creme" style={{ width: 72, height: 88, borderRadius: 14, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true">
          <Broto size={64} {...brotoOf(me)} expression="comemorando" shadow={false} />
        </span>
        <span className="stack grow" style={{ gap: 2 }}>
          <span className="label-caps t-12" style={{ opacity: 0.8 }}>Retrospectiva {data.year}</span>
          <span className="title t-20" style={{ fontWeight: 800 }}>Seu ano no {APP_NAME}</span>
          <span className="t-13" style={{ opacity: 0.85 }}>{data.activeDays} dias de evolução. Vem ver.</span>
        </span>
      </Link>
      <button type="button" className="icon-btn plain" aria-label="Dispensar" onClick={dismiss} style={{ color: 'inherit', alignSelf: 'flex-start' }}><Icon name="close" size={18} /></button>
    </section>
  );
}
