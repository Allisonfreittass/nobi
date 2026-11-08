// Abertura do app: a tela coral com o Broto "escorre" para cima e revela o app por baixo.
// Aparece só uma vez por carregamento. Sem animação (reduzir movimento ou "Animações do Broto"
// desligado), apenas some com um fade curto. Com erro de conexão, sai e deixa o Splash mostrar o aviso.
import { useEffect, useState } from 'react';
import Broto from './Broto.jsx';
import { useMascotMotion, useSession } from '../lib/session.jsx';
import { useStatusBar } from '../lib/statusBar.js';

const MIN_VISIBLE = 450; // tempo mínimo para o Broto aparecer antes de escorrer
const LEAVE_MS = 950;
const FADE_MS = 220;

// Gotas penduradas na borda de baixo: posição, largura e comprimento variados
const DRIPS = [
  { x: 4, w: 9, h: 46 }, { x: 15, w: 6, h: 78 }, { x: 24, w: 11, h: 34 }, { x: 37, w: 7, h: 96 },
  { x: 47, w: 10, h: 52 }, { x: 60, w: 6, h: 70 }, { x: 69, w: 12, h: 40 }, { x: 83, w: 7, h: 88 }, { x: 92, w: 8, h: 30 },
];

export default function OpeningCurtain() {
  const { me, bootError } = useSession();
  const motion = useMascotMotion();
  const [phase, setPhase] = useState('cover'); // cover → leaving | fade → gone
  const [mountedAt] = useState(() => Date.now());
  useStatusBar(phase === 'gone' ? null : '#FF5B2E');

  useEffect(() => {
    if (phase !== 'cover') return undefined;
    if (bootError) { setPhase('gone'); return undefined; }
    if (me === undefined) return undefined;
    const wait = Math.max(0, MIN_VISIBLE - (Date.now() - mountedAt));
    const t = setTimeout(() => setPhase(motion ? 'leaving' : 'fade'), wait);
    return () => clearTimeout(t);
  }, [me, bootError, phase, motion, mountedAt]);

  useEffect(() => {
    if (phase !== 'leaving' && phase !== 'fade') return undefined;
    const t = setTimeout(() => setPhase('gone'), phase === 'leaving' ? LEAVE_MS : FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'gone') return null;
  return (
    <div className={`curtain ${phase}`} aria-hidden="true">
      <div className="curtain-panel">
        <div className="curtain-mascot">
          <div className={motion ? 'nobi-hop' : ''}>
            <span className="broto-plate round"><Broto size={110} expression="padrao" priority /></span>
          </div>
        </div>
        <div className="curtain-drips">
          {DRIPS.map((d) => (
            <span key={d.x} style={{ left: `${d.x}%`, width: `${d.w}%`, height: d.h }} />
          ))}
        </div>
      </div>
    </div>
  );
}
