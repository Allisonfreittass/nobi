import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Broto from '../components/Broto.jsx';
import { Avatar, BackButton, ErrorNote, Skeleton } from '../components/ui.jsx';
import { useLoad } from '../lib/useLoad.js';
import { useSession } from '../lib/session.jsx';
import { api } from '../lib/api.js';
import { firstName, timeAgo } from '../lib/format.js';

export default function Notifications() {
  const { me } = useSession();
  const navigate = useNavigate();
  const { data, error, reload, setData } = useLoad('/home/notifications');
  useEffect(() => { api('/me/notifications/seen', { method: 'POST' }).catch(() => {}); }, []);
  const drop = (id) => setData((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));

  async function follow(item, action) {
    await api(`/users/follow-requests/${item.requestId}/${action}`, { method: 'POST' });
    drop(item.id);
  }
  async function invite(item, yes) {
    await api(`/goals/${item.goal.id}/${yes ? 'join' : 'decline'}`, { method: 'POST' });
    drop(item.id);
    if (yes) navigate(`/desafios/${item.goal.id}`);
  }

  function render(i) {
    switch (i.type) {
      case 'reminder':
        return (
          <Link to="/metas" className="list-row">
            <span style={{ width: 44, height: 44, borderRadius: 16, background: 'var(--nobi-brasa)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}><Broto size={38} stage={me.stage} golden={me.golden} shadow={false} /></span>
            <span className="grow t-14"><strong>{i.count === 1 ? "Falta" : "Faltam"} {i.count} hoje.</strong> {i.titles.join(', ')}. Sem pressa: cada objetivo tem a sua sequência.</span>
          </Link>
        );
      case 'follow-request':
        return (
          <div className="list-row">
            <Avatar user={i.user} size={44} />
            <span className="grow t-14"><strong>{i.user.name}</strong> quer seguir você</span>
            <button type="button" className="btn btn-dark sm" onClick={() => follow(i, 'accept')}>Aceitar</button>
            <button type="button" className="icon-btn plain" aria-label="Recusar" onClick={() => follow(i, 'decline')}><Icon name="close" /></button>
          </div>
        );
      case 'invite':
        return (
          <div className="list-row">
            <Avatar user={i.user} size={44} />
            <span className="grow t-14"><strong>{firstName(i.user?.name)}</strong> chamou você para <strong>{i.goal.title}</strong> · {i.goal.mode === 'together' ? 'Juntos' : 'Disputa'}</span>
            <button type="button" className="btn btn-orbita sm" onClick={() => invite(i, true)}>Topar</button>
          </div>
        );
      case 'reaction':
        return (
          <Link to={`/u/${me.username}`} className="list-row">
            <Avatar user={i.user} size={44} />
            <span className="grow t-14"><strong>{firstName(i.user.name)}</strong> disse “Boa!” {i.post.title ? <>em <strong>{i.post.title}</strong></> : 'no seu post'} <span className="muted">· {timeAgo(i.at)}</span></span>
            <Icon name="clap" size={18} />
          </Link>
        );
      case 'comment':
        return (
          <Link to={`/u/${me.username}`} className="list-row">
            <Avatar user={i.user} size={44} />
            <span className="grow t-14"><strong>{firstName(i.user.name)}</strong> comentou: “{i.text}” <span className="muted">· {timeAgo(i.at)}</span></span>
          </Link>
        );
      default:
        return null;
    }
  }

  return (
    <div className="screen">
      <header className="screen-head"><BackButton /><h1 className="title t-20">Notificações</h1><span style={{ width: 44 }} /></header>
      <ErrorNote error={error} onRetry={reload} />
      {!data && !error && <Skeleton height={240} />}
      {data?.items.length === 0 && (
        <div className="card empty"><Broto size={90} outlined /><p className="t-15 secondary">Tudo em dia por aqui.</p></div>
      )}
      {data?.items.length > 0 && <div className="card flush card-list">{data.items.map((i) => <div key={i.id}>{render(i)}</div>)}</div>}
    </div>
  );
}
