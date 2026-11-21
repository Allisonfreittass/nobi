import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { BackButton, ErrorNote, Sheet, Skeleton } from '../../components/ui.jsx';
import { useLoad, invalidateLoad } from '../../lib/useLoad.js';
import { api } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { useConfirm } from '../../lib/confirm.jsx';
import { shortDate } from '../../lib/format.js';
import { Delta, NumField, kg, plannedText, setsText, volume } from './parts.jsx';

/** Edita (ou cria) um exercício do plano sem abrir o treino inteiro: séries, reps, carga, ordem. */
function ExerciseSheet({ open, onClose, initial, position, count, onSave, onDelete, onMove }) {
  const [ex, setEx] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setEx(initial); }, [open, initial]);
  if (!ex) return null;
  const isNew = !initial?.key;
  const set = (k) => (v) => setEx((e) => ({ ...e, [k]: v }));
  const run = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  return (
    <Sheet open={open} onClose={onClose} title={isNew ? 'Novo exercício' : 'Editar exercício'}>
      <div className="stack gap-14">
        <label className="field">
          Nome
          <input className="input" value={ex.name} maxLength={60} placeholder="Ex.: Supino reto" onChange={(e) => set('name')(e.target.value)} />
        </label>
        <div className="num-row">
          <NumField label="Séries" value={ex.sets} min={1} max={20} onChange={(v) => set('sets')(v === '' ? '' : Math.max(1, Math.min(20, v)))} />
          <label className="num-field">
            <span className="num-field-label">Reps</span>
            <span className="num-field-box"><input value={ex.reps} maxLength={12} placeholder="8-12" onChange={(e) => set('reps')(e.target.value)} onFocus={(e) => e.target.select()} /></span>
          </label>
          <NumField label="Carga" value={ex.load} step={0.5} decimal suffix="kg" onChange={set('load')} />
        </div>
        <p className="t-13 muted">É a carga planejada. No treino do dia, o app sugere o que você fez da última vez.</p>
        {!isNew && count > 1 && (
          <div className="row gap-8">
            <button type="button" className="chip sm" disabled={busy || position === 0} onClick={() => run(() => onMove(-1))}>↑ Subir</button>
            <button type="button" className="chip sm" disabled={busy || position === count - 1} onClick={() => run(() => onMove(1))}>↓ Descer</button>
          </div>
        )}
        <button type="button" className="btn btn-dark block" disabled={busy || !String(ex.name).trim()}
          onClick={() => run(() => onSave({ ...ex, name: String(ex.name).trim(), sets: Number(ex.sets) || 1, load: Number(ex.load) || 0, reps: String(ex.reps || '').trim() || '10' }))}>
          {busy ? 'Salvando…' : isNew ? 'Adicionar' : 'Salvar'}
        </button>
        {!isNew && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(onDelete)}><Icon name="trash" size={17} /> Remover do treino</button>}
      </div>
    </Sheet>
  );
}

