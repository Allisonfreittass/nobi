import { Link } from 'react-router-dom';
import Broto from './Broto.jsx';
import Icon from './Icon.jsx';

export default function ChallengeBanner({ c }) {
  const sub = c.position
    ? `${c.position}º lugar${c.ahead ? ` · a ${c.ahead.gap} pts de ${c.ahead.name}` : ' · liderando'}`
    : `sequência do grupo: ${c.groupStreak} · ${c.doneTodayCount} de ${c.participantsCount} hoje`;
  return (
    <Link to={`/desafios/${c.id}`} className="card block-orbita tap" style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden', minHeight: 104 }}>
      <div className="grow stack gap-4" style={{ zIndex: 1 }}>
        <span className="label-caps t-12">Desafio · dia {c.day} de {c.totalDays}</span>
        <span className="title t-22" style={{ fontWeight: 800 }}>{c.title}</span>
        <span className="t-13 row gap-6"><Icon name="trophy" size={15} /> {sub}</span>
      </div>
      <div style={{ marginRight: -6, marginBottom: -22, alignSelf: 'flex-end' }}>
        <Broto size={78} expression="foco" />
      </div>
    </Link>
  );
}
