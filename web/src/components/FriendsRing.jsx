import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Avatar } from './ui.jsx';
import { firstName } from '../lib/format.js';

const RING_LABEL = { golden: 'em sequência de 7+ dias', posted: 'postou hoje', none: 'ainda não postou hoje' };

/** Anel dos amigos (DESIGN.md §8.7): dourado = sequência ≥ 7; brasa = postou hoje; cinza = não postou. */
export default function FriendsRing({ ring }) {
  return (
    <ul className="chips" style={{ listStyle: 'none', gap: 14, paddingTop: 6, paddingBottom: 4 }} aria-label="Amigos">
      <li>
        <Link to="/registrar" className="stack center gap-6" style={{ width: 60 }}>
          <span style={{ width: 56, height: 56, borderRadius: 28, border: '2px dashed var(--nobi-toggle-off)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" />
          </span>
          <span className="t-12 secondary">Você</span>
        </Link>
      </li>
      {ring.map((f) => (
        <li key={f.id}>
          <Link to={`/u/${f.username}`} className="stack center gap-6" style={{ width: 60 }} aria-label={`${f.name}, ${RING_LABEL[f.ring]}`}>
            <Avatar user={f} size={52} ring={f.ring} />
            <span className="t-12 secondary ellipsis" style={{ maxWidth: 60 }}>{firstName(f.name)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
