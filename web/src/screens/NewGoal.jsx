import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Broto from '../components/Broto.jsx';
import Icon from '../components/Icon.jsx';
import { Avatar, BackButton, Chip, ErrorNote, Segmented } from '../components/ui.jsx';
import { useLoad, invalidateLoad } from '../lib/useLoad.js';
import { useSession } from '../lib/session.jsx';
import { api } from '../lib/api.js';
import { CATEGORIES, CATEGORY_ORDER, GOAL_COLORS, WEEK, firstName } from '../lib/format.js';

const TYPES = [
  { id: 'daily', label: 'Hábito', desc: 'Sequência em dias. Ex.: meditar, ler.' },
  { id: 'weekly', label: 'Meta semanal', desc: 'Sequência em semanas. Ex.: treinar 4x.' },
  { id: 'count', label: 'Contagem', desc: 'Some ao longo do dia. Ex.: copos de água.' },
  { id: 'project', label: 'Projeto', desc: 'Prazo e marcos. Ex.: lançar um app.' },
];
const DURATIONS = [['0', 'Sem prazo'], ['7', '7 dias'], ['30', '30 dias'], ['84', 'Temporada']];
const DEFAULT_COLOR = { treino: '#FF5B2E', leitura: '#6C4DFF', estudo: '#2E9C6A', habito: '#3B82C4', objetivo: '#E0457B', projeto: '#141218' };

function NumberStep({ value, onChange, min = 1, max = 999, label }) {
  return (
    <div className="row gap-6" role="group" aria-label={label}>
      <button type="button" className="icon-btn" aria-label="Menos" onClick={() => onChange(Math.max(min, value - 1))}><Icon name="minus" /></button>
      <span className="num t-22" style={{ minWidth: 40, textAlign: 'center' }} aria-live="polite">{value}</span>
      <button type="button" className="icon-btn" aria-label="Mais" onClick={() => onChange(Math.min(max, value + 1))}><Icon name="plus" /></button>
    </div>
  );
}

function Section({ title, children, hint }) {
  return (
    <section className="stack gap-10">
      <h2 className="t-15 strong">{title}</h2>
      {children}
      {hint && <p className="t-13 muted">{hint}</p>}
    </section>
  );
}

