// Moderação da Equipe Nobi: denúncias de todo o app, clubes abertos novos e contas suspensas.
import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Avatar, BackButton, ErrorNote, Skeleton } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useLoad, invalidateLoad } from '../lib/useLoad.js';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { useConfirm } from '../lib/confirm.jsx';
import { timeAgo } from '../lib/format.js';
import { ClubTile, people } from './community/parts.jsx';

const REASON = { spam: 'Spam', assedio: 'Assédio', improprio: 'Impróprio', falso: 'Falso', outro: 'Outro' };
const TYPE = { post: 'Post', user: 'Conta', comment: 'Comentário', club: 'Clube', message: 'Mensagem' };
const TABS = [['denuncias', 'Denúncias'], ['clubes', 'Clubes novos'], ['suspensas', 'Suspensas']];

function Pill({ children, tone }) {
  const bg = tone === 'danger' ? 'var(--nobi-danger)' : 'var(--nobi-track)';
  return <span className="t-12 strong" style={{ padding: '4px 9px', borderRadius: 10, background: bg, color: tone === 'danger' ? '#FFFFFF' : 'var(--nobi-text)', whiteSpace: 'nowrap' }}>{children}</span>;
}

function Target({ g }) {
  const t = g.target;
  if (!t) return <p className="t-14 muted">O conteúdo já foi apagado. Resolva para tirar da fila.</p>;
  if (t.post) {
    const p = t.post;
    return (
      <div className="stack gap-6" style={{ padding: 12, borderRadius: 16, background: 'var(--nobi-bg)' }}>
        <span className="row gap-8 t-13 strong">{p.user ? <><Avatar user={p.user} size={24} /><Link to={`/u/${p.user.username}`}>{p.user.name}</Link></> : 'Autor suspenso'}</span>
        {p.title && <span className="strong t-15">{p.title}</span>}
        {p.text && <p className="t-15" style={{ whiteSpace: 'pre-wrap' }}>{p.text}</p>}
        {p.photo?.url && <img src={p.photo.url} alt="Foto do post denunciado" loading="lazy" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 12 }} />}
      </div>
    );
  }
  if (t.comment) {
    return (
      <div className="stack gap-4" style={{ padding: 12, borderRadius: 16, background: 'var(--nobi-bg)' }}>
        <span className="t-13 strong">{t.comment.user?.name || 'Conta removida'}</span>
        <p className="t-15">{t.comment.text}</p>
      </div>
    );
  }
  if (t.message) {
    return (
      <div className="stack gap-4" style={{ padding: 12, borderRadius: 16, background: 'var(--nobi-bg)' }}>
        <span className="t-13 strong">{t.message.user?.name || 'Conta removida'}{t.message.club ? ` · conversa de ${t.message.club.name}` : ''}</span>
        <p className="t-15" style={{ whiteSpace: 'pre-wrap' }}>{t.message.text}</p>
      </div>
    );
  }
  if (t.user) {
    const u = t.user;
    return (
      <Link to={`/u/${u.username}`} className="row gap-12" style={{ padding: 12, borderRadius: 16, background: 'var(--nobi-bg)' }}>
        <Avatar user={u} size={44} />
        <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="strong t-15">{u.name} <span className="muted">@{u.username}</span></span>
          <span className="t-13 muted">{u.posts} posts · conta de {timeAgo(u.createdAt)}{u.reportsAgainst > 1 ? ` · ${u.reportsAgainst} denúncias no total` : ''}</span>
          {u.bio && <span className="t-13 secondary">{u.bio}</span>}
        </span>
      </Link>
    );
  }
  if (t.club) {
    const c = t.club;
    return (
      <Link to={`/clubes/${c.slug}`} className="row gap-12" style={{ padding: 12, borderRadius: 16, background: 'var(--nobi-bg)' }}>
        <ClubTile club={c} size={44} />
        <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="strong t-15">{c.name}</span>
          <span className="t-13 muted">{c.tags} · {c.city || 'Online'} · {people(c.membersCount)} membros{c.kind === 'official' ? ' · oficial' : ''}</span>
          {c.description && <span className="t-13 secondary">{c.description}</span>}
        </span>
      </Link>
    );
  }
  return null;
}