export default function Treino() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: plan, error, reload, setData } = useLoad(`/treinos/${id}`);
  const [menu, setMenu] = useState(false);
  const [openSession, setOpenSession] = useState(null);
  const [tab, setTab] = useState(null);
  const [editing, setEditing] = useState(null); // { dayKey, ex, index }
  const [allSessions, setAllSessions] = useState(false);

  if (error) return <div className="screen no-nav"><BackButton /><ErrorNote error={error} onRetry={reload} /></div>;
  if (!plan) return <div className="screen no-nav"><Skeleton height={200} /><Skeleton height={56} /><Skeleton height={220} /></div>;

  const archived = Boolean(plan.archivedAt);
  const { completed } = plan.progress;
  const refresh = () => invalidateLoad('/treinos', '/treinos/historico', '/treinos/exercicios');
  const day = plan.days.find((d) => d.key === tab) || plan.days.find((d) => d.key === plan.next?.key) || plan.days[0];

  async function saveDays(days, msg) {
    try {
      const r = await api(`/treinos/${plan.id}`, { method: 'PATCH', body: { days } });
      setData((p) => ({ ...p, ...r }));
      refresh();
      if (msg) toast(msg);
      return true;
    } catch (e) { toast(e.message); return false; }
  }
  const withDay = (fn) => plan.days.map((d) => (d.key === editing.dayKey ? { ...d, exercises: fn(d.exercises) } : d));
  async function saveExercise(ex) {
    const days = withDay((list) => (ex.key ? list.map((e) => (e.key === ex.key ? ex : e)) : [...list, ex]));
    if (await saveDays(days, ex.key ? 'Exercício atualizado.' : 'Exercício adicionado.')) setEditing(null);
  }
  async function deleteExercise() {
    const others = plan.days.reduce((n, d) => n + d.exercises.length, 0);
    if (others <= 1) { toast('O treino precisa de pelo menos um exercício.'); return; }
    if (!(await confirm({ title: `Remover “${editing.ex.name}”?`, message: 'Sai do plano. O que você já registrou dele continua no histórico.', confirmLabel: 'Remover', danger: true }))) return;
    if (await saveDays(withDay((list) => list.filter((e) => e.key !== editing.ex.key)), 'Exercício removido.')) setEditing(null);
  }
  async function moveExercise(dir) {
    const i = editing.index;
    const days = withDay((list) => { const next = [...list]; const [it] = next.splice(i, 1); next.splice(i + dir, 0, it); return next; });
    if (await saveDays(days)) setEditing((e) => ({ ...e, index: i + dir }));
  }

  async function archive() {
    setMenu(false);
    try {
      await api(`/treinos/${plan.id}/${archived ? 'restaurar' : 'arquivar'}`, { method: 'POST' });
      refresh();
      setData((p) => ({ ...p, archivedAt: archived ? null : new Date().toISOString() }));
      toast(archived ? 'Treino de volta aos ativos.' : `“${plan.name}” foi para o histórico.`);
    } catch (e) { toast(e.message); }
  }
  async function destroy() {
    setMenu(false);
    if (!(await confirm({ title: `Excluir “${plan.name}” de vez?`, message: 'Apaga o programa e todas as sessões com as cargas. Os check-ins no objetivo continuam. Não dá para desfazer.', confirmLabel: 'Excluir de vez', danger: true }))) return;
    try {
      await api(`/treinos/${plan.id}`, { method: 'DELETE' });
      refresh();
      navigate('/treinos', { replace: true });
      toast('Treino excluído.');
    } catch (e) { toast(e.message); }
  }
  async function removeSession(s) {
    if (!(await confirm({ title: `Apagar o treino de ${shortDate(s.date)}?`, message: 'As cargas desse dia saem do histórico e o progresso volta um treino. O check-in no objetivo continua.', confirmLabel: 'Apagar', danger: true }))) return;
    try {
      await api(`/treinos/${plan.id}/sessoes/${s.id}`, { method: 'DELETE' });
      refresh();
      setOpenSession(null);
      reload();
    } catch (e) { toast(e.message); }
  }

  const evolution = plan.summary.exercises.filter((e) => e.sessions > 1).slice(0, 5);
  const sessions = allSessions ? plan.sessions : plan.sessions.slice(0, 5);
  const status = archived ? 'Arquivado' : completed ? 'Concluído' : plan.todaySessionId ? 'Feito hoje' : 'Em andamento';
  const pct = Math.round(plan.progress.pct * 100);

  return (
    <div className="screen no-nav">
      <header className="screen-head">
        <BackButton onClick={() => navigate(archived ? '/treinos/historico' : '/treinos')} />
        <button type="button" className="icon-btn" aria-label="Opções do treino" onClick={() => setMenu(true)}><Icon name="more" /></button>
      </header>

      <section className="card plan-hero stack gap-14">
        <span className="label-caps t-12">{status}</span>
        <h1 className="title t-28 plan-name">{plan.name}</h1>
        <div className="plan-stats">
          <div><span className="num t-40">{plan.progress.done}<span className="t-20">/{plan.progress.total}</span></span><span className="t-13 strong">treinos</span></div>
          <div><span className="num t-40">{pct}<span className="t-20">%</span></span><span className="t-13 strong">concluído</span></div>
          {plan.summary.volume >= 1000 && <div><span className="num t-40">{Math.round(plan.summary.volume / 1000).toLocaleString('pt-BR')}<span className="t-20"> t</span></span><span className="t-13 strong">levantadas</span></div>}
        </div>
        <div className="plan-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progresso do treino">
          <span style={{ width: `${pct}%` }} />
        </div>
        <span className="t-13 strong plan-meta">Desde {shortDate(plan.startedAt)}{plan.goal ? ` · conta em “${plan.goal.title}”` : ''}</span>
      </section>

      {!archived && (completed ? (
        <section className="card stack gap-10">
          <h2 className="title t-18">Você fechou os {plan.totalSessions} treinos!</h2>
          <p className="t-14 secondary">Arquive para guardar as cargas no histórico e comparar com o próximo programa. Se quiser continuar, aumente o total em Editar.</p>
          <button type="button" className="btn btn-dark" onClick={archive}>Arquivar no histórico</button>
        </section>
      ) : plan.todaySessionId ? (
        <button type="button" className="btn btn-soft lg block" onClick={() => navigate(`/treinos/${plan.id}/sessao`)}><Icon name="check" size={18} /> Feito hoje · ajustar</button>
      ) : plan.next && (
        <button type="button" className="btn btn-dark lg block cta-ellipsis" onClick={() => navigate(`/treinos/${plan.id}/sessao?dia=${day.key}`)}>
          <Icon name="play" size={18} /> <span className="ellipsis">Treinar {day.name}</span>
        </button>
      ))}

      <section className="stack gap-10" aria-label="Divisões">
        <div className="section-head"><h2 className="title t-18">Divisões</h2>{!archived && <span className="t-13 muted">toque para editar</span>}</div>
        {plan.days.length > 1 && (
          <div className="chips day-chips" role="group" aria-label="Divisões do treino">
            {plan.days.map((d) => (
              <button key={d.key} type="button" className="chip" aria-pressed={d.key === day.key} onClick={() => setTab(d.key)}>
                <span className="ellipsis">{d.name}</span>
                {plan.next?.key === d.key && !archived && !completed && <span className="chip-dot" title={plan.todaySessionId ? 'hoje' : 'próximo'} />}
              </button>
            ))}
          </div>
        )}
        <div className="card flush card-list" aria-label={day.name}>
          {day.exercises.map((ex, i) => (
            <button key={ex.key} type="button" className="list-row" disabled={archived} onClick={() => setEditing({ dayKey: day.key, ex, index: i })}>
              <span className="ex-badge" aria-hidden="true">{i + 1}</span>
              <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
                <span className="t-15 strong ellipsis">{ex.name}</span>
                <span className="t-13 secondary">{plannedText(ex)}</span>
              </span>
              {!archived && <Icon name="edit" size={16} className="muted" />}
            </button>
          ))}
          {!archived && day.exercises.length < 20 && (
            <button type="button" className="list-row" onClick={() => setEditing({ dayKey: day.key, ex: { name: '', sets: 3, reps: '10', load: '' }, index: day.exercises.length })}>
              <span className="ex-badge" aria-hidden="true"><Icon name="plus" size={16} /></span>
              <span className="t-15 strong">Adicionar exercício</span>
            </button>
          )}
        </div>
        {!archived && !plan.todaySessionId && plan.days.length > 1 && day.key !== plan.next?.key && !completed && (
          <button type="button" className="btn btn-outline sm cta-ellipsis" style={{ alignSelf: 'flex-start', maxWidth: '100%' }} onClick={() => navigate(`/treinos/${plan.id}/sessao?dia=${day.key}`)}>
            <span className="ellipsis">Fazer {day.name} hoje</span>
          </button>
        )}
      </section>

      {evolution.length > 0 && (
        <section className="stack gap-10" aria-label="Evolução das cargas">
          <div className="section-head"><h2 className="title t-18">Evolução das cargas</h2><Link to="/treinos/historico?aba=exercicios" className="t-13 strong secondary">Ver tudo</Link></div>
          <div className="card flush card-list">
            {evolution.map((e) => (
              <Link key={e.slug} to={`/treinos/historico?aba=exercicios&ex=${e.slug}`} className="list-row">
                <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
                  <span className="t-15 strong ellipsis">{e.name}</span>
                  <span className="t-13 secondary">{kg(e.firstLoad)} → {kg(e.bestLoad)}</span>
                </span>
                <Delta from={e.firstLoad} to={e.bestLoad} />
                <Icon name="chevron" size={16} className="muted" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="stack gap-10" aria-label="Sessões">
        <div className="section-head">
          <h2 className="title t-18">Sessões</h2>
          {plan.sessions.length > 0 && <span className="t-13 muted">{plan.sessions.length} no total</span>}
        </div>
        {plan.sessions.length === 0 ? (
          <p className="t-14 secondary">Nenhum treino feito ainda. O primeiro é o mais importante.</p>
        ) : (
          <div className="card flush card-list">
            {sessions.map((s) => (
              <button key={s.id} type="button" className="list-row" onClick={() => setOpenSession(s)}>
                <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
                  <span className="t-15 strong ellipsis">{shortDate(s.date)} · {s.dayName || 'Treino'}</span>
                  <span className="t-13 secondary">{volume(s.volume)}{s.minutes ? ` · ${s.minutes} min` : ''}</span>
                </span>
                <Icon name="chevron" size={16} className="muted" />
              </button>
            ))}
            {plan.sessions.length > 5 && (
              <button type="button" className="list-row" onClick={() => setAllSessions((v) => !v)}>
                <span className="t-14 strong secondary grow" style={{ textAlign: 'center' }}>{allSessions ? 'Mostrar menos' : `Ver todas (${plan.sessions.length})`}</span>
              </button>
            )}
          </div>
        )}
      </section>

      <ExerciseSheet open={Boolean(editing)} onClose={() => setEditing(null)} initial={editing?.ex}
        position={editing?.index} count={plan.days.find((d) => d.key === editing?.dayKey)?.exercises.length || 0}
        onSave={saveExercise} onDelete={deleteExercise} onMove={moveExercise} />

      <Sheet open={menu} onClose={() => setMenu(false)} title="Opções do treino">
        <div className="card flush card-list">
          {!archived && <button type="button" className="list-row" onClick={() => { setMenu(false); navigate(`/treinos/${plan.id}/editar`); }}><Icon name="edit" size={20} /> <span className="grow t-15 strong">Editar nome, duração e divisões</span></button>}
          <button type="button" className="list-row" onClick={archive}><Icon name={archived ? 'sprout' : 'download'} size={20} /> <span className="grow t-15 strong">{archived ? 'Restaurar aos ativos' : 'Arquivar no histórico'}</span></button>
          <button type="button" className="list-row" onClick={destroy}><Icon name="trash" size={20} /> <span className="grow t-15 strong">Excluir de vez</span></button>
        </div>
      </Sheet>

      <Sheet open={Boolean(openSession)} onClose={() => setOpenSession(null)} title={openSession ? shortDate(openSession.date) : ''}>
        {openSession && (
          <div className="stack gap-12">
            <p className="t-14 secondary">{openSession.dayName} · {volume(openSession.volume)}{openSession.minutes ? ` · ${openSession.minutes} min` : ''}</p>
            <div className="card flush card-list">
              {openSession.exercises.map((e, i) => (
                <div key={i} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
                    <span className="t-15 strong" style={{ overflowWrap: 'anywhere' }}>{e.name}</span>
                    <span className="t-13 secondary">{setsText(e.sets)}</span>
                  </span>
                </div>
              ))}
            </div>
            {openSession.note && <p className="t-14 secondary">“{openSession.note}”</p>}
            {!archived && <button type="button" className="btn btn-ghost" onClick={() => removeSession(openSession)}><Icon name="trash" size={17} /> Apagar este treino</button>}
          </div>
        )}
      </Sheet>
    </div>
  );
}
