import { useState } from 'react';
import Icon from './Icon.jsx';
import { BrotoHead } from './Broto.jsx';
import InstallCard from './InstallPrompt.jsx';
import { usePush } from '../lib/push.js';
import { useInstall } from '../lib/install.js';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';

const KEY = 'nobi.push.dismissedAt';
const QUIET_DAYS = 30;
const dismissedRecently = () => {
  try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < QUIET_DAYS * 86400000; } catch { return false; }
};

/**
 * Convite para ligar o lembrete. Só aparece depois do primeiro check-in (nunca na primeira abertura)
 * e some por 30 dias se a pessoa dispensar.
 */
export function PushCard() {
  const { me } = useSession();
  const toast = useToast();
  const push = usePush();
  const [hidden, setHidden] = useState(dismissedRecently());
  if (hidden || push.state !== 'off' || !me || (me.xp || 0) === 0 || me.prefs?.notify?.checkin === false) return null;
  const time = me.prefs?.reminderTime || '20:00';
  async function enable() {
    try {
      if (await push.enable()) toast(`Combinado. Se faltar algo, o Broto avisa às ${time}.`);
    } catch (e) { toast(e.message); }
  }
  function dismiss() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ok */ }
    setHidden(true);
  }
  return (
    <section className="card row gap-12" aria-label="Ativar lembrete" style={{ padding: '12px 8px 12px 12px' }}>
      <span style={{ flexShrink: 0 }}><BrotoHead size={44} /></span>
      <div className="grow stack" style={{ gap: 1 }}>
        <span className="strong t-15">Lembrete às {time}?</span>
        <span className="t-13 muted">Um aviso por dia, só se faltar algo.</span>
      </div>
      <button type="button" className="btn btn-dark sm" onClick={enable} disabled={push.busy}>Ativar</button>
      <button type="button" className="icon-btn plain" aria-label="Agora não" onClick={dismiss}><Icon name="close" size={18} /></button>
    </section>
  );
}

/** No Feed mostra no máximo um convite por vez: instalar tem prioridade. */
export default function SmartPrompt() {
  const install = useInstall();
  return install.showCard ? <InstallCard /> : <PushCard />;
}
