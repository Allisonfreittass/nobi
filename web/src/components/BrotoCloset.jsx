// Coleção de acessórios do Broto: os que a pessoa ganhou (toque para vestir ou tirar) e os que faltam, com como ganhar.
import { useEffect, useState } from 'react';
import Broto from './Broto.jsx';
import Icon from './Icon.jsx';
import { Sheet, Skeleton } from './ui.jsx';
import { api } from '../lib/api.js';
import { useBroto, useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';

/** Vestir (ou tirar, com null) e já atualizar o Broto em todo o app. */
export function useWearAccessory() {
  const { patchMe } = useSession();
  const toast = useToast();
  return async (id) => {
    try {
      const r = await api('/me/broto', { method: 'PUT', body: { accessory: id } });
      patchMe({ brotoAccessory: r.brotoAccessory });
      return true;
    } catch (e) { toast(e.message); return false; }
  };
}

export default function BrotoCloset({ open, onClose }) {
  const broto = useBroto();
  const wear = useWearAccessory();
  const [data, setData] = useState(null);
  useEffect(() => { if (open) api('/me/collection').then(setData).catch(() => setData({ equipped: null, items: [] })); }, [open]);
  const equipped = broto.accessory;
  const owned = data?.items.filter((i) => i.earnedAt).length || 0;

  async function toggle(item) {
    if (!item.earnedAt) return;
    await wear(equipped === item.id ? null : item.id);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Acessórios do Broto">
      <div className="row gap-14 card block-creme" style={{ color: 'var(--nobi-tinta)' }}>
        <Broto size={96} expression="padrao" stage={broto.stage} golden={broto.golden} accessory={equipped} shadow={false} />
        <div className="stack gap-4">
          <span className="title t-18">{equipped ? data?.items.find((i) => i.id === equipped)?.name || 'Vestindo' : 'Sem acessório'}</span>
          <span className="t-13" style={{ color: '#4A4752' }}>
            {data ? `${owned} de ${data.items.length} na coleção. Ganhou, é seu para sempre. Toque em um para vestir.` : 'Carregando…'}
          </span>
        </div>
      </div>
      {!data && <Skeleton height={220} />}
      {data && (
        <ul className="closet-grid" aria-label="Coleção de acessórios">
          {data.items.map((i) => {
            const on = equipped === i.id;
            return (
              <li key={i.id}>
                <button type="button" className="closet-item card" aria-pressed={on} disabled={!i.earnedAt} onClick={() => toggle(i)}
                  aria-label={i.earnedAt ? `${i.name}${on ? ', vestindo. Toque para tirar' : '. Toque para vestir'}` : `${i.name}, bloqueado. ${i.how}`}>
                  <span className="closet-art" style={{ opacity: i.earnedAt ? 1 : 0.6, filter: i.earnedAt ? 'none' : 'grayscale(0.85)' }}>
                    <Broto size={72} expression="padrao" stage={broto.stage} accessory={i.id} shadow={false} />
                  </span>
                  <span className="t-13 strong">{i.name}</span>
                  <span className="t-12 secondary">{on ? 'Vestindo' : i.earnedAt ? (i.season ? `Temporada ${i.season}` : 'Na coleção') : i.how}</span>
                  {!i.earnedAt && <span className="closet-lock" aria-hidden="true"><Icon name="lock" size={14} /></span>}
                  {on && <span className="closet-lock on" aria-hidden="true"><Icon name="check" size={14} stroke={3} /></span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="t-12 muted">Acessórios de temporada aparecem a cada estação: 21 dias seguidos durante a temporada e ele é seu.</p>
    </Sheet>
  );
}
