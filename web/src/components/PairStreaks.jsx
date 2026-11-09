// Sequência a dois no feed: o dia conta quando os dois registram algo. Cutucar quando falta a outra pessoa.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Avatar } from './ui.jsx';
import { api } from '../lib/api.js';
import { useLoad, invalidateLoad } from '../lib/useLoad.js';
import { useToast } from '../lib/toast.jsx';
import { firstName } from '../lib/format.js';

function status(p) {
  if (p.status === 'pending') return p.invitedByMe ? `Esperando ${firstName(p.partner.name)} aceitar` : `${firstName(p.partner.name)} chamou você`;
  if (p.meToday && p.partnerToday) return 'Os dois fizeram hoje';
  if (p.meToday) return `Falta ${firstName(p.partner.name)} hoje`;
  if (p.partnerToday) return `${firstName(p.partner.name)} já fez. Falta você`;
  return 'Ninguém registrou ainda hoje';
}

export default function PairStreaks() {
  const { data, setData } = useLoad('/pairs');
  const toast = useToast();
  const [nudged, setNudged] = useState(() => new Set());
  if (!data?.length) return null;
  async function nudge(p) {
    try {
      await api(`/pairs/${p.id}/nudge`, { method: 'POST' });
      toast(`${firstName(p.partner.name)} vai receber um lembrete.`);
    } catch (e) { toast(e.message); }
    setNudged((n) => new Set(n).add(p.id));
  }
  async function accept(p) {
    try {
      const v = await api(`/pairs/${p.id}/accept`, { method: 'POST' });
      setData(data.map((x) => (x.id === p.id ? v : x)));
      invalidateLoad('/home/notifications');
    } catch (e) { toast(e.message); }
  }
  return (
    <section className="stack gap-8" aria-label="Sequências a dois">
      <h2 className="t-15 strong">Sequência a dois</h2>
      <ul className="pair-strip">
        {data.map((p) => (
          <li key={p.id} className="card pair-card">
            <Link to={`/u/${p.partner.username}`} className="row gap-10" style={{ minWidth: 0 }}>
              <Avatar user={p.partner} size={40} ring={p.partnerToday ? 'posted' : 'none'} />
              <span className="stack" style={{ gap: 1, minWidth: 0 }}>
                <span className="t-14 strong ellipsis">{firstName(p.partner.name)}</span>
                {p.status === 'active' && (
                  <span className="row gap-4 t-13 strong" style={{ color: p.streak ? 'var(--nobi-brasa)' : 'var(--nobi-text-muted)' }}>
                    <Icon name="flame" size={14} />{p.streak} {p.streak === 1 ? 'dia' : 'dias'} juntos
                  </span>
                )}
              </span>
            </Link>
            <span className="t-12 secondary">{status(p)}</span>
            {p.status === 'active' && p.meToday && !p.partnerToday && (
              <button type="button" className="nudge-btn" style={{ alignSelf: 'flex-start' }} disabled={nudged.has(p.id)} onClick={() => nudge(p)}>{nudged.has(p.id) ? 'Cutucado' : 'Cutucar'}</button>
            )}
            {p.status === 'pending' && !p.invitedByMe && (
              <button type="button" className="btn sm btn-dark" style={{ alignSelf: 'flex-start' }} onClick={() => accept(p)}>Topar</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
