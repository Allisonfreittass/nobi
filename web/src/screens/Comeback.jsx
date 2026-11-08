// "Que bom te ver": volta ao app depois de dias sem registrar (DESIGN.md §6, expressão saudade).
// Sem culpa e sem vermelho: celebra a volta, lembra que nível e conquistas ficaram.
// Quem decide quando aparecer é o servidor (me.comeback); a tela aparece uma vez por ausência.
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Broto from '../components/Broto.jsx';
import { api } from '../lib/api.js';
import { brotoOf, useMascotMotion, useSession } from '../lib/session.jsx';

const STAGE_NAME = { broto: 'Broto', muda: 'Muda', botao: 'Botão', flor: 'Flor' };

export default function Comeback() {
  const { me, patchMe } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const motion = useMascotMotion();
  // Guarda os dados antes de marcar como vista (me.comeback vira null)
  const [info] = useState(() => me?.comeback || null);
  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (!info) { navigate('/', { replace: true }); return; }
    api('/me/comeback/seen', { method: 'POST' }).catch(() => {});
    patchMe({ comeback: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!info) return null;
  const { stage } = brotoOf(me);

  return (
    <div className="comeback">
      <div className="stack center gap-20 comeback-body">
        <div className={motion ? 'nobi-hop comeback-hop' : ''}>
          <Broto size={180} expression="saudade" stage={stage} title="Broto com saudade, feliz com a sua volta" priority />
        </div>
        <div className="stack center gap-10">
          <h1 className="display t-40 nobi-pop" style={{ textAlign: 'center' }}>Que bom te ver!</h1>
          <p className="t-16 secondary" style={{ textAlign: 'center', maxWidth: 320 }}>
            Faz {info.days} dias desde o seu último registro.{' '}
            {info.streakKept
              ? 'Seus escudos seguraram a sequência: um registro hoje e ela continua.'
              : 'A sequência recomeça hoje, sem drama.'}
          </p>
        </div>
        <div className="card row gap-12 comeback-card">
          <span className="comeback-level num">{me.level}</span>
          <span className="stack" style={{ gap: 2, textAlign: 'left' }}>
            <span className="strong t-15">Seu Broto continua na forma {STAGE_NAME[stage]}</span>
            <span className="t-13 secondary">Nível {me.level}. Nível e conquistas nunca regridem.</span>
          </span>
        </div>
      </div>
      <div className="stack gap-10 comeback-actions">
        <button type="button" className="btn btn-primary lg block" onClick={() => navigate('/registrar', { replace: true, state: { backgroundLocation: { pathname: '/', search: '', hash: '', state: null, key: 'feed' } } })}>
          Registrar algo hoje
        </button>
        <button type="button" className="btn btn-ghost block" onClick={() => navigate('/metas', { replace: true })}>Ver minhas metas</button>
        <button type="button" className="btn btn-ghost sm block muted" onClick={() => navigate(from, { replace: true })}>Agora não</button>
      </div>
    </div>
  );
}
