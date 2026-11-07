import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Broto from '../components/Broto.jsx';
import Icon from '../components/Icon.jsx';
import { brotoOf, useSession, useMascotMotion } from './session.jsx';
import { useShare } from './share.jsx';
import { goalColor } from './format.js';

const CelebrateCtx = createContext(() => {});
const DURATION = 4800;

const SINGULAR = { treinos: 'Treino', corridas: 'Corrida', copos: 'Copo', lições: 'Lição', vezes: 'Feito' };

/** Título e frase da comemoração do dia. Muda conforme a sequência para não ficar repetitivo. */
export function dailyMessage(goal) {
  const s = goal.streak;
  const st = goal.status;
  if (goal.kind === 'weekly') {
    if (st.periodDone) return { title: s.current > 1 ? `${s.current} semanas seguidas!` : 'Semana fechada!', text: 'Meta da semana batida. Agora é só curtir.' };
    const left = st.need - st.weekValue;
    return { title: `${SINGULAR[goal.target?.unit] || 'Feito'} de hoje!`, text: `${st.weekValue} de ${st.need} nesta semana. ${left === 1 ? 'Falta só 1.' : `Faltam ${left}.`}` };
  }
  const n = s.current;
  if (n <= 1) return { title: 'Dia 1!', text: goal.kind === 'project' ? 'Primeiro avanço no projeto. Todo começo conta.' : 'Todo começo conta.' };
  if (n === 2) return { title: '2 dias seguidos!', text: 'Tá pegando ritmo.' };
  if (n < 7) return { title: `${n} dias seguidos!`, text: `Faltam ${7 - n} para o Broto ficar dourado.` };
  return { title: `${n} dias seguidos!`, text: 'O Broto segue dourado. Mais um dia na conta.' };
}

/** O dia acabou de ser concluído com este registro? (antes não estava, agora está) */
export function closedTheDay(before, after) {
  if (!before || !after) return false;
  const was = before.status.doneToday || before.status.periodDone;
  const is = after.status.doneToday || after.status.periodDone;
  return !was && is;
}

function Confetti() {
  const bits = [
    ['8%', '-6px', 'var(--nobi-creme)', 4, 20], ['30%', '-10px', 'var(--nobi-orbita)', 9, 0],
    ['62%', '-8px', 'var(--nobi-dourado)', 6, 0], ['84%', '-4px', 'var(--nobi-tinta)', 3, -30],
  ];
  return bits.map(([left, top, c, r, rot], i) => (
    <span key={i} aria-hidden="true" className="nobi-pop" style={{ position: 'absolute', left, top, width: 9, height: i % 2 ? 9 : 14, borderRadius: r, background: c, transform: `rotate(${rot}deg)`, animationDelay: `${120 + i * 70}ms` }} />
  ));
}

/**
 * Comemoração pequena de cada dia concluído: cartão que sobe por baixo, some sozinho
 * e não trava nada. A tela cheia (Conquista) fica para 7, 30 e 100 dias.
 */
export function CelebrateProvider({ children }) {
  const [item, setItem] = useState(null);
  const share = useShare();
  const motion = useMascotMotion();
  const { me } = useSession();
  const timer = useRef();
  const hovering = useRef(false);

  const close = useCallback(() => { clearTimeout(timer.current); setItem(null); }, []);
  const arm = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (!hovering.current) setItem(null); }, DURATION);
  }, []);

  // goal = null: momento rápido sem objetivo (ex.: entrou num clube), com title e text próprios.
  const celebrate = useCallback((goal, { checkinId, posted, level, title, text } = {}) => {
    const msg = goal ? dailyMessage(goal) : { title, text };
    if (level) msg.text = `E você subiu para o nível ${level}!`;
    setItem({ goal, checkinId, posted, key: Date.now(), ...msg });
    arm();
    try { if (motion && navigator.vibrate) navigator.vibrate(18); } catch { /* sem vibração */ }
  }, [arm, motion]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const g = item?.goal;
  const color = g ? goalColor(g.color) : null;
  return (
    <CelebrateCtx.Provider value={celebrate}>
      {children}
      {item && (
        <div className="celebrate-wrap">
          <section
            key={item.key}
            className="celebrate"
            role="status"
            aria-live="polite"
            onMouseEnter={() => { hovering.current = true; }}
            onMouseLeave={() => { hovering.current = false; arm(); }}
            onFocus={() => { hovering.current = true; }}
            onBlur={() => { hovering.current = false; arm(); }}
          >
            <div className="celebrate-art" aria-hidden="true">
              <Confetti />
              <div className={motion ? 'nobi-hop' : ''} style={{ animationIterationCount: 2 }}>
                <Broto size={64} {...brotoOf(me)} expression="comemorando" shadow={false} />
              </div>
            </div>
            <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
              <span className="title nobi-pop" style={{ fontSize: 'var(--nobi-text-2xl)', fontWeight: 800 }}>{item.title}</span>
              <span className="t-13" style={{ opacity: 0.8 }}>{item.posted ? 'Publicado para seus amigos.' : item.text}</span>
              {g && (
                <span className="row gap-6 t-12 ellipsis" style={{ opacity: 0.7, marginTop: 2 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: color, flexShrink: 0 }} />
                  {g.title}
                </span>
              )}
            </div>
            <div className="stack gap-4" style={{ alignItems: 'flex-end', flexShrink: 0 }}>
              <button type="button" className="icon-btn plain" aria-label="Fechar" onClick={close} style={{ color: 'inherit', width: 36, height: 36 }}><Icon name="close" size={16} /></button>
              {item.checkinId && !item.posted && (
                <button
                  type="button"
                  className="btn sm celebrate-share"
                  onClick={() => { close(); share({ checkinId: item.checkinId, title: `${item.title} · ${g.title}` }); }}
                >
                  Postar
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </CelebrateCtx.Provider>
  );
}

export const useCelebrate = () => useContext(CelebrateCtx);
