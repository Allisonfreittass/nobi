// Peças da Comunidade e do Clube (DESIGN.md: Comunidade.dc.html e Clube.dc.html)
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { invalidateLoad } from '../../lib/useLoad.js';
import { CATEGORIES, goalColor } from '../../lib/format.js';

const SMALL = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'que', 'em']);
export const initials = (name) => name.split(/\s+/).filter((w) => !SMALL.has(w.toLowerCase())).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
export const clubColor = (c) => goalColor(CATEGORIES[c.category]?.color || '#141218');
export const people = (n) => Number(n).toLocaleString('pt-BR');

/** Quadrado colorido do clube: iniciais (grade) ou ícone da categoria (lista). */
export function ClubTile({ club, size = 48, icon = false }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: size / 3, background: clubColor(club), color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon
        ? <Icon name={CATEGORIES[club.category]?.icon || 'users'} size={size / 2.2} />
        : <span className="title" style={{ fontSize: size / 2.4, fontWeight: 800 }}>{initials(club.name)}</span>}
    </span>
  );
}

/** Entrar (tinta) ou Membro ✓ (neutro). Já sendo membro, o botão leva ao clube; sair fica no menu do clube. */
export function useJoin(onJoined) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function join(club) {
    setBusy(true);
    try {
      const c = await api(`/clubs/${club.slug}/join`, { method: 'POST' });
      invalidateLoad('/community');
      onJoined?.(c);
      toast(`Você entrou em ${club.name}.`);
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  return { join, busy };
}

export function ClubGridCard({ club, onJoined }) {
  const navigate = useNavigate();
  const { join, busy } = useJoin(onJoined);
  return (
    <div className="card stack gap-8" style={{ padding: 14, borderRadius: 22 }}>
      <Link to={`/clubes/${club.slug}`} className="stack gap-8" aria-label={`Abrir ${club.name}`}>
        <ClubTile club={club} />
        <span className="strong t-15" style={{ lineHeight: 1.25, minHeight: 38 }}>{club.name}</span>
        <span className="stack t-12 secondary" style={{ gap: 2 }}>
          <span>{club.tags}</span>
          <span>{club.city || 'Online'}</span>
          <span className="strong" style={{ color: 'var(--nobi-text)' }}>{people(club.membersCount)} {club.membersCount === 1 ? 'membro' : 'membros'}</span>
        </span>
      </Link>
      {club.member
        ? <button type="button" className="btn sm btn-soft block" style={{ height: 44, background: 'var(--nobi-track)' }} aria-pressed="true" onClick={() => navigate(`/clubes/${club.slug}`)}>Membro ✓</button>
        : <button type="button" className="btn sm btn-dark block" style={{ height: 44 }} aria-pressed="false" disabled={busy || club.banned} onClick={() => join(club)}>{club.banned ? 'Indisponível' : 'Entrar'}</button>}
    </div>
  );
}

/** Linha de desafio aberto: Participar / Dentro ✓. */
export function ChallengeRow({ ch, onJoined, canJoin = true }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function participate() {
    if (!canJoin) { navigate(`/clubes/${ch.club.slug}`); toast('Entre no clube para participar.'); return; }
    setBusy(true);
    try {
      await api(`/goals/${ch.id}/participate`, { method: 'POST' });
      invalidateLoad('/home', '/goals', '/home/challenges', '/community/challenges');
      onJoined?.(ch.id);
      toast('Você está dentro. Bora!');
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  const meta = [ch.club?.name, `${people(ch.participants)} participando`, ch.myPosition ? `você está em ${ch.myPosition}º` : null, ch.daysLeft != null ? `termina em ${ch.daysLeft} ${ch.daysLeft === 1 ? 'dia' : 'dias'}` : null].filter(Boolean).join(' · ');
  return (
    <div className="card row gap-12" style={{ padding: '14px 16px', borderRadius: 22 }}>
      <Link to={`/desafios/${ch.id}`} className="row gap-12 grow" style={{ minWidth: 0 }}>
        <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: goalColor(ch.color) }} />
        <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="strong t-15">{ch.title}</span>
          <span className="t-12 secondary">{meta}</span>
        </span>
      </Link>
      {ch.joined
        ? <Link to={`/desafios/${ch.id}`} className="btn sm btn-soft" style={{ height: 44, background: 'var(--nobi-track)', flexShrink: 0 }}>Dentro ✓</Link>
        : <button type="button" className="btn sm btn-dark" style={{ height: 44, flexShrink: 0 }} disabled={busy} onClick={participate}>Participar</button>}
    </div>
  );
}
