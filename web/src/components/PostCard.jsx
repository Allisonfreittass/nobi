import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Avatar, StreakPill } from './ui.jsx';
import { api } from '../lib/api.js';
import { CATEGORIES, timeAgo, fmtNum, signed, unitShort } from '../lib/format.js';
import { useToast } from '../lib/toast.jsx';
import { useConfirm } from '../lib/confirm.jsx';

function Metric({ value, unit, caption }) {
  return (
    <div className="stack gap-4" style={{ minWidth: 0 }}>
      <span className="row gap-4" style={{ alignItems: 'baseline' }}>
        <span className="num t-28" style={{ lineHeight: 1 }}>{value}</span>
        {unit && <span className="t-14 strong">{unit}</span>}
      </span>
      {caption && <span className="t-12 muted">{caption}</span>}
    </div>
  );
}

function Comments({ post, onCount }) {
  const [list, setList] = useState(null);
  const [text, setText] = useState('');
  const toast = useToast();
  useEffect(() => {
    api(`/posts/${post.id}/comments`).then(setList).catch(() => setList([]));
  }, [post.id]);
  if (list === null) return <p className="t-13 muted">Carregando comentários…</p>;
  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const c = await api(`/posts/${post.id}/comments`, { method: 'POST', body: { text } });
      setList((l) => [...l, c]);
      setText('');
      onCount(1);
    } catch (err) { toast(err.message); }
  }
  async function remove(c) {
    await api(`/posts/${post.id}/comments/${c.id}`, { method: 'DELETE' });
    setList((l) => l.filter((x) => x.id !== c.id));
    onCount(-1);
  }
  return (
    <div className="stack gap-10">
      {list.map((c) => (
        <div key={c.id} className="row gap-10" style={{ alignItems: 'flex-start' }}>
          <Avatar user={c.user} size={30} />
          <div className="grow t-14" style={{ background: 'var(--nobi-bg)', borderRadius: 14, padding: '8px 12px' }}>
            <Link to={`/u/${c.user.username}`} className="strong">{c.user.name.split(' ')[0]}</Link> {c.text}
          </div>
          {(c.mine || post.mine) && (
            <button type="button" className="icon-btn plain" aria-label="Apagar comentário" onClick={() => remove(c)}><Icon name="trash" size={16} /></button>
          )}
        </div>
      ))}
      <form className="row gap-8" onSubmit={send}>
        <label className="sr-only" htmlFor={`c-${post.id}`}>Comentar</label>
        <input id={`c-${post.id}`} className="input" style={{ minHeight: 44, height: 44 }} value={text} maxLength={280} onChange={(e) => setText(e.target.value)} placeholder="Escreva um comentário" />
        <button type="submit" className="btn btn-dark sm" disabled={!text.trim()}>Enviar</button>
      </form>
    </div>
  );
}

