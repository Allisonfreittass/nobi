import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Broto from '../components/Broto.jsx';
import Icon from '../components/Icon.jsx';
import { Chip, Segmented, Toggle, ErrorNote, Skeleton } from '../components/ui.jsx';
import { useLoad } from '../lib/useLoad.js';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { api } from '../lib/api.js';
import { CATEGORIES, CATEGORY_ORDER } from '../lib/format.js';

function Stepper({ value, onChange, step, min, unit, label }) {
  return (
    <div className="row between card" style={{ padding: 8 }} role="group" aria-label={label}>
      <button type="button" className="icon-btn" style={{ width: 52, height: 52, borderRadius: 18 }} aria-label={`Menos ${step}`} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>
        <Icon name="minus" size={22} stroke={2.4} />
      </button>
      <span className="row gap-6" style={{ alignItems: 'baseline' }} aria-live="polite">
        <span className="num t-40">{value}</span><span className="strong t-16">{unit}</span>
      </span>
      <button type="button" className="icon-btn" style={{ width: 52, height: 52, borderRadius: 18 }} aria-label={`Mais ${step}`} onClick={() => onChange(value + step)}>
        <Icon name="plus" size={22} stroke={2.4} />
      </button>
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { me, patchMe } = useSession();
  const toast = useToast();
  const { data: allGoals, loading, error, reload } = useLoad('/goals');
  const goals = useMemo(() => (allGoals || []).filter((g) => !g.shared?.tasks?.length), [allGoals]);

  const [cat, setCat] = useState(null);
  const [goalId, setGoalId] = useState(state?.goalId || null);
  const [mins, setMins] = useState(state?.minutes || 30);
  const [qty, setQty] = useState(1);
  const [pages, setPages] = useState('');
  const [km, setKm] = useState('');
  const [note, setNote] = useState('');
  const [share, setShare] = useState(false);
  const [aud, setAud] = useState('friends');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Começa na categoria do objetivo indicado ou do primeiro que ainda falta hoje
  useEffect(() => {
    if (!goals.length || cat) return;
    const start = goals.find((g) => g.id === state?.goalId) || goals.find((g) => g.kind !== 'project' && !g.status.periodDone && g.status.activeToday) || goals[0];
    setCat(start.category);
    setGoalId(start.id);
  }, [goals, cat, state]);

  const inCat = goals.filter((g) => g.category === cat);
  const goal = inCat.find((g) => g.id === goalId) || inCat[0];
  useEffect(() => {
    if (goal?.kind === 'count') setQty(1);
    else if (goal?.target?.unit === 'min' && !state?.minutes) setMins(Math.max(5, Math.ceil(goal.status.need / 5) * 5));
  }, [goal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (c) => { setCat(c); setGoalId(goals.find((g) => g.category === c)?.id || null); };
  const isCount = goal?.kind === 'count';
  const unitWord = CATEGORIES[cat]?.label.toLowerCase();
  const willClose = goal && !goal.status.periodDone && goal.wouldBe >= 2;

  async function submit() {
    if (!goal) return;
    setBusy(true);
    setErr(null);
    try {
      const body = isCount ? { value: qty } : { minutes: mins };
      if (pages) body.pages = Number(pages);
      if (km) body.km = Number(String(km).replace(',', '.'));
      if (note.trim()) body.note = note.trim();
      const r = await api(`/goals/${goal.id}/checkins`, { method: 'POST', body });
      patchMe({ level: r.me.level, xp: r.me.xp, golden: r.me.golden, stage: r.me.stage });
      if (r.celebration) {
        // Fechou um marco: a Conquista oferece postar (com a escolha de público já feita aqui, se houver)
        navigate('/conquista', { replace: true, state: { celebration: r.celebration, audience: share ? aud : null, text: note.trim() } });
        return;
      }
      if (share) {
        await api('/posts', { method: 'POST', body: { checkinId: r.checkin.id, audience: aud, text: note.trim() } });
        toast(aud === 'public' ? 'Registrado e publicado para todo mundo.' : 'Registrado e publicado para seus amigos.');
      } else {
        toast(r.me.leveledUp ? `Registrado. Subiu para o nível ${r.me.level}!` : 'Registrado. Conta nas suas sequências.');
      }
      navigate('/', { replace: true });
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="block-brasa" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', padding: 'calc(16px + env(safe-area-inset-top)) 20px 0', position: 'relative', height: 150 }}>
        <button type="button" className="icon-btn" style={{ background: 'rgba(20,18,24,.12)', boxShadow: 'none', color: 'var(--nobi-tinta)' }} aria-label="Fechar" onClick={() => navigate(-1)}>
          <Icon name="close" />
        </button>
        {/* O Broto espia por trás da folha: as pernas ficam escondidas */}
        <div style={{ position: 'absolute', right: 34, bottom: -58 }} aria-hidden="true">
          <Broto size={120} stage={me?.stage} golden={me?.golden} expression="foco" shadow={false} />
        </div>
      </div>
      <div style={{ flex: 1, background: 'var(--nobi-bg)', color: 'var(--nobi-text)', borderRadius: '32px 32px 0 0', position: 'relative', zIndex: 1 }}>
        <div className="stack gap-18" style={{ maxWidth: 560, margin: '0 auto', padding: '24px 20px calc(28px + env(safe-area-inset-bottom))' }}>
          <h1 className="title t-28">O que você fez hoje?</h1>
          <ErrorNote error={error} onRetry={reload} />
          {loading && !allGoals && <Skeleton height={180} />}

          {allGoals && (
            <>
              <div role="group" aria-label="Categoria" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {CATEGORY_ORDER.map((c) => {
                  const on = cat === c;
                  const n = goals.filter((g) => g.category === c).length;
                  return (
                    <button key={c} type="button" aria-pressed={on} onClick={() => pick(c)} className="tap"
                      style={{ height: 84, borderRadius: 20, border: 'none', padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', background: 'var(--nobi-card)', boxShadow: on ? 'inset 0 0 0 2.5px var(--nobi-text)' : 'inset 0 0 0 1px var(--nobi-border)', transition: 'box-shadow var(--nobi-dur-fast)', opacity: n ? 1 : 0.7 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 8, background: CATEGORIES[c].color }} aria-hidden="true" />
                      <span className="t-15 strong">{CATEGORIES[c].label}</span>
                    </button>
                  );
                })}
              </div>

              {!goal ? (
                <div className="card stack gap-10">
                  <p className="t-15">Você ainda não tem um objetivo de {unitWord}.</p>
                  <Link className="btn btn-dark" to={`/metas/novo?categoria=${cat}`}>Criar objetivo de {unitWord}</Link>
                </div>
              ) : (
                <>
                  {inCat.length > 1 && (
                    <div className="chips" role="group" aria-label="Objetivo">
                      {inCat.map((g) => <Chip key={g.id} on={g.id === goal.id} onClick={() => setGoalId(g.id)}>{g.title}</Chip>)}
                    </div>
                  )}
                  <div className="stack gap-8">
                    <span className="t-14 strong">{isCount ? `Quantidade · ${goal.status.todayValue} de ${goal.status.need} hoje` : 'Tempo'}</span>
                    {isCount
                      ? <Stepper label="Quantidade" value={qty} onChange={setQty} step={1} min={1} unit={goal.target.unit} />
                      : <Stepper label="Tempo em minutos" value={mins} onChange={setMins} step={5} min={5} unit="min" />}
                  </div>
                  {(cat === 'leitura' || cat === 'treino') && (
                    <label className="field">
                      {cat === 'leitura' ? 'Páginas (opcional)' : 'Distância em km (opcional)'}
                      <input className="input" inputMode="decimal" value={cat === 'leitura' ? pages : km}
                        onChange={(e) => (cat === 'leitura' ? setPages(e.target.value.replace(/\D/g, '')) : setKm(e.target.value.replace(/[^\d.,]/g, '')))}
                        placeholder={cat === 'leitura' ? 'Ex.: 24' : 'Ex.: 5,2'} />
                    </label>
                  )}
                  <label className="field">
                    Nota (opcional)
                    <textarea className="textarea" rows={2} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Como foi?" />
                  </label>

                  <div className="card stack gap-12">
                    <div className="row between gap-12">
                      <div className="stack">
                        <span id="share-l" className="t-15 strong">Publicar no feed</span>
                        <span className="t-13 muted">você decide agora</span>
                      </div>
                      <Toggle checked={share} onChange={setShare} label="Publicar no feed" />
                    </div>
                    {share ? (
                      <div className="row between gap-12">
                        <span className="t-14 strong">Para quem</span>
                        <Segmented compact label="Para quem" options={[['friends', 'Amigos'], ['public', 'Público']]} value={aud} onChange={setAud} />
                      </div>
                    ) : (
                      <p className="t-13 secondary">Não vai pro feed. Conta normalmente nas suas sequências e estatísticas.</p>
                    )}
                  </div>

                  {willClose && (
                    <p className="row gap-8 t-14 strong" style={{ color: 'var(--nobi-text-streak)' }}>
                      <Icon name="flame" size={18} style={{ color: 'var(--nobi-brasa)' }} />
                      Isso fecha {goal.streak.unit === 'weeks' ? 'sua' : 'seu'} {goal.wouldBe}{goal.streak.unit === 'weeks' ? 'ª semana seguida' : 'º dia seguido'} de {unitWord}
                    </p>
                  )}
                  <ErrorNote error={err} />
                  <button type="button" className="btn btn-primary lg block" onClick={submit} disabled={busy}>{busy ? 'Registrando…' : 'Registrar'}</button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
