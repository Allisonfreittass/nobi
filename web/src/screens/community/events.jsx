// Eventos de clube: cartão com data, "Vou" e quem vai; criar evento (moderação ou membro do grupo privado).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Avatar, ErrorNote, Sheet } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
import { useLoad, invalidateLoad } from '../../lib/useLoad.js';
import { useToast } from '../../lib/toast.jsx';
import { useConfirm } from '../../lib/confirm.jsx';

const WD = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const parts = (date) => { const d = new Date(`${date}T12:00:00`); return { wd: WD[d.getDay()], day: d.getDate(), month: MONTHS[d.getMonth()] }; };
const hour = (t) => (t.endsWith(':00') ? `${Number(t.slice(0, 2))}h` : t.replace(':', 'h'));

export function EventCard({ ev, slug, onChange, showClub = false, canJoin = true }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const p = parts(ev.date);
  async function toggle() {
    setBusy(true);
    try { onChange(await api(`/clubs/${slug}/events/${ev.id}/going`, { method: 'POST', body: { going: !ev.going } })); }
    catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  async function cancel() {
    if (!(await confirm({ title: 'Cancelar o evento?', message: 'Ele some da agenda do clube.', confirmLabel: 'Cancelar evento', danger: true }))) return;
    try { await api(`/clubs/${slug}/events/${ev.id}`, { method: 'DELETE' }); onChange(null); } catch (e) { toast(e.message); }
  }
  return (
    <div className="card row gap-12" style={{ padding: '12px 14px', borderRadius: 20, alignItems: 'flex-start' }}>
      <span className="event-date" aria-hidden="true"><span>{p.wd}</span><strong>{p.day}</strong><span>{p.month}</span></span>
      <div className="stack grow" style={{ gap: 3, minWidth: 0 }}>
        {showClub && ev.club && <Link to={`/clubes/${ev.club.slug}`} className="t-12 strong secondary ellipsis">{ev.club.name}</Link>}
        <span className="t-15 strong">{ev.title}</span>
        <span className="t-13 secondary">{[`${p.wd.toLowerCase()} ${p.day}/${p.month} às ${hour(ev.time)}`, ev.place].filter(Boolean).join(' · ')}</span>
        {ev.description && <span className="t-13">{ev.description}</span>}
        <span className="row gap-8" style={{ marginTop: 4 }}>
          {ev.people.length > 0 && (
            <span className="row" style={{ paddingLeft: 6 }}>
              {ev.people.slice(0, 4).map((u) => <span key={u.id} style={{ marginLeft: -6, borderRadius: 99, boxShadow: '0 0 0 2px var(--nobi-card)' }}><Avatar user={u} size={22} /></span>)}
            </span>
          )}
          <span className="t-12 secondary">{ev.goingCount} {ev.goingCount === 1 ? 'vai' : 'vão'}</span>
          {ev.mine && <button type="button" className="link-btn t-12 strong" style={{ color: 'var(--nobi-danger)' }} onClick={cancel}>Cancelar</button>}
        </span>
      </div>
      {canJoin
        ? <button type="button" className={`btn sm ${ev.going ? 'btn-soft' : 'btn-dark'}`} style={{ flexShrink: 0 }} aria-pressed={ev.going} disabled={busy} onClick={toggle}>{ev.going ? 'Vou ✓' : 'Vou'}</button>
        : ev.club && <Link to={`/clubes/${ev.club.slug}`} className="btn sm btn-soft" style={{ flexShrink: 0 }}>Ver clube</Link>}
    </div>
  );
}

function NewEventSheet({ slug, open, onClose, onCreated }) {
  const toast = useToast();
  const today = new Date().toLocaleDateString('en-CA');
  const [f, setF] = useState({ title: '', date: today, time: '07:00', place: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function create() {
    setBusy(true);
    setError(null);
    try {
      const ev = await api(`/clubs/${slug}/events`, { method: 'POST', body: f });
      toast('Evento criado. Os membros foram avisados.');
      onCreated(ev);
      onClose();
      setF({ title: '', date: today, time: '07:00', place: '', description: '' });
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Novo evento">
      <label className="field">Nome<input className="input" value={f.title} maxLength={80} onChange={set('title')} placeholder="Treino na praça, encontro do clube do livro…" /></label>
      <div className="row gap-10">
        <label className="field grow">Data<input className="input" type="date" min={today} value={f.date} onChange={set('date')} /></label>
        <label className="field" style={{ width: 130 }}>Hora<input className="input" type="time" value={f.time} onChange={set('time')} /></label>
      </div>
      <label className="field">Local (opcional)<input className="input" value={f.place} maxLength={120} onChange={set('place')} placeholder="Praça da Liberdade, ou Online" /></label>
      <label className="field">Detalhes (opcional)<textarea className="textarea" rows={2} maxLength={500} value={f.description} onChange={set('description')} placeholder="Ritmo leve, todo mundo é bem-vindo." /></label>
      <ErrorNote error={error} />
      <button type="button" className="btn btn-dark block" disabled={busy || f.title.trim().length < 3} onClick={create}>{busy ? 'Criando…' : 'Criar evento'}</button>
    </Sheet>
  );
}

/** Agenda do clube (topo do Feed do clube). */
export function ClubEvents({ club }) {
  const { data, setData } = useLoad(`/clubs/${club.slug}/events`);
  const [creating, setCreating] = useState(false);
  if (!data || (!data.events.length && !data.canCreate)) return null;
  const update = (id) => (v) => {
    setData({ ...data, events: v ? data.events.map((e) => (e.id === id ? v : e)) : data.events.filter((e) => e.id !== id) });
    invalidateLoad('/community/events');
  };
  return (
    <section className="stack gap-8" aria-label="Eventos do clube">
      <div className="row between">
        <h2 className="t-15 strong">Próximos eventos</h2>
        {data.canCreate && <button type="button" className="btn sm btn-soft" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Criar evento</button>}
      </div>
      {data.events.length === 0 && <p className="t-13 muted">Nenhum evento marcado. Que tal um encontro?</p>}
      {data.events.slice(0, 3).map((e) => <EventCard key={e.id} ev={e} slug={club.slug} canJoin={club.member} onChange={update(e.id)} />)}
      {data.canCreate && <NewEventSheet slug={club.slug} open={creating} onClose={() => setCreating(false)} onCreated={(ev) => { setData({ ...data, events: [...data.events, ev].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)) }); invalidateLoad('/community/events'); }} />}
    </section>
  );
}

/** Comunidade: eventos dos meus clubes e da minha cidade. */
export function CommunityEvents() {
  const { data, setData } = useLoad('/community/events');
  if (!data?.length) return null;
  return (
    <section className="stack gap-8" aria-label="Próximos eventos">
      <h2 className="title t-20">Próximos eventos</h2>
      {data.slice(0, 4).map((e) => (
        <EventCard key={e.id} ev={e} slug={e.club.slug} showClub canJoin={e.club.member}
          onChange={(v) => setData(v ? data.map((x) => (x.id === e.id ? { ...v, club: e.club } : x)) : data.filter((x) => x.id !== e.id))} />
      ))}
    </section>
  );
}
