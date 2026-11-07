import { Link } from 'react-router-dom';
import { Avatar } from './ui.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';

/** Pessoa numa lista (Comunidade, seguidores, seguindo, membros de clube), com o botão de seguir certo para a relação. */
export default function PersonRow({ u, onRelation, extra }) {
  const toast = useToast();
  const rel = u.relation;
  const label = rel.following === 'accepted' ? (rel.friends ? 'Amigos' : 'Seguindo') : rel.following === 'pending' ? 'Pedido enviado' : rel.followsMe ? 'Seguir de volta' : 'Seguir';
  async function click() {
    try {
      const r = await api(`/users/${u.id}/follow`, { method: rel.following === 'none' ? 'POST' : 'DELETE' });
      onRelation?.(r.relation);
    } catch (e) { toast(e.message); }
  }
  return (
    <div className="list-row">
      <Link to={`/u/${u.username}`} className="row gap-12 grow" style={{ minWidth: 0 }}>
        <Avatar user={u} size={44} />
        <span className="stack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="strong t-15 ellipsis">{u.name}</span>
          <span className="t-13 muted ellipsis">@{u.username}{u.bio ? ` · ${u.bio}` : ''}</span>
        </span>
      </Link>
      {!rel.self && (
        <button type="button" className={`btn sm ${rel.following === 'none' ? 'btn-dark' : 'btn-outline'}`} aria-pressed={rel.following !== 'none'} onClick={click}>{label}</button>
      )}
      {extra}
    </div>
  );
}
