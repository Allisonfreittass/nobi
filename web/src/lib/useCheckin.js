import { useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { useToast } from './toast.jsx';
import { useShare } from './share.jsx';
import { useSession } from './session.jsx';
import { unitWord } from './format.js';

/**
 * Registrar a partir de um cartão. Depois do registro o app OFERECE postar (toast com "Postar"); nunca posta sozinho.
 * Se fechou um marco de sequência, vai para a tela de Conquista.
 */
export function useCheckin(onGoal) {
  const navigate = useNavigate();
  const toast = useToast();
  const share = useShare();
  const { patchMe } = useSession();

  async function checkin(goal, body = {}) {
    const r = await api(`/goals/${goal.id}/checkins`, { method: 'POST', body });
    onGoal?.(r.goal);
    patchMe({ level: r.me.level, xp: r.me.xp, golden: r.me.golden, stage: r.me.stage });
    if (r.celebration) {
      navigate('/conquista', { state: { celebration: r.celebration } });
      return r;
    }
    const s = r.goal.streak;
    const done = r.goal.status.periodDone;
    const msg = r.me.leveledUp ? `Subiu para o nível ${r.me.level}!` : done
      ? `Feito! Sequência: ${s.current} ${unitWord(s.unit, s.current)}.`
      : 'Registrado.';
    toast(msg, {
      action: 'Postar',
      onAction: () => share({ checkinId: r.checkin.id, title: `${goal.title} · ${s.current} ${unitWord(s.unit, s.current)} seguidos` }),
    });
    return r;
  }

  async function undo(goal, taskKey) {
    const r = await api(`/goals/${goal.id}/checkins/today${taskKey ? `?taskKey=${encodeURIComponent(taskKey)}` : ''}`, { method: 'DELETE' });
    onGoal?.(r.goal);
    toast('Registro de hoje desfeito.');
    return r;
  }

  return { checkin, undo };
}
