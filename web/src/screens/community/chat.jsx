// Conversa do clube: mensagens dos membros, atualiza sozinha enquanto está aberta.
// Moderação: denunciar (vai para a fila do clube), apagar (autor ou moderação).
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import ReportSheet from '../../components/ReportSheet.jsx';
import { Avatar, ErrorNote, Sheet, Skeleton } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { useConfirm } from '../../lib/confirm.jsx';
import { firstName, timeAgo } from '../../lib/format.js';

const POLL_MS = 8000;
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const dayLabel = (d) => {
  const t = new Date(); const y = new Date(Date.now() - 86400000);
  if (sameDay(d, t)) return 'Hoje';
  if (sameDay(d, y)) return 'Ontem';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

export default function ClubChat({ club, onSeen }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [list, setList] = useState(null);
  const [more, setMore] = useState(false);
  const [mod, setMod] = useState(false);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState(null);
  const [reporting, setReporting] = useState(null);
  const bottom = useRef(null);
  const latest = useRef(null);

  const scrollDown = () => requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: 'end' }));
  useEffect(() => {
    let alive = true;
    api(`/clubs/${club.slug}/messages`).then((r) => {
      if (!alive) return;
      setList(r.messages); setMore(r.more); setMod(r.canModerate);
      latest.current = r.messages.at(-1)?.createdAt || null;
      onSeen?.();
      scrollDown();
    }).catch(setError);
    // Enquanto a aba está aberta, busca as novas a cada 8 s (sem tempo real no servidor)
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        const r = await api(`/clubs/${club.slug}/messages${latest.current ? `?after=${encodeURIComponent(latest.current)}` : ''}`);
        if (!alive || !r.messages.length) return;
        latest.current = r.messages.at(-1).createdAt;
        setList((l) => { const ids = new Set(l.map((m) => m.id)); return [...l, ...r.messages.filter((m) => !ids.has(m.id))]; });
        scrollDown();
      } catch { /* tenta de novo no próximo ciclo */ }
    }, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [club.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function older() {
    const r = await api(`/clubs/${club.slug}/messages?before=${encodeURIComponent(list[0].createdAt)}`);
    setList((l) => [...r.messages, ...l]);
    setMore(r.more);
  }
  async function send(e) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const m = await api(`/clubs/${club.slug}/messages`, { method: 'POST', body: { text } });
      setList((l) => [...l, m]);
      latest.current = m.createdAt;
      setText('');
      scrollDown();
    } catch (err) { toast(err.message); } finally { setBusy(false); }
  }
  async function remove(m) {
    setActing(null);
    if (!(await confirm({ title: 'Apagar a mensagem?', message: 'Some da conversa para todo mundo.', confirmLabel: 'Apagar', danger: true }))) return;
    try {
      await api(`/clubs/${club.slug}/messages/${m.id}`, { method: 'DELETE' });
      setList((l) => l.map((x) => (x.id === m.id ? { ...x, deleted: true, text: '' } : x)));
    } catch (err) { toast(err.message); }
  }

  if (error) return <ErrorNote error={error} />;
  if (!list) return <Skeleton height={240} />;
  return (
    <section className="stack gap-10" aria-label="Conversa do clube">
      {more && <button type="button" className="btn btn-soft sm" onClick={older}>Ver mensagens anteriores</button>}
      {list.length === 0 && <p className="t-14 secondary">Ninguém falou nada ainda. Que tal dar oi?</p>}
      <ol className="chat-list" aria-live="polite">
        {list.map((m, i) => {
          const prev = list[i - 1];
          const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
          const grouped = prev && !newDay && prev.user.id === m.user.id;
          return (
            <li key={m.id}>
              {newDay && <span className="chat-day">{dayLabel(m.createdAt)}</span>}
              <div className={`chat-row${m.mine ? ' mine' : ''}`}>
                {!m.mine && (grouped ? <span style={{ width: 32 }} /> : <Link to={`/u/${m.user.username}`} aria-label={m.user.name}><Avatar user={m.user} size={32} /></Link>)}
                <button type="button" className={`chat-bubble${m.deleted ? ' deleted' : ''}`} onClick={() => !m.deleted && setActing(m)} aria-label={m.deleted ? 'Mensagem apagada' : `Mensagem de ${m.mine ? 'você' : m.user.name}: ${m.text}. Toque para opções`}>
                  {!m.mine && !grouped && <span className="t-12 strong" style={{ display: 'block' }}>{firstName(m.user.name)}</span>}
                  {m.deleted ? <em className="t-14">Mensagem apagada</em> : <span className="t-15" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.text}</span>}
                  <span className="chat-time">{timeAgo(m.createdAt)}</span>
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={bottom} />
      <form className="chat-input row gap-8" onSubmit={send}>
        <label className="grow"><span className="sr-only">Mensagem</span>
          <input className="input" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} placeholder="Mensagem para o clube" style={{ minHeight: 44, height: 44 }} />
        </label>
        <button type="submit" className="btn btn-dark sm" disabled={!text.trim() || busy} aria-label="Enviar"><Icon name="send" size={18} /></button>
      </form>
      <p className="t-12 muted">Respeito acima de tudo. Viu algo fora das regras? Toque na mensagem e denuncie.</p>
      <Sheet open={Boolean(acting)} onClose={() => setActing(null)} title="Mensagem">
        <div className="card flush card-list">
          {acting && !acting.mine && <button type="button" className="list-row" style={{ color: 'var(--nobi-danger)' }} onClick={() => { setReporting(acting.id); setActing(null); }}><Icon name="flag" size={20} /><span className="t-15 strong grow">Denunciar mensagem</span></button>}
          {acting && (acting.mine || mod) && <button type="button" className="list-row" onClick={() => remove(acting)}><Icon name="trash" size={20} /><span className="grow stack" style={{ gap: 1 }}><span className="t-15 strong">Apagar mensagem</span>{!acting.mine && <span className="t-13 muted">moderação</span>}</span></button>}
          {acting && !acting.mine && <Link to={`/u/${acting.user.username}`} className="list-row"><Icon name="user" size={20} /><span className="t-15 strong grow">Ver perfil de {firstName(acting.user.name)}</span></Link>}
        </div>
      </Sheet>
      <ReportSheet open={Boolean(reporting)} onClose={() => setReporting(null)} targetType="message" targetId={reporting} clubSlug={club.slug} />
    </section>
  );
}
