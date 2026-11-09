import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Broto, { BrotoHead } from '../components/Broto.jsx';
import { Avatar, BackButton, ErrorNote, Skeleton } from '../components/ui.jsx';
import { invalidateLoad, useLoad } from '../lib/useLoad.js';
import { useToast } from '../lib/toast.jsx';
import { brotoOf, useSession } from '../lib/session.jsx';
import { api } from '../lib/api.js';
import { firstName, timeAgo } from '../lib/format.js';

export default function Notifications() {
  const { me } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
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

  async function group(item, yes) {
    try {
      await api(`/clubs/${item.club.slug}/invite/${yes ? 'accept' : 'decline'}`, { method: 'POST' });
      drop(item.id);
      invalidateLoad('/community');
      if (yes) navigate(`/clubes/${item.club.slug}`);
    } catch (e) { toast(e.message); drop(item.id); }
  }

  function render(i) {
    switch (i.type) {
      case 'reminder':
        return (
          <Link to="/metas" className="list-row">
            <span style={{ flexShrink: 0 }}><BrotoHead size={44} /></span>
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
      case 'nudge':
        return (
          <Link to={i.goal.challenge ? `/desafios/${i.goal.id}` : `/metas/${i.goal.id}`} className="list-row">
            <Avatar user={i.user} size={44} />
            <span className="grow t-14"><strong>{firstName(i.user.name)}</strong> lembrou de você: falta você hoje em <strong>{i.goal.title}</strong> <span className="muted">· {timeAgo(i.at)}</span></span>
            <Icon name="chevron" size={18} />
          </Link>
        );
      case 'group-invite':
        return (
          <div className="list-row">
            {i.user ? <Avatar user={i.user} size={44} /> : <Icon name="users" size={28} />}
            <span className="grow t-14">{i.user ? <strong>{firstName(i.user.name)}</strong> : 'Alguém'} chamou você para o grupo <strong>{i.club.name}</strong></span>
            <button type="button" className="btn btn-dark sm" onClick={() => group(i, true)}>Entrar</button>
            <button type="button" className="icon-btn plain" aria-label={`Recusar convite para ${i.club.name}`} onClick={() => group(i, false)}><Icon name="close" /></button>
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
      case 'mention':
        return (
          <Link to={i.post.author ? `/u/${i.post.author}` : `/u/${i.user.username}`} className="list-row">
            <Avatar user={i.user} size={44} />
            <span className="grow t-14"><strong>{firstName(i.user.name)}</strong> mencionou você: “{i.text}” <span className="muted">· {timeAgo(i.at)}</span></span>
            <Icon name="comment" size={18} />
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
        <div className="card empty"><Broto size={90} expression="padrao" {...brotoOf(me)} /><p className="t-15 secondary">Tudo em dia por aqui.</p></div>
      )}
      {data?.items.length > 0 && <div className="card flush card-list">{data.items.map((i) => <div key={i.id}>{render(i)}</div>)}</div>}
    </div>
  );
}
