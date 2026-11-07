import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import PersonRow from '../components/PersonRow.jsx';
import { BackButton, ErrorNote, Segmented, Skeleton } from '../components/ui.jsx';
import { useLoad } from '../lib/useLoad.js';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { api } from '../lib/api.js';

const TABS = { seguidores: 'followers', seguindo: 'following' };

export default function Connections() {
  const { username, tab } = useParams();
  const navigate = useNavigate();
  const { me } = useSession();
  const toast = useToast();
  const kind = TABS[tab];
  const profile = useLoad(kind ? `/users/${username}` : null);
  const list = useLoad(kind ? `/users/${username}/${kind}` : null);
  if (!kind) return <Navigate to={`/u/${username}`} replace />;
  const mine = username === me.username;
  const people = list.data?.people || [];

  async function removeFollower(u) {
    if (!window.confirm(`Remover ${u.name} dos seus seguidores? A pessoa não é avisada.`)) return;
    try {
      await api(`/users/me/followers/${u.id}`, { method: 'DELETE' });
      list.setData((d) => ({ ...d, people: d.people.filter((p) => p.id !== u.id) }));
      toast('Seguidor removido.');
    } catch (e) { toast(e.message); }
  }

  const name = profile.data?.name;
  return (
    <div className="screen">
      <header className="screen-head">
        <BackButton />
        <div className="stack center" style={{ gap: 0 }}>
          <h1 className="title t-18">{mine ? 'Você' : name || `@${username}`}</h1>
          <span className="t-12 muted">@{username}</span>
        </div>
        <span style={{ width: 44 }} />
      </header>
      <Segmented
        label="Lista"
        className="bg-segment"
        value={tab}
        onChange={(t) => navigate(`/u/${username}/${t}`, { replace: true })}
        options={[
          ['seguidores', `Seguidores${profile.data ? ` · ${profile.data.followers}` : ''}`],
          ['seguindo', `Seguindo${profile.data ? ` · ${profile.data.following}` : ''}`],
        ]}
      />
      <ErrorNote error={list.error} onRetry={list.reload} />
      {list.loading && !list.data && <Skeleton height={240} />}
      {list.data?.hidden && (
        <div className="card empty"><Icon name="lock" size={28} /><p className="t-15 secondary">Só amigos veem quem {name?.split(' ')[0] || 'essa pessoa'} segue e quem segue.</p></div>
      )}
      {list.data && !list.data.hidden && people.length === 0 && (
        <p className="muted t-14 center" style={{ padding: 24 }}>
          {tab === 'seguidores' ? (mine ? 'Ninguém segue você ainda. Mande seu link de convite!' : 'Ninguém por aqui ainda.') : (mine ? 'Você ainda não segue ninguém. Procure pessoas no Explorar.' : 'Ainda não segue ninguém.')}
        </p>
      )}
      {people.length > 0 && (
        <div className="card flush card-list">
          {people.map((u) => (
            <PersonRow
              key={u.id}
              u={u}
              onRelation={(relation) => list.setData((d) => ({ ...d, people: d.people.map((p) => (p.id === u.id ? { ...p, relation } : p)) }))}
              extra={mine && tab === 'seguidores' ? (
                <button type="button" className="icon-btn plain" aria-label={`Remover ${u.name} dos seguidores`} onClick={() => removeFollower(u)}><Icon name="close" size={18} /></button>
              ) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
