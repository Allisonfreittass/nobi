// Configurações → Strava: conectar, escolher o objetivo de treino, sincronizar e desconectar.
// Só aparece quando o servidor tem as chaves do Strava.
import { useEffect, useRef, useState } from 'react';
import { SelectRow } from './ui.jsx';
import { api } from '../lib/api.js';
import { useLoad, invalidateLoad } from '../lib/useLoad.js';
import { useToast } from '../lib/toast.jsx';
import { useConfirm } from '../lib/confirm.jsx';
import { useSession } from '../lib/session.jsx';

const ORANGE = '#FC4C02'; // cor do Strava (diretrizes de marca)

export default function StravaSettings() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, setData } = useLoad('/strava');
  const goals = useLoad(data?.connected ? '/goals' : null);
  const [busy, setBusy] = useState(false);
  if (!data?.available) return null;
  const options = (goals.data || []).filter((g) => g.kind !== 'project' && !g.shared?.tasks?.length && g.category === 'treino');
  async function connect() {
    setBusy(true);
    try { window.location.href = (await api('/strava/connect')).url; } catch (e) { toast(e.message); setBusy(false); }
  }
  async function sync() {
    setBusy(true);
    try {
      const r = await api('/strava/sync', { method: 'POST' });
      setData(r);
      invalidateLoad('/goals', '/home', '/metas?view=hoje');
      toast(r.imported ? `${r.imported} ${r.imported === 1 ? 'treino importado' : 'treinos importados'} do Strava.` : 'Tudo em dia com o Strava.');
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  async function pick(goalId) {
    try { setData(await api('/strava/goal', { method: 'PUT', body: { goalId } })); } catch (e) { toast(e.message); }
  }
  async function disconnect() {
    if (!(await confirm({ title: 'Desconectar o Strava?', message: 'Os treinos já importados continuam no Nobi.', confirmLabel: 'Desconectar', danger: true }))) return;
    setData(await api('/strava/disconnect', { method: 'POST' }));
  }
  return (
    <section className="stack gap-8" aria-label="Strava">
      <h2 className="label-caps t-12 muted" style={{ padding: '0 4px' }}>Strava</h2>
      {!data.connected ? (
        <div className="card stack gap-10">
          <span className="t-14 secondary">Seus treinos do Strava entram sozinhos no seu objetivo de treino: minutos, km e a sequência do dia.</span>
          <button type="button" className="btn block" style={{ background: ORANGE, color: '#FFFFFF' }} disabled={busy} onClick={connect}>Conectar com o Strava</button>
        </div>
      ) : (
        <div className="card stack gap-10">
          <span className="t-14">Conectado{data.name ? ` como ${data.name}` : ''}.{data.lastSyncAt ? ` Última sincronização: ${new Date(data.lastSyncAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.` : ''}</span>
          {options.length > 0
            ? <div className="row-group"><SelectRow label="Objetivo que recebe os treinos" value={data.goalId || ''} onChange={pick} options={[...(data.goalId ? [] : [['', 'Escolha']]), ...options.map((g) => [g.id, g.title])]} /></div>
            : <span className="t-13 muted">Crie um objetivo de Treino para receber as atividades.</span>}
          <div className="row gap-8 wrap">
            <button type="button" className="btn sm btn-dark" disabled={busy || !data.goalId} onClick={sync}>{busy ? 'Sincronizando…' : 'Sincronizar agora'}</button>
            <button type="button" className="btn sm btn-soft" onClick={disconnect}>Desconectar</button>
          </div>
        </div>
      )}
      <span className="t-12 muted">Powered by Strava</span>
    </section>
  );
}

/** Uma sincronização silenciosa por abertura do app (se conectado há mais de 1 h da última). */
export function StravaAutoSync() {
  const { me } = useSession();
  const done = useRef(false);
  useEffect(() => {
    if (!me || done.current) return;
    done.current = true;
    api('/strava').then((s) => {
      if (!s.connected || !s.goalId || (s.lastSyncAt && Date.now() - new Date(s.lastSyncAt).getTime() < 3600000)) return;
      api('/strava/sync', { method: 'POST' }).then((r) => { if (r.imported) invalidateLoad('/goals', '/home', '/metas?view=hoje'); }).catch(() => {});
    }).catch(() => {});
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
