import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Chip, ErrorNote, Sheet } from './ui.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { afterCheckin, afterPost, invalidateLoad } from '../lib/useLoad.js';
import { CATEGORIES, CATEGORY_ORDER, GOAL_COLORS, KIND_LABEL, WEEK } from '../lib/format.js';

function NumberRow({ label, value, onChange, step = 1, min = 1, suffix }) {
  return (
    <div className="card row between" style={{ padding: '8px 8px 8px 16px' }}>
      <span className="t-15 strong">{label}: {value}{suffix ? ` ${suffix}` : ''}</span>
      <div className="row gap-6">
        <button type="button" className="icon-btn" aria-label={`Menos ${step}`} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}><Icon name="minus" /></button>
        <button type="button" className="icon-btn" aria-label={`Mais ${step}`} onClick={() => onChange(value + step)}><Icon name="plus" /></button>
      </div>
    </div>
  );
}

/** Editar objetivo: tudo menos o tipo (mudaria como a sequência é contada). */
export function EditGoalSheet({ goal, open, onClose, onSaved }) {
  const toast = useToast();
  const daily = goal.kind === 'daily';
  const [f, setF] = useState(() => ({
    title: goal.title,
    category: goal.category,
    color: goal.color,
    activeDays: goal.activeDays,
    amount: goal.target?.amount || 1,
    unit: goal.target?.unit || '',
    minutes: daily && goal.target?.unit === 'min' ? goal.target.amount : 0,
    deadline: goal.deadline || '',
  }));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const flip = (d) => set('activeDays', f.activeDays.includes(d) ? f.activeDays.filter((x) => x !== d) : [...f.activeDays, d]);
  const tasks = Boolean(goal.shared?.tasks?.length);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = { title: f.title, category: f.category, color: f.color, activeDays: f.activeDays };
      if (daily) body.target = f.minutes > 0 ? { amount: f.minutes, unit: 'min' } : { amount: 1, unit: '' };
      else if (goal.kind === 'weekly' || goal.kind === 'count') body.target = { amount: f.amount, unit: f.unit };
      if (goal.kind === 'project') body.deadline = f.deadline || '';
      const g = await api(`/goals/${goal.id}`, { method: 'PATCH', body });
      afterCheckin(g);
      onSaved?.(g);
      toast('Objetivo atualizado.');
      onClose();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Editar objetivo">
      <label className="field">Nome<input className="input" value={f.title} maxLength={80} onChange={(e) => set('title', e.target.value)} /></label>
      <div className="stack gap-8">
        <span className="t-14 strong">Categoria</span>
        <div className="chips" role="group" aria-label="Categoria">
          {CATEGORY_ORDER.map((c) => (
            <Chip key={c} small on={f.category === c} onClick={() => set('category', c)}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: CATEGORIES[c].color }} aria-hidden="true" />{CATEGORIES[c].label}
            </Chip>
          ))}
        </div>
      </div>
      {!tasks && daily && <NumberRow label="Meta por dia" value={f.minutes} suffix={f.minutes ? 'min' : '(só marcar)'} step={5} min={0} onChange={(v) => set('minutes', v)} />}
      {!tasks && (goal.kind === 'weekly' || goal.kind === 'count') && (
        <div className="stack gap-8">
          <NumberRow label={goal.kind === 'weekly' ? 'Por semana' : 'Por dia'} value={f.amount} onChange={(v) => set('amount', v)} />
          <label className="field">Unidade<input className="input" value={f.unit} maxLength={20} onChange={(e) => set('unit', e.target.value)} placeholder={goal.kind === 'weekly' ? 'treinos' : 'copos'} /></label>
        </div>
      )}
      {goal.kind === 'project' && (
        <label className="field">Prazo (opcional)<input type="date" className="input" value={f.deadline} onChange={(e) => set('deadline', e.target.value)} /></label>
      )}
      {goal.kind !== 'weekly' && (
        <div className="stack gap-8">
          <span className="t-14 strong">Dias que contam</span>
          <div className="row gap-6" role="group" aria-label="Dias">
            {WEEK.map((w) => {
              const on = f.activeDays.includes(w.d);
              return (
                <button key={w.d} type="button" aria-pressed={on} aria-label={w.full} onClick={() => flip(w.d)}
                  style={{ flex: 1, height: 44, borderRadius: 14, border: 'none', fontWeight: 700, background: on ? f.color : 'var(--nobi-card)', color: on ? '#FFFFFF' : 'var(--nobi-text-secondary)', boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--nobi-border)' }}>
                  {w.short}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="row gap-10 wrap" role="radiogroup" aria-label="Cor">
        {GOAL_COLORS.map(([hex, name]) => (
          <button key={hex} type="button" role="radio" aria-checked={f.color === hex} aria-label={name} onClick={() => set('color', hex)}
            style={{ width: 44, height: 44, borderRadius: 16, border: 'none', background: hex, boxShadow: f.color === hex ? `0 0 0 3px var(--nobi-bg), 0 0 0 5px ${hex}` : 'none' }} />
        ))}
      </div>
      <p className="t-13 muted">O tipo ({KIND_LABEL[goal.kind].toLowerCase()}) não muda, porque mudaria como a sequência é contada. Se precisar de outro tipo, crie um objetivo novo.</p>
      <ErrorNote error={error} />
      <button type="button" className="btn btn-primary block" onClick={save} disabled={busy || !f.title.trim() || (goal.kind !== 'weekly' && !f.activeDays.length)}>{busy ? 'Salvando…' : 'Salvar'}</button>
    </Sheet>
  );
}

/**
 * Ações do objetivo (botão ⋯): editar, arquivar, excluir ou sair do grupo.
 * onRemoved(id) tira o objetivo da lista; onChanged(goal) atualiza depois de editar.
 */
export default function GoalActions({ goal, meId, open, onClose, onRemoved, onChanged, showDetails = true }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState('menu'); // menu | confirm-delete | confirm-leave | edit
  const [busy, setBusy] = useState(false);
  const owner = goal.ownerId === meId;
  const shared = Boolean(goal.shared);
  const close = () => { setStep('menu'); onClose(); };

  const done = (msg, extra) => {
    invalidateLoad('/home', '/me/stats', '/goals/archived');
    onRemoved?.(goal.id);
    close();
    toast(msg, extra);
  };

  async function archive() {
    setBusy(true);
    try {
      await api(`/goals/${goal.id}`, { method: 'DELETE' });
      done('Objetivo arquivado.', {
        action: 'Desfazer',
        onAction: async () => {
          const g = await api(`/goals/${goal.id}/restore`, { method: 'POST' });
          invalidateLoad('/goals', '/goals/archived');
          onChanged?.(g, { restored: true });
          toast('Objetivo de volta.');
        },
      });
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  async function destroy() {
    setBusy(true);
    try {
      await api(`/goals/${goal.id}?modo=excluir`, { method: 'DELETE' });
      afterPost();
      done('Objetivo excluído.');
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }
  async function leave() {
    setBusy(true);
    try {
      await api(`/goals/${goal.id}`, { method: 'DELETE' });
      done('Você saiu do grupo.');
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  if (step === 'edit') return <EditGoalSheet goal={goal} open={open} onClose={close} onSaved={(g) => onChanged?.(g)} />;

  const Item = ({ icon, label, desc, onClick, danger }) => (
    <button type="button" className="list-row" onClick={onClick} disabled={busy} style={{ borderRadius: 16, color: danger ? 'var(--nobi-danger)' : undefined }}>
      <Icon name={icon} size={20} />
      <span className="grow stack" style={{ gap: 1 }}><span className="t-15 strong">{label}</span>{desc && <span className="t-13 muted">{desc}</span>}</span>
    </button>
  );

  return (
    <Sheet open={open} onClose={close} title={step === 'menu' ? goal.title : step === 'confirm-delete' ? 'Excluir de vez?' : 'Sair do grupo?'}>
      {step === 'menu' && (
        <div className="card flush card-list">
          {owner && <Item icon="edit" label="Editar" desc="nome, categoria, meta, dias e cor" onClick={() => setStep('edit')} />}
          {showDetails && <Item icon="calendar" label="Ver detalhes" desc="sequência, histórico e marcos" onClick={() => { close(); navigate(goal.shared?.endsAt ? `/desafios/${goal.id}` : `/metas/${goal.id}`); }} />}
          {!shared && <Item icon="download" label="Arquivar" desc="some das metas, mas dá para restaurar" onClick={archive} />}
          {!shared && <Item icon="trash" label="Excluir" desc="apaga o objetivo, os registros e os posts dele" onClick={() => setStep('confirm-delete')} danger />}
          {shared && <Item icon="logout" label="Sair do grupo" desc="seus registros ficam no seu histórico" onClick={() => setStep('confirm-leave')} danger />}
        </div>
      )}
      {step === 'confirm-delete' && (
        <>
          <p className="t-15 secondary">“{goal.title}” vai ser apagado com todos os registros e os posts sobre ele, incluindo fotos. Não dá para desfazer. Seu nível e suas conquistas continuam.</p>
          <p className="t-14 secondary">Se só quer tirar da frente, arquivar guarda o histórico.</p>
          <button type="button" className="btn btn-dark block" style={{ background: 'var(--nobi-danger)', color: '#FFFFFF' }} onClick={destroy} disabled={busy}>{busy ? 'Excluindo…' : 'Excluir de vez'}</button>
          <button type="button" className="btn btn-outline block" onClick={archive} disabled={busy}>Arquivar em vez disso</button>
          <button type="button" className="btn btn-ghost block" onClick={() => setStep('menu')}>Voltar</button>
        </>
      )}
      {step === 'confirm-leave' && (
        <>
          <p className="t-15 secondary">Você deixa de participar de “{goal.title}”. Seus registros ficam no seu histórico, e o grupo continua sem você.</p>
          <button type="button" className="btn btn-dark block" style={{ background: 'var(--nobi-danger)', color: '#FFFFFF' }} onClick={leave} disabled={busy}>Sair do grupo</button>
          <button type="button" className="btn btn-ghost block" onClick={() => setStep('menu')}>Voltar</button>
        </>
      )}
    </Sheet>
  );
}