function ReportCard({ g, onDone, readOnly }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  async function act(action) {
    const danger = {
      'delete-post': ['Apagar o post?', 'Some para todo mundo, com os comentários e a foto.', 'Apagar post'],
      'delete-comment': ['Apagar o comentário?', 'Some para todo mundo.', 'Apagar comentário'],
      'delete-message': ['Apagar a mensagem?', 'Some da conversa do clube para todo mundo.', 'Apagar mensagem'],
      'delete-club': ['Encerrar o clube?', 'O clube some e os membros saem. Os posts continuam no perfil de cada um.', 'Encerrar clube'],
      suspend: ['Suspender a conta?', 'A pessoa sai de todos os aparelhos, não consegue entrar e some das buscas e dos feeds. Dá para desfazer em Suspensas.', 'Suspender'],
    }[action];
    if (danger && !(await confirm({ title: danger[0], message: danger[1], confirmLabel: danger[2], danger: true }))) return;
    setBusy(true);
    try {
      const r = await api('/admin/reports/resolve', { method: 'POST', body: { targetType: g.targetType, targetId: g.targetId, action, reason: g.topReason } });
      toast(r.resolution === 'mantido' ? 'Mantido. Denúncias fechadas.' : `Feito: ${r.resolution}.`);
      onDone(g.key, r.resolution);
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  const t = g.targetType;
  const reasons = Object.entries(g.reasons).map(([r, n]) => `${REASON[r]}${n > 1 ? ` ×${n}` : ''}`).join(' · ');
  const details = g.reports.map((r) => r.details).filter(Boolean);
  return (
    <article className="card stack gap-12">
      <div className="row between gap-8">
        <span className="row gap-6 wrap">
          <Pill>{TYPE[t]}</Pill>
          <Pill tone={g.count > 2 || g.topReason === 'assedio' ? 'danger' : undefined}>{g.count} {g.count === 1 ? 'denúncia' : 'denúncias'}</Pill>
        </span>
        <span className="t-12 muted">{timeAgo(g.lastAt)}</span>
      </div>
      <span className="t-14 strong" style={{ marginBottom: details.length ? -6 : 0 }}>{reasons}</span>
      {details.length > 0 && (
        <ul className="stack gap-4" style={{ margin: 0, paddingLeft: 18, listStyle: 'disc' }}>
          {details.slice(0, 3).map((d, i) => <li key={i} className="t-13 secondary">“{d}”</li>)}
        </ul>
      )}
      <Target g={g} />
      {readOnly ? <span className="t-13 muted">Resolvido: {g.resolution}</span> : (
        <div className="row gap-8 wrap">
          {t === 'post' && !g.gone && <button type="button" className="btn sm btn-dark" disabled={busy} onClick={() => act('delete-post')}>Apagar post</button>}
          {t === 'comment' && !g.gone && <button type="button" className="btn sm btn-dark" disabled={busy} onClick={() => act('delete-comment')}>Apagar comentário</button>}
          {t === 'message' && !g.gone && <button type="button" className="btn sm btn-dark" disabled={busy} onClick={() => act('delete-message')}>Apagar mensagem</button>}
          {t === 'club' && !g.gone && g.target.club.kind !== 'official' && <button type="button" className="btn sm btn-dark" disabled={busy} onClick={() => act('delete-club')}>Encerrar clube</button>}
          {t !== 'club' && !g.gone && !g.target?.user?.suspendedAt && <button type="button" className="btn sm btn-soft" style={{ color: 'var(--nobi-danger)' }} disabled={busy} onClick={() => act('suspend')}>Suspender conta</button>}
          <button type="button" className="btn sm btn-soft" disabled={busy} onClick={() => act('keep')}>{g.gone ? 'Tirar da fila' : 'Manter'}</button>
        </div>
      )}
    </article>
  );
}

function Reports({ onChange }) {
  const [done, setDone] = useState(false);
  const path = `/admin/reports${done ? '?status=done' : ''}`;
  const { data, error, reload, setData } = useLoad(path);
  const remove = (key, resolution) => {
    invalidateLoad('/admin/reports?status=done', '/admin/suspended');
    onChange();
    // Suspender pode fechar outros itens da mesma pessoa: busca a fila de novo
    if (resolution === 'conta suspensa') reload(); else setData(data.filter((g) => g.key !== key));
  };
  return (
    <>
      <div className="segmented compact bg-segment" role="group" aria-label="Situação">
        <button type="button" aria-pressed={!done} onClick={() => setDone(false)}>Abertas</button>
        <button type="button" aria-pressed={done} onClick={() => setDone(true)}>Resolvidas</button>
      </div>
      <ErrorNote error={error} onRetry={reload} />
      {!data && !error && <><Skeleton height={180} /><Skeleton height={180} /></>}
      {data?.length === 0 && <p className="t-15 secondary">{done ? 'Nada resolvido ainda.' : 'Nenhuma denúncia aberta. Comunidade tranquila.'}</p>}
      {data?.map((g) => <ReportCard key={g.key} g={g} onDone={remove} readOnly={done} />)}
    </>
  );
}

function NewClubs() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, reload, setData } = useLoad('/admin/clubs');
  async function close(c) {
    if (!(await confirm({ title: `Encerrar ${c.name}?`, message: 'O clube some e os membros saem. Os posts continuam no perfil de cada um.', confirmLabel: 'Encerrar clube', danger: true }))) return;
    try {
      await api(`/admin/clubs/${c.id}`, { method: 'DELETE' });
      setData(data.filter((x) => x.id !== c.id));
      toast('Clube encerrado.');
    } catch (e) { toast(e.message); }
  }
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Skeleton height={200} />;
  if (!data.length) return <p className="t-15 secondary">Ninguém criou clube aberto ainda.</p>;
  return (
    <div className="card flush card-list">
      {data.map((c) => (
        <div key={c.id} className="list-row" style={{ alignItems: 'flex-start' }}>
          <Link to={`/clubes/${c.slug}`} className="row gap-12 grow" style={{ minWidth: 0, alignItems: 'flex-start' }}>
            <ClubTile club={c} size={44} />
            <span className="stack" style={{ gap: 2, minWidth: 0 }}>
              <span className="strong t-15">{c.name}</span>
              <span className="t-13 muted">{c.tags} · {c.city || 'Online'} · {people(c.membersCount)} membros · {timeAgo(c.createdAt)}</span>
              {c.creator && <span className="t-13 secondary">por {c.creator.name} (@{c.creator.username})</span>}
              {c.description && <span className="t-13 secondary">{c.description}</span>}
              {c.openReports > 0 && <span style={{ alignSelf: 'flex-start', marginTop: 4 }}><Pill tone="danger">{c.openReports} denúncias abertas</Pill></span>}
            </span>
          </Link>
          <button type="button" className="icon-btn plain" aria-label={`Encerrar ${c.name}`} onClick={() => close(c)}><Icon name="trash" size={18} /></button>
        </div>
      ))}
    </div>
  );
}

