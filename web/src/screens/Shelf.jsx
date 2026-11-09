// Estante: lendo agora, quero ler, lidos; meta de livros no ano; leitura em dupla.
import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Broto from '../components/Broto.jsx';
import { Avatar, BackButton, ErrorNote, ProgressBar, Sheet, Skeleton } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useLoad, invalidateLoad } from '../lib/useLoad.js';
import { useBroto, useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { useConfirm } from '../lib/confirm.jsx';
import { useCelebrate } from '../lib/celebrate.jsx';
import { firstName } from '../lib/format.js';

export function Cover({ book, size = 56 }) {
  const h = Math.round(size * 1.5);
  return book.cover
    ? <img src={book.cover} alt="" width={size} height={h} loading="lazy" style={{ width: size, height: h, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: 'var(--nobi-track)' }} />
    : <span aria-hidden="true" style={{ width: size, height: h, borderRadius: 8, flexShrink: 0, background: 'var(--nobi-orbita)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="book" size={size / 2.4} /></span>;
}

function AddBookSheet({ open, onClose, onAdded }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [manual, setManual] = useState(false);
  const [f, setF] = useState({ title: '', author: '', pages: '' });
  const [status, setStatus] = useState('reading');
  useEffect(() => { if (open) { setQ(''); setResults(null); setManual(false); setF({ title: '', author: '', pages: '' }); } }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return undefined; }
    const t = setTimeout(() => api(`/books/search?q=${encodeURIComponent(q.trim())}`).then(setResults).catch(() => setResults([])), 350);
    return () => clearTimeout(t);
  }, [q]);
  async function add(book) {
    try {
      const b = await api('/books', { method: 'POST', body: { ...book, status } });
      toast(status === 'want' ? 'Na lista de quero ler.' : status === 'done' ? 'Marcado como lido.' : 'Na estante. Boa leitura!');
      onAdded(b);
      onClose();
    } catch (e) { toast(e.message); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Adicionar livro">
      <div className="segmented" role="group" aria-label="Situação">
        {[['reading', 'Lendo'], ['want', 'Quero ler'], ['done', 'Já li']].map(([v, l]) => <button key={v} type="button" aria-pressed={status === v} onClick={() => setStatus(v)}>{l}</button>)}
      </div>
      {!manual ? (
        <>
          <label className="field">Buscar<input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Título ou autor" /></label>
          {results === null && q.trim().length >= 2 && <Skeleton height={120} />}
          {results?.length === 0 && <p className="t-14 muted">Nada encontrado. Que tal adicionar à mão?</p>}
          {results?.length > 0 && (
            <div className="card flush card-list">
              {results.map((r) => (
                <button key={r.olKey || r.title} type="button" className="list-row" onClick={() => add(r)}>
                  <Cover book={r} size={40} />
                  <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
                    <span className="t-15 strong ellipsis">{r.title}</span>
                    <span className="t-13 secondary ellipsis">{[r.author, r.pages ? `${r.pages} páginas` : null].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Icon name="plus" size={18} />
                </button>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-ghost sm" onClick={() => { setManual(true); setF({ ...f, title: q }); }}>Adicionar à mão</button>
          <p className="t-12 muted">Busca e capas do Open Library.</p>
        </>
      ) : (
        <>
          <label className="field">Título<input className="input" value={f.title} maxLength={160} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="field">Autor (opcional)<input className="input" value={f.author} maxLength={120} onChange={(e) => setF({ ...f, author: e.target.value })} /></label>
          <label className="field">Páginas (opcional)<input className="input" inputMode="numeric" value={f.pages} onChange={(e) => setF({ ...f, pages: e.target.value.replace(/\D/g, '') })} /></label>
          <button type="button" className="btn btn-dark block" disabled={!f.title.trim()} onClick={() => add({ ...f, pages: Number(f.pages) || 0 })}>Adicionar</button>
        </>
      )}
    </Sheet>
  );
}

function PagesSheet({ book, open, onClose, onSaved }) {
  const [v, setV] = useState('');
  useEffect(() => { if (open) setV(String(book?.pagesRead || '')); }, [open, book]);
  if (!book) return null;
  return (
    <Sheet open={open} onClose={onClose} title="Em que página você está?">
      <p className="t-14 secondary">{book.title}{book.pages ? ` · ${book.pages} páginas` : ''}</p>
      <label className="field">Página<input className="input" inputMode="numeric" autoFocus value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ''))} /></label>
      <p className="t-13 muted">Dica: registrando a leitura com o livro escolhido, as páginas sobem sozinhas.</p>
      <button type="button" className="btn btn-dark block" onClick={() => onSaved(Number(v) || 0)}>Salvar</button>
    </Sheet>
  );
}

function BuddySheet({ book, open, onClose }) {
  const { me } = useSession();
  const toast = useToast();
  const [friends, setFriends] = useState(null);
  useEffect(() => {
    if (open) api(`/users/${me.username}/following`).then((r) => setFriends(r.people.filter((p) => p.relation?.friends))).catch(() => setFriends([]));
  }, [open, me.username]);
  async function invite(f) {
    try {
      await api(`/books/${book.id}/buddy`, { method: 'POST', body: { userId: f.id } });
      toast(`Convite enviado para ${firstName(f.name)}.`);
      onClose();
    } catch (e) { toast(e.message); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Ler junto">
      <p className="t-14 secondary">Cada um lê no seu ritmo e vê o progresso do outro em “{book?.title}”.</p>
      {!friends && <Skeleton height={80} />}
      {friends?.length === 0 && <p className="t-14 muted">Leitura em dupla é com amigos (vocês se seguem).</p>}
      {friends?.length > 0 && (
        <div className="card flush card-list">
          {friends.map((f) => (
            <button key={f.id} type="button" className="list-row" onClick={() => invite(f)}>
              <Avatar user={f} size={32} /><span className="t-15 strong grow ellipsis">{f.name}</span><Icon name="plus" size={18} />
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function BookRow({ book, onChange, onRemove }) {
  const toast = useToast();
  const confirm = useConfirm();
  const celebrate = useCelebrate();
  const [sheet, setSheet] = useState(null); // pages | buddy | menu
  async function save(body) {
    try {
      const r = await api(`/books/${book.id}`, { method: 'PATCH', body });
      onChange(r.book);
      if (r.finished) celebrate(null, { title: 'Livro lido!', text: `“${book.title}” está na conta do ano.` });
    } catch (e) { toast(e.message); }
  }
  async function remove() {
    setSheet(null);
    if (!(await confirm({ title: 'Tirar da estante?', message: book.title, confirmLabel: 'Tirar', danger: true }))) return;
    await api(`/books/${book.id}`, { method: 'DELETE' });
    onRemove(book.id);
  }
  return (
    <div className="card row gap-12" style={{ alignItems: 'flex-start', padding: 14 }}>
      <Cover book={book} />
      <div className="stack grow" style={{ gap: 4, minWidth: 0 }}>
        <span className="t-15 strong">{book.title}</span>
        {book.author && <span className="t-13 secondary ellipsis">{book.author}</span>}
        {book.status === 'reading' && (
          <>
            {book.pct != null && <ProgressBar value={book.pct} height={6} label={`Progresso em ${book.title}`} />}
            <span className="t-12 secondary">{book.pages ? `p. ${book.pagesRead} de ${book.pages} · ${Math.round(book.pct * 100)}%` : `${book.pagesRead} páginas lidas`}</span>
          </>
        )}
        {book.status === 'done' && book.finishedAt && <span className="t-12 secondary">Lido em {book.finishedAt.split('-').reverse().join('/')}</span>}
        {book.buddy && (
          <span className="row gap-6 t-12 secondary"><Avatar user={book.buddy.user} size={20} />
            {book.buddy.status === 'invited' ? `Esperando ${firstName(book.buddy.user.name)}` : `${firstName(book.buddy.user.name)} ${book.buddy.status === 'done' ? 'já terminou' : book.buddy.pct != null ? `em ${Math.round(book.buddy.pct * 100)}%` : 'lendo junto'}`}
          </span>
        )}
        <div className="row gap-6 wrap" style={{ marginTop: 4 }}>
          {book.status === 'reading' && <button type="button" className="btn sm btn-dark" onClick={() => setSheet('pages')}>Atualizar página</button>}
          {book.status === 'want' && <button type="button" className="btn sm btn-dark" onClick={() => save({ status: 'reading' })}>Começar a ler</button>}
          {book.status === 'reading' && !book.buddy && <button type="button" className="btn sm btn-soft" onClick={() => setSheet('buddy')}>Ler junto</button>}
        </div>
      </div>
      <button type="button" className="icon-btn plain" aria-label={`Mais opções de ${book.title}`} style={{ width: 36 }} onClick={() => setSheet('menu')}><Icon name="more" size={18} /></button>
      <PagesSheet book={book} open={sheet === 'pages'} onClose={() => setSheet(null)} onSaved={(n) => { setSheet(null); save({ pagesRead: n }); }} />
      <BuddySheet book={book} open={sheet === 'buddy'} onClose={() => setSheet(null)} />
      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title={book.title}>
        <div className="card flush card-list">
          {book.status !== 'done' && <button type="button" className="list-row" onClick={() => { setSheet(null); save({ status: 'done' }); }}><Icon name="check" size={20} /><span className="t-15 strong grow">Marcar como lido</span></button>}
          {book.status !== 'want' && <button type="button" className="list-row" onClick={() => { setSheet(null); save({ status: 'want' }); }}><Icon name="book" size={20} /><span className="t-15 strong grow">Mover para quero ler</span></button>}
          {book.status === 'done' && <button type="button" className="list-row" onClick={() => { setSheet(null); save({ status: 'reading' }); }}><Icon name="book" size={20} /><span className="t-15 strong grow">Ler de novo</span></button>}
          <button type="button" className="list-row" style={{ color: 'var(--nobi-danger)' }} onClick={remove}><Icon name="trash" size={20} /><span className="t-15 strong grow">Tirar da estante</span></button>
        </div>
      </Sheet>
    </div>
  );
}

function GoalCard({ data, onSaved }) {
  const toast = useToast();
  const [n, setN] = useState(data.goal?.books || 12);
  const [editing, setEditing] = useState(false);
  async function save() {
    try { await api('/books/goal', { method: 'PUT', body: { books: n } }); setEditing(false); onSaved(); } catch (e) { toast(e.message); }
  }
  const g = data.goal;
  return (
    <section className="card stack gap-10 block-creme" style={{ color: 'var(--nobi-tinta)' }} aria-label={`Meta de livros em ${data.year}`}>
      {g && !editing ? (
        <>
          <div className="row between"><span className="title t-18">{g.done} de {g.books} livros em {data.year}</span><button type="button" className="btn sm btn-ghost" style={{ color: 'inherit' }} onClick={() => setEditing(true)}>Mudar</button></div>
          <ProgressBar value={Math.min(1, g.done / g.books)} color="var(--nobi-tinta)" height={8} label="Livros lidos no ano" />
          <span className="t-13" style={{ color: '#4A4752' }}>{g.done >= g.books ? 'Meta batida! Tudo daqui pra frente é bônus.' : `Faltam ${g.books - g.done}. Um capítulo por dia já leva longe.`}</span>
        </>
      ) : (
        <>
          <span className="title t-18">Quantos livros em {data.year}?</span>
          <div className="row gap-10">
            <button type="button" className="icon-btn" aria-label="Menos" onClick={() => setN((x) => Math.max(1, x - 1))}><Icon name="minus" /></button>
            <span className="num t-28" style={{ minWidth: 48, textAlign: 'center' }} aria-live="polite">{n}</span>
            <button type="button" className="icon-btn" aria-label="Mais" onClick={() => setN((x) => Math.min(500, x + 1))}><Icon name="plus" /></button>
            <button type="button" className="btn sm grow" style={{ background: "var(--nobi-tinta)", color: "#FFFFFF" }} onClick={save}>Definir meta</button>
          </div>
          <span className="t-13" style={{ color: '#4A4752' }}>{data.doneThisYear} {data.doneThisYear === 1 ? 'livro lido' : 'livros lidos'} este ano até agora.</span>
        </>
      )}
    </section>
  );
}

export default function Shelf() {
  const broto = useBroto();
  const toast = useToast();
  const { data, error, reload, setData } = useLoad('/books');
  const [adding, setAdding] = useState(false);
  const replace = (b) => setData((d) => {
    const all = [...d.reading, ...d.want, ...d.done].map((x) => (x.id === b.id ? b : x));
    return { ...d, reading: all.filter((x) => x.status === 'reading'), want: all.filter((x) => x.status === 'want'), done: all.filter((x) => x.status === 'done') };
  });
  const changed = (b) => { replace(b); reload(); invalidateLoad('/me/year'); };
  const removed = (id) => setData((d) => ({ ...d, reading: d.reading.filter((x) => x.id !== id), want: d.want.filter((x) => x.id !== id), done: d.done.filter((x) => x.id !== id) }));
  async function answer(b, yes) {
    try {
      if (yes) await api(`/books/${b.id}/accept`, { method: 'POST' });
      else await api(`/books/${b.id}`, { method: 'DELETE' });
      reload();
    } catch (e) { toast(e.message); }
  }
  const empty = data && !data.reading.length && !data.want.length && !data.done.length;
  return (
    <div className="screen">
      <header className="screen-head"><BackButton /><h1 className="title t-20">Estante</h1><button type="button" className="icon-btn" aria-label="Adicionar livro" onClick={() => setAdding(true)}><Icon name="plus" /></button></header>
      <ErrorNote error={error} onRetry={reload} />
      {!data && !error && <><Skeleton height={110} /><Skeleton height={160} /></>}
      {data && <GoalCard data={data} onSaved={reload} />}
      {data?.invites.map((b) => (
        <div key={b.id} className="card row gap-12">
          <Cover book={b} size={40} />
          <span className="grow t-14"><strong>{firstName(b.invitedBy?.name)}</strong> chamou você para ler <strong>{b.title}</strong> junto</span>
          <button type="button" className="btn sm btn-dark" onClick={() => answer(b, true)}>Topar</button>
          <button type="button" className="icon-btn plain" aria-label="Recusar" onClick={() => answer(b, false)}><Icon name="close" /></button>
        </div>
      ))}
      {empty && (
        <div className="card empty">
          <div className="broto-plate"><Broto size={96} expression="padrao" {...broto} /></div>
          <h2 className="title t-20">Sua estante começa aqui</h2>
          <p className="secondary t-14" style={{ maxWidth: 300 }}>Adicione o livro que está lendo. Ao registrar a leitura com ele, as páginas sobem sozinhas.</p>
          <button type="button" className="btn btn-dark" onClick={() => setAdding(true)}>Adicionar livro</button>
        </div>
      )}
      {[['reading', 'Lendo agora'], ['want', 'Quero ler'], ['done', 'Lidos']].map(([k, title]) => (data?.[k]?.length > 0 && (
        <section key={k} className="stack gap-10" aria-label={title}>
          <h2 className="title t-18">{title}</h2>
          {data[k].map((b) => <BookRow key={b.id} book={b} onChange={changed} onRemove={removed} />)}
        </section>
      )))}
      <AddBookSheet open={adding} onClose={() => setAdding(false)} onAdded={() => reload()} />
    </div>
  );
}