export default function PostCard({ post: initial, compact = false, onDelete }) {
  const [post, setPost] = useState(initial);
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();
  const cat = CATEGORIES[post.category] || CATEGORIES.objetivo;
  const m = post.metrics || {};

  async function react() {
    const optimistic = { ...post, reacted: !post.reacted, reactionsCount: post.reactionsCount + (post.reacted ? -1 : 1) };
    setPost(optimistic);
    if (!post.reacted) { setPop(true); setTimeout(() => setPop(false), 450); }
    try { setPost(await api(`/posts/${post.id}/react`, { method: 'POST' })); } catch (e) { setPost(post); toast(e.message); }
  }
  async function remove() {
    if (!(await confirm({ title: 'Apagar este post?', message: 'O registro continua nas suas sequências.', confirmLabel: 'Apagar', danger: true }))) return;
    await api(`/posts/${post.id}`, { method: 'DELETE' });
    onDelete?.(post.id);
  }

  const metrics = [];
  if (m.km) metrics.push(<Metric key="km" value={fmtNum(m.km)} unit="km" caption={m.minutes ? `${m.minutes} min` : undefined} />);
  if (m.minutes && !m.km) metrics.push(<Metric key="min" value={m.minutes} unit="min" />);
  if (m.pages) metrics.push(<Metric key="p" value={m.pages} unit="páginas" />);
  if (m.deltaVsLastMonth != null && !compact) metrics.push(<Metric key="d" value={signed(m.deltaVsLastMonth)} caption="vs. mês passado" />);

  const reactors = post.reactorNames?.length
    ? `${post.reactorNames[0]}${post.reactionsCount - (post.reacted ? 1 : 0) > 1 ? ` e +${post.reactionsCount - (post.reacted ? 1 : 0) - 1}` : ''} reagi${post.reactionsCount - (post.reacted ? 1 : 0) > 1 ? 'ram' : 'u'}`
    : null;

  return (
    <article className="card stack gap-14" aria-label={`Post de ${post.user.name}`}>
      <header className="row gap-12">
        <Link to={`/u/${post.user.username}`} aria-label={`Perfil de ${post.user.name}`}><Avatar user={post.user} size={44} /></Link>
        <div className="grow stack" style={{ gap: 2 }}>
          <Link to={`/u/${post.user.username}`} className="strong t-15 ellipsis">{post.user.name}</Link>
          <span className="row gap-6 t-13 secondary" style={{ flexWrap: 'wrap', rowGap: 0, whiteSpace: 'nowrap' }}>
            <span style={{ width: 8, height: 8, flexShrink: 0, borderRadius: 3, background: cat.color }} aria-hidden="true" />
            {post.kind === 'weekly' ? 'Resumo da semana' : cat.label}<span aria-hidden="true">·</span>{timeAgo(post.createdAt)}
            {post.audience === 'public' ? <Icon name="globe" size={13} /> : <Icon name="users" size={13} />}
            <span className="sr-only">{post.audience === 'public' ? 'Público' : 'Amigos'}</span>
          </span>
        </div>
        {m.streak > 1 && <StreakPill value={m.streak} unit={unitShort(m.streakUnit, m.streak)} active />}
        {post.mine && onDelete && <button type="button" className="icon-btn plain" aria-label="Apagar post" onClick={remove}><Icon name="trash" size={18} /></button>}
      </header>

      {post.title && (
        <span className="row gap-8 title t-18" style={{ alignSelf: 'flex-start' }}>
          {post.kind === 'record' && <span className="block-brasa t-12 strong" style={{ padding: '4px 9px', borderRadius: 9, fontFamily: 'var(--nobi-font-body)', letterSpacing: 0 }}>Recorde</span>}
          {post.kind === 'milestone' && <Icon name="medal" size={20} style={{ color: 'var(--nobi-orbita)' }} />}
          {post.kind === 'start' && <Icon name="sprout" size={20} style={{ color: '#2E9C6A' }} />}
          {post.kind !== 'record' && post.title}
        </span>
      )}
      {post.text && <p className={compact ? 't-14' : 't-15'} style={{ lineHeight: 1.5 }}>{post.text}</p>}

      {post.photo && (
        <img src={post.photo.url} alt={post.text || `Foto de ${post.user.name}`} loading="lazy" decoding="async" width={post.photo.w} height={post.photo.h}
          style={post.kind === 'weekly'
            ? { width: compact ? 'min(100%, 200px)' : 'min(100%, 300px)', height: 'auto', aspectRatio: '9 / 16', alignSelf: 'center', borderRadius: 22, background: 'var(--nobi-brasa)' }
            : { width: '100%', height: 'auto', aspectRatio: `${post.photo.w} / ${post.photo.h}`, maxHeight: compact ? 260 : 520, objectFit: 'cover', borderRadius: 18, background: 'var(--nobi-track)' }} />
      )}
      {metrics.length > 0 && (
        <div className="row gap-20 wrap" style={{ padding: '12px 14px', borderRadius: 18, background: 'var(--nobi-bg)' }}>{metrics}</div>
      )}

      <footer className="row gap-8 wrap">
        <button type="button" className={`btn sm ${post.reacted ? 'btn-dark' : 'btn-soft'}`} style={{ height: 44 }} aria-pressed={post.reacted} onClick={react}>
          <span className={pop ? 'nobi-bump' : ''} style={{ display: 'inline-flex' }}><Icon name="clap" size={18} /></span>
          Boa! {post.reactionsCount > 0 && <span>{post.reactionsCount}</span>}
        </button>
        <button type="button" className="btn btn-soft sm" style={{ height: 44 }} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Icon name="comment" size={18} /> {post.commentsCount > 0 ? post.commentsCount : 'Comentar'}
          <span className="sr-only">comentários</span>
        </button>
        {reactors && !compact && <span className="t-13 muted grow" style={{ textAlign: 'right' }}>{reactors}</span>}
      </footer>
      {open && <Comments post={post} onCount={(d) => setPost((p) => ({ ...p, commentsCount: p.commentsCount + d }))} />}
    </article>
  );
}
