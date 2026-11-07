import { useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { useToast } from './toast.jsx';
import { useShare } from './share.jsx';
import { useSession } from './session.jsx';
import { unitWord } from './format.js';

/** O que o servidor deve responder, aplicado já no toque. O servidor corrige se algo for diferente. */
export function optimisticCheckin(goal, body = {}) {
  const g = structuredClone(goal);
  const st = g.status;
  const wasDone = st.periodDone;
  if (g.kind === 'weekly') {
    st.todayValue += 1;
    st.weekValue += 1;
    st.doneToday = true;
    st.periodDone = st.weekValue >= st.need;
    g.pct = Math.min(1, st.weekValue / st.need);
  } else {
    st.todayValue += g.kind === 'count' ? body.value || 1 : body.minutes || body.value || 1;
    st.doneToday = g.kind === 'project' ? true : st.todayValue >= st.need;
    st.periodDone = st.doneToday;
    if (g.kind !== 'project') g.pct = Math.min(1, st.todayValue / st.need);
  }
  if (!wasDone && st.periodDone) g.streak.current += 1;
  if (st.doneToday && st.last7?.length) st.last7[st.last7.length - 1].state = 'done';
  if (g.shared && st.doneToday) {
    g.shared.participants = g.shared.participants.map((p) => (p.id === g.meId ? { ...p, doneToday: true } : p));
  }
  return g;
}

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
    onGoal?.(optimisticCheckin(goal, body));
    let r;
    try {
      r = await api(`/goals/${goal.id}/checkins`, { method: 'POST', body });
    } catch (e) {
      onGoal?.(goal); // desfaz a prévia
      throw e;
    }
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
