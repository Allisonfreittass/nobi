// "Primeiros passos" no topo do feed para quem acabou de chegar: um caminho curto até o app ficar vivo.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import Broto from './Broto.jsx';
import InviteSheet from './InviteSheet.jsx';
import { ProgressBar } from './ui.jsx';
import { api } from '../lib/api.js';
import { useLoad } from '../lib/useLoad.js';
import { useBroto, useSession } from '../lib/session.jsx';
import { shareInvite } from '../lib/invite.js';
import { ClubTile, useJoin } from '../screens/community/parts.jsx';

export default function FirstSteps() {
  const { me } = useSession();
  const broto = useBroto();
  const { data, setData, reload } = useLoad('/home/onboarding');
  const [invite, setInvite] = useState(false);
  const { join, busy } = useJoin(() => reload());
  if (!data?.show) return null;
  const done = data.steps.filter((s) => s.done).length;
  async function dismiss() {
    setData({ ...data, show: false });
    api('/home/onboarding/dismiss', { method: 'POST' }).catch(() => {});
  }
  async function callFriend() {
    if ((await shareInvite(me.username)) === 'unavailable') setInvite(true);
  }
  const clubStep = data.steps.find((s) => s.id === 'club');
  return (
    <section className="card stack gap-12" aria-label="Primeiros passos">
      <div className="row gap-12">
        <span style={{ flexShrink: 0 }}><Broto size={64} expression="padrao" {...broto} shadow={false} /></span>
        <div className="stack grow" style={{ gap: 4 }}>
          <h2 className="title t-18">Primeiros passos</h2>
          <span className="t-13 secondary">{done} de {data.steps.length}. Junto é mais fácil: o feed ganha vida com amigos e clubes.</span>
          <ProgressBar value={done / data.steps.length} height={6} label="Primeiros passos feitos" />
        </div>
        <button type="button" className="icon-btn plain" aria-label="Fechar primeiros passos" onClick={dismiss} style={{ alignSelf: 'flex-start' }}><Icon name="close" size={18} /></button>
      </div>
      <ol className="card flush card-list" style={{ listStyle: 'none', margin: 0, padding: 0, background: 'var(--nobi-bg)' }}>
        {data.steps.map((s) => {
          const body = (
            <>
              <span className={`first-step-check${s.done ? ' on' : ''}`} aria-hidden="true">{s.done && <Icon name="check" size={14} stroke={3} />}</span>
              <span className="t-15 grow" style={{ fontWeight: 600, textDecoration: s.done ? 'line-through' : 'none', color: s.done ? 'var(--nobi-text-muted)' : undefined }}>{s.label}</span>
              {!s.done && <Icon name="chevron" size={16} />}
              <span className="sr-only">{s.done ? 'feito' : 'a fazer'}</span>
            </>
          );
          return (
            <li key={s.id}>
              {s.done ? <div className="list-row" style={{ minHeight: 52 }}>{body}</div>
                : s.to ? <Link to={s.to} className="list-row" style={{ minHeight: 52 }}>{body}</Link>
                  : <button type="button" className="list-row" style={{ minHeight: 52 }} onClick={callFriend}>{body}</button>}
            </li>
          );
        })}
      </ol>
      {!clubStep?.done && data.clubs?.length > 0 && (
        <div className="stack gap-8">
          <span className="t-14 strong">Clubes para começar</span>
          {data.clubs.map((c) => (
            <div key={c.id} className="row gap-12">
              <Link to={`/clubes/${c.slug}`} className="row gap-12 grow" style={{ minWidth: 0 }}>
                <ClubTile club={c} size={40} />
                <span className="stack grow" style={{ gap: 1, minWidth: 0 }}>
                  <span className="t-14 strong ellipsis">{c.name}</span>
                  <span className="t-12 secondary ellipsis">{[c.tags, c.city].filter(Boolean).join(' · ')}</span>
                </span>
              </Link>
              <button type="button" className="btn sm btn-dark" style={{ flexShrink: 0 }} disabled={busy} onClick={() => join(c)}>Entrar</button>
            </div>
          ))}
        </div>
      )}
      <InviteSheet open={invite} onClose={() => setInvite(false)} username={me.username} />
    </section>
  );
}
