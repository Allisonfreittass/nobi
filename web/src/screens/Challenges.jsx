import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Broto from '../components/Broto.jsx';
import { Avatar, ErrorNote, Skeleton } from '../components/ui.jsx';
import { useLoad } from '../lib/useLoad.js';
import { firstName } from '../lib/format.js';

export default function Challenges() {
  const { data, error, reload } = useLoad('/home/challenges');
  return (
    <div className="screen">
      <header className="screen-head">
        <h1 className="title t-30">Desafios</h1>
        <Link to="/metas/novo?amigos=1" className="btn btn-orbita sm"><Icon name="plus" size={18} /> Criar com amigos</Link>
      </header>
      <ErrorNote error={error} onRetry={reload} />
      {!data && !error && <><Skeleton height={130} /><Skeleton height={130} /></>}
      {data?.length === 0 && (
        <div className="card empty">
          <div className="block-orbita" style={{ borderRadius: 24, padding: '16px 24px 6px' }}><Broto size={96} expression="foco" /></div>
          <h2 className="title t-20">Evoluir junto é mais leve</h2>
          <p className="secondary t-14" style={{ maxWidth: 300 }}>Crie um objetivo com amigos: Juntos, sem competição, ou Disputa, com ranking semanal.</p>
        </div>
      )}
      {(data || []).map((g) => {
        const me = g.shared.ranking?.find((r) => r.me);
        return (
          <Link key={g.id} to={`/desafios/${g.id}`} className="card stack gap-12 tap" style={{ boxShadow: g.shared.endsAt ? 'inset 4px 0 0 var(--nobi-orbita), var(--nobi-shadow-card)' : undefined }}>
            <div className="row between gap-12">
              <div className="stack gap-4">
                <span className="label-caps t-12 muted">{g.shared.endsAt ? (g.shared.ended ? 'Encerrado' : `Dia ${g.shared.day} de ${g.shared.totalDays}`) : 'Contínuo'} · {g.shared.mode === 'together' ? 'Juntos' : 'Disputa'}</span>
                <span className="title t-20">{g.title}</span>
              </div>
              <span className="num t-22">{me ? `${me.position}º` : g.shared.groupStreak?.current}</span>
            </div>
            <div className="row gap-8">
              <div className="row" style={{ paddingLeft: 6 }}>
                {g.shared.participants.slice(0, 5).map((p) => <span key={p.id} style={{ marginLeft: -6 }}><Avatar user={p} size={28} /></span>)}
              </div>
              <span className="t-13 muted grow">{g.shared.participants.slice(0, 2).map((p) => firstName(p.name)).join(', ')}{g.shared.participants.length > 2 ? ` e +${g.shared.participants.length - 2}` : ''} · {g.shared.doneTodayCount} fizeram hoje</span>
              <Icon name="chevron" size={18} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