function Suspended() {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad('/admin/suspended');
  async function undo(u) {
    try {
      await api(`/admin/users/${u.id}/unsuspend`, { method: 'POST' });
      setData(data.filter((x) => x.id !== u.id));
      toast(`${u.name} pode entrar de novo.`);
    } catch (e) { toast(e.message); }
  }
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return <Skeleton height={160} />;
  if (!data.length) return <p className="t-15 secondary">Nenhuma conta suspensa.</p>;
  return (
    <div className="card flush card-list">
      {data.map((u) => (
        <div key={u.id} className="list-row">
          <Avatar user={u} size={40} />
          <span className="stack grow" style={{ gap: 1, minWidth: 0 }}>
            <span className="strong t-15 ellipsis">{u.name} <span className="muted">@{u.username}</span></span>
            <span className="t-13 muted">suspensa {timeAgo(u.suspendedAt)}{u.reason ? ` · ${REASON[u.reason] || u.reason}` : ''}</span>
          </span>
          <button type="button" className="btn sm btn-soft" onClick={() => undo(u)}>Reativar</button>
        </div>
      ))}
    </div>
  );
}

export default function Moderation() {
  const { me } = useSession();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([v]) => v === params.get('aba')) ? params.get('aba') : 'denuncias';
  const summary = useLoad(me.staff ? '/admin/summary' : null);
  if (!me.staff) return <Navigate to="/configuracoes" replace />;
  const s = summary.data;
  const count = { denuncias: s?.openReports, clubes: s?.newClubs, suspensas: s?.suspended };
  return (
    <div className="screen">
      <div className="row gap-8"><BackButton /><h1 className="title t-24">Moderação</h1></div>
      <p className="t-14 secondary">Fila da Equipe Nobi. Denúncias de clubes também chegam à moderação de cada clube; aqui aparece tudo.</p>
      <div className="segmented bg-segment" role="tablist" aria-label="Seção">
        {TABS.map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} aria-pressed={tab === v} onClick={() => setParams(v === 'denuncias' ? {} : { aba: v }, { replace: true })}>
            {label}{count[v] ? ` · ${count[v]}` : ''}
          </button>
        ))}
      </div>
      {tab === 'denuncias' && <Reports onChange={summary.reload} />}
      {tab === 'clubes' && <NewClubs />}
      {tab === 'suspensas' && <Suspended />}
    </div>
  );
}