export default function NewGoal() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { me } = useSession();
  const { data: home } = useLoad('/home');
  const friends = home?.ring || [];
  const startCat = CATEGORIES[params.get('categoria')] ? params.get('categoria') : 'habito';

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(startCat);
  const [kind, setKind] = useState(startCat === 'projeto' ? 'project' : 'daily');
  const [color, setColor] = useState(DEFAULT_COLOR[startCat]);
  const [days, setDays] = useState([1, 2, 3, 4, 5, 6, 0]);
  const [amount, setAmount] = useState(4);
  const [unit, setUnit] = useState('');
  const [minutes, setMinutes] = useState(0);
  const [deadline, setDeadline] = useState('');
  const [milestones, setMilestones] = useState(['']);
  const [mode, setMode] = useState(params.get('amigos') ? 'amigos' : 'pessoal');
  const [style, setStyle] = useState('together');
  const [duration, setDuration] = useState(params.get('amigos') ? '30' : '0');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const withFriends = mode === 'amigos';
  const pickCategory = (c) => {
    setCategory(c);
    if (Object.values(DEFAULT_COLOR).includes(color)) setColor(DEFAULT_COLOR[c]);
    if (c === 'projeto') setKind('project');
    else if (kind === 'project') setKind('daily');
  };
  const pickKind = (k) => {
    setKind(k);
    if (k === 'weekly') { setAmount(4); setUnit(category === 'treino' ? 'treinos' : 'vezes'); }
    if (k === 'count') { setAmount(8); setUnit(category === 'habito' ? 'copos' : ''); }
    if (k === 'project') setCategory('projeto');
  };
  const flip = (d) => setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]));

  const hint = useMemo(() => {
    if (withFriends) return style === 'together'
      ? 'Você vê quem já fez hoje. A sequência do grupo vale quando metade ou mais marca: ninguém é punido por uma pessoa.'
      : 'Você vê quem já fez hoje. Pontos zeram toda semana, no domingo.';
    if (kind === 'project') return 'Conta os dias em que você avança no projeto.';
    if (kind === 'weekly') return `${amount} por semana · conta em semanas`;
    return `${days.length} ${days.length === 1 ? 'dia' : 'dias'} por semana · conta em dias · descanso não quebra`;
  }, [withFriends, style, kind, amount, days]);

  const cta = withFriends ? (picked.length ? `Criar e convidar ${picked.length}` : 'Escolha pelo menos 1 amigo') : 'Criar objetivo';
  const canSubmit = title.trim() && days.length && (!withFriends || picked.length);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const target = kind === 'daily'
        ? (minutes > 0 ? { amount: minutes, unit: 'min' } : { amount: 1, unit: '' })
        : kind === 'project' ? { amount: 1, unit: '' } : { amount, unit: unit.trim() };
      const body = {
        title, category, kind, color, target, activeDays: days,
        deadline: kind === 'project' ? deadline || undefined : undefined,
        milestones: kind === 'project' ? milestones.filter((m) => m.trim()) : undefined,
        shared: withFriends ? { mode: style, invite: picked, durationDays: Number(duration) } : undefined,
      };
      const g = await api('/goals', { method: 'POST', body });
      invalidateLoad('/goals', '/home');
      if (g.shared) navigate(g.shared.endsAt ? `/desafios/${g.id}` : '/metas', { replace: true });
      else navigate(`/comecou/${g.id}`, { replace: true, state: { goal: g } }); // tela "Começou!"
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  const cardBtn = (on) => ({
    minHeight: 84, borderRadius: 18, border: 'none', padding: '12px 14px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, textAlign: 'left',
    background: 'var(--nobi-card)', boxShadow: on ? 'inset 0 0 0 2.5px var(--nobi-text)' : 'inset 0 0 0 1px var(--nobi-border)', transition: 'box-shadow var(--nobi-dur-fast)',
  });

  return (
    <div className="screen no-nav">
      <header className="screen-head">
        <BackButton />
        <h1 className="title t-20">Novo objetivo</h1>
        <span style={{ width: 44 }} />
      </header>
      {params.get('primeiro') && (
        <p className="t-15 secondary">Bem-vindo! Comece com um objetivo. Cada um tem a sua própria sequência.</p>
      )}

      <label className="field">
        <span className="title t-22">O que você quer construir?</span>
        <input className="input" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ler 20 min por dia" autoFocus />
      </label>

      <Section title="Com quem">
        <Segmented label="Com quem" options={[['pessoal', 'Pessoal'], ['amigos', 'Com amigos']]} value={mode} onChange={setMode} className="bg-segment" />
        {withFriends && (
          <div className="card stack gap-14">
            {friends.length === 0 ? (
              <p className="t-14 secondary">Você ainda não tem amigos no app. Amigos são pessoas que seguem você e que você segue.</p>
            ) : (
              <ul className="chips" style={{ listStyle: 'none', margin: '0 -16px', padding: '0 16px', gap: 12 }} aria-label="Convidar amigos">
                {friends.map((f) => {
                  const on = picked.includes(f.id);
                  return (
                    <li key={f.id}>
                      <button type="button" aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== f.id) : [...p, f.id]))}
                        className="stack center gap-6" style={{ border: 'none', background: 'none', width: 60, padding: 0 }}>
                        <span style={{ position: 'relative', opacity: on ? 1 : 0.45, transition: 'opacity var(--nobi-dur-fast)' }}>
                          <Avatar user={f} size={48} />
                          {on && <span style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, background: 'var(--nobi-tinta)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px var(--nobi-card)' }}><Icon name="check" size={13} stroke={3} /></span>}
                        </span>
                        <span className="t-12 secondary">{firstName(f.name)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} role="group" aria-label="Estilo">
              {[['together', 'Juntos', 'Ninguém compete. O grupo mantém uma sequência só.'], ['versus', 'Disputa', 'Ranking semanal de quem foi mais consistente.']].map(([id, label, desc]) => (
                <button key={id} type="button" aria-pressed={style === id} onClick={() => setStyle(id)} style={{ ...cardBtn(style === id), minHeight: 76, background: 'var(--nobi-bg)' }}>
                  <span className="strong t-15">{label}</span><span className="t-12 secondary">{desc}</span>
                </button>
              ))}
            </div>
            <div className="stack gap-6">
              <span className="t-14 strong">Duração</span>
              <Segmented compact label="Duração" options={DURATIONS} value={duration} onChange={setDuration} />
              <span className="field-hint">{duration === '0' ? 'Objetivo contínuo com amigos.' : 'Com prazo vira um desafio, com página própria.'}</span>
            </div>
          </div>
        )}
      </Section>

      <Section title="Tipo">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} role="group" aria-label="Tipo">
          {TYPES.map((t) => (
            <button key={t.id} type="button" aria-pressed={kind === t.id} onClick={() => pickKind(t.id)} style={cardBtn(kind === t.id)}>
              <span className="strong t-15">{t.label}</span><span className="t-12 secondary">{t.desc}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Categoria">
        <div className="chips" role="group" aria-label="Categoria">
          {CATEGORY_ORDER.map((c) => (
            <Chip key={c} on={category === c} onClick={() => pickCategory(c)}>
              <span style={{ width: 10, height: 10, borderRadius: 4, background: CATEGORIES[c].color }} aria-hidden="true" />{CATEGORIES[c].label}
            </Chip>
          ))}
        </div>
      </Section>

      {kind === 'daily' && (
        <Section title="Meta por dia" hint={minutes ? `Conta quando somar ${minutes} min no dia.` : 'Só marcar como feito. Ou defina minutos.'}>
          <div className="card row between"><span className="t-15 strong">{minutes ? `${minutes} min` : 'Só marcar'}</span>
            <div className="row gap-6">
              <button type="button" className="icon-btn" aria-label="Menos 5 minutos" onClick={() => setMinutes((m) => Math.max(0, m - 5))}><Icon name="minus" /></button>
              <button type="button" className="icon-btn" aria-label="Mais 5 minutos" onClick={() => setMinutes((m) => m + 5)}><Icon name="plus" /></button>
            </div>
          </div>
        </Section>
      )}
      {(kind === 'weekly' || kind === 'count') && (
        <Section title={kind === 'weekly' ? 'Quantas vezes por semana' : 'Quanto por dia'}>
          <div className="card row between gap-12">
            <NumberStep value={amount} onChange={setAmount} max={kind === 'weekly' ? 14 : 999} label="Quantidade" />
            <label className="grow">
              <span className="sr-only">Unidade</span>
              <input className="input" value={unit} maxLength={20} onChange={(e) => setUnit(e.target.value)} placeholder={kind === 'weekly' ? 'treinos' : 'copos'} />
            </label>
          </div>
        </Section>
      )}
      {kind === 'project' && (
        <Section title="Prazo e marcos">
          <div className="card stack gap-12">
            <label className="field">Prazo (opcional)<input type="date" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
            <span className="t-14 strong">Marcos</span>
            {milestones.map((m, i) => (
              <div key={i} className="row gap-8">
                <label className="grow"><span className="sr-only">Marco {i + 1}</span>
                  <input className="input" value={m} maxLength={80} placeholder={`Marco ${i + 1}`} onChange={(e) => setMilestones((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
                </label>
                {milestones.length > 1 && <button type="button" className="icon-btn plain" aria-label={`Remover marco ${i + 1}`} onClick={() => setMilestones((l) => l.filter((_, j) => j !== i))}><Icon name="close" /></button>}
              </div>
            ))}
            <button type="button" className="btn btn-soft sm" onClick={() => setMilestones((l) => [...l, ''])}><Icon name="plus" size={16} /> Adicionar marco</button>
          </div>
        </Section>
      )}

      <Section title={kind === 'weekly' ? 'Em quais dias você pretende fazer' : 'Dias que contam para a sequência'}>
        <div className="row gap-6" role="group" aria-label="Dias da semana">
          {WEEK.map((w) => {
            const on = days.includes(w.d);
            return (
              <button key={w.d} type="button" aria-pressed={on} aria-label={w.full} onClick={() => flip(w.d)}
                style={{ flex: 1, height: 44, borderRadius: 14, border: 'none', fontWeight: 700, fontSize: 14, transition: 'background var(--nobi-dur-fast)', background: on ? color : 'var(--nobi-card)', color: on ? '#FFFFFF' : 'var(--nobi-text-secondary)', boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--nobi-border)' }}>
                {w.short}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Cor">
        <div className="row gap-10 wrap" role="radiogroup" aria-label="Cor">
          {GOAL_COLORS.map(([hex, name]) => (
            <button key={hex} type="button" role="radio" aria-checked={color === hex} aria-label={name} onClick={() => setColor(hex)}
              style={{ width: 44, height: 44, borderRadius: 16, border: 'none', background: hex, boxShadow: color === hex ? `0 0 0 3px var(--nobi-bg), 0 0 0 5px ${hex}` : 'none', transition: 'box-shadow var(--nobi-dur-fast)' }} />
          ))}
        </div>
      </Section>

      <div className="card row gap-12" style={{ alignItems: 'flex-start' }}>
        <Icon name="lock" size={20} />
        <div className="stack gap-4">
          <span className="strong t-15">Você decide o que posta</span>
          <span className="t-13 secondary">Nada vai pro feed sozinho. A cada registro ou marco batido, você escolhe se posta ou não.</span>
        </div>
      </div>

      <div className="card row gap-14">
        <span style={{ width: 48, height: 48, borderRadius: 16, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: color }} aria-hidden="true">
          <Broto size={40} stage={me.stage} golden={me.golden} shadow={false} />
        </span>
        <div className="stack gap-4">
          <span className="strong t-15">{withFriends ? 'Cada um registra no próprio app' : 'Sua sequência começa hoje'}</span>
          <span className="t-13 secondary">{hint}</span>
        </div>
      </div>

      <ErrorNote error={error} />
      <button type="button" className="btn btn-primary lg block" disabled={!canSubmit || busy} onClick={submit}>{busy ? 'Criando…' : cta}</button>
    </div>
  );
}
