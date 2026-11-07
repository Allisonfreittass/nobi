import { useState } from 'react';
import Icon from './Icon.jsx';
import { BrotoHead } from './Broto.jsx';
import { Sheet } from './ui.jsx';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';

const DAY = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const dayName = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  const y = new Date(); y.setDate(y.getDate() - 1);
  const isYesterday = iso === `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  return isYesterday ? 'ontem' : `${DAY[d.getUTCDay()]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
};

export function ShieldIcons({ available, max = 3, size = 22 }) {
  return (
    <span className="row gap-4" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <Icon key={i} name="shield" size={size} stroke={2.2} style={i < available ? { color: 'var(--nobi-orbita)', fill: 'color-mix(in srgb, var(--nobi-orbita) 22%, transparent)' } : { color: 'var(--nobi-toggle-off)' }} />
      ))}
    </span>
  );
}

export function ShieldsHelp({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="Escudo de sequência">
      <ul className="stack gap-12" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {[
          ['Como ganha', 'Cada semana com 5 ou mais dias ativos vale 1 escudo. Você guarda até 3.'],
          ['Como funciona', 'Se um dia que contava passar sem registro, um escudo protege suas sequências sozinho. Um escudo cobre o dia inteiro, todos os objetivos.'],
          ['O que ele faz', 'O dia protegido conta como descanso: a sequência não quebra, mas também não soma.'],
          ['Sem culpa', 'Falhar um dia faz parte. O escudo existe para você seguir em frente sem recomeçar do zero.'],
        ].map(([t, d]) => (
          <li key={t} className="stack gap-4">
            <span className="strong t-15">{t}</span>
            <span className="t-14 secondary">{d}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-dark block" onClick={onClose}>Entendi</button>
    </Sheet>
  );
}

/** Item do Perfil: quantos escudos a pessoa tem. */
export function ShieldsItem() {
  const { me } = useSession();
  const [help, setHelp] = useState(false);
  const s = me.shields;
  if (!s) return null;
  return (
    <>
      <button type="button" className="card row gap-12 tap" onClick={() => setHelp(true)} style={{ border: 'none', textAlign: 'left', width: '100%' }} aria-label={`Escudos de sequência: ${s.available} de ${s.max}`}>
        <ShieldIcons available={s.available} max={s.max} />
        <span className="grow stack" style={{ gap: 1 }}>
          <span className="strong t-15">Escudos de sequência · {s.available} de {s.max}</span>
          <span className="t-13 muted">{s.available ? 'protegem sua sequência se você falhar um dia' : 'ganhe 1 a cada semana com 5 dias ativos'}</span>
        </span>
        <Icon name="help" size={18} />
      </button>
      <ShieldsHelp open={help} onClose={() => setHelp(false)} />
    </>
  );
}

/** Aviso positivo: o escudo segurou um dia, ou um escudo novo foi ganho. */
export function ShieldNotice() {
  const { me, patchMe } = useSession();
  const [help, setHelp] = useState(false);
  const s = me?.shields;
  if (!s || (!s.protectedDays?.length && !s.newlyEarned)) return null;
  const saved = s.protectedDays?.length;
  const last = saved ? s.protectedDays[s.protectedDays.length - 1] : null;
  async function ok() {
    patchMe({ shields: { ...s, protectedDays: [], newlyEarned: 0 } });
    api('/me/shields/seen', { method: 'POST' }).catch(() => {});
  }
  const title = saved
    ? `O escudo segurou sua sequência ${dayName(last) === 'ontem' ? 'de ontem' : `de ${dayName(last)}`}`
    : s.newlyEarned > 1 ? 'Você ganhou escudos de sequência' : 'Semana de constância! +1 escudo';
  const body = saved
    ? `${saved > 1 ? `${saved} dias protegidos. ` : ''}${s.available ? `Ainda tem ${s.available} ${s.available === 1 ? 'escudo' : 'escudos'}.` : 'Seus escudos acabaram por enquanto: 5 dias ativos nesta semana rendem outro.'}`
    : `Você tem ${s.available} de ${s.max}. Se falhar um dia, ele protege sua sequência.`;
  return (
    <section className="card row gap-12" role="status" style={{ padding: '12px 8px 12px 12px', boxShadow: 'inset 0 0 0 2px color-mix(in srgb, var(--nobi-orbita) 45%, transparent)' }}>
      <span style={{ width: 48, height: 48, flexShrink: 0, position: 'relative' }} aria-hidden="true">
        <BrotoHead size={48} />
        <span style={{ position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, background: 'var(--nobi-orbita)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px var(--nobi-card)' }}><Icon name="shield" size={13} stroke={2.6} /></span>
      </span>
      <div className="grow stack" style={{ gap: 2 }}>
        <span className="strong t-15">{title}</span>
        <span className="t-13 muted">{body}</span>
        <button type="button" className="btn-link t-13 strong" style={{ border: 'none', background: 'none', padding: 0, alignSelf: 'flex-start', minHeight: 32, color: 'var(--nobi-text)' }} onClick={() => setHelp(true)}>Como funciona</button>
      </div>
      <button type="button" className="btn btn-dark sm" onClick={ok}>Boa!</button>
      <ShieldsHelp open={help} onClose={() => setHelp(false)} />
    </section>
  );
}
