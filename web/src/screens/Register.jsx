import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Broto from '../components/Broto.jsx';
import Icon from '../components/Icon.jsx';
import { Chip, ErrorNote, Skeleton, Sheet, SelectRow, SwitchRow } from '../components/ui.jsx';
import { useLoad, afterCheckin, afterPost } from '../lib/useLoad.js';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { api } from '../lib/api.js';
import { CATEGORIES, CATEGORY_ORDER } from '../lib/format.js';
import PhotoPicker, { sendPostPhoto } from '../components/PhotoPicker.jsx';
import { useCelebrate, closedTheDay } from '../lib/celebrate.jsx';

const MINUTE_SET = new Set([5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 120, 150, 180, 240]);

export default function Register() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { me, patchMe } = useSession();
  const toast = useToast();
  const celebrate = useCelebrate();
  const { data: allGoals, loading, error, reload } = useLoad('/goals');
  // Folha com rota própria: fechar volta para a tela de baixo (ou para o Feed, se abriu direto)
  const close = () => (state?.backgroundLocation ? navigate(-1) : navigate('/', { replace: true }));
  const goals = useMemo(() => (allGoals || []).filter((g) => !g.shared?.tasks?.length), [allGoals]);

  const [cat, setCat] = useState(null);
  const [goalId, setGoalId] = useState(state?.goalId || null);
  const [mins, setMins] = useState(state?.minutes || 30);
  const [qty, setQty] = useState(1);
  const [pages, setPages] = useState('');
  const [km, setKm] = useState('');
  const [note, setNote] = useState('');
  const preset = state?.preset;
  const [share, setShare] = useState(Boolean(preset?.share));
  const [aud, setAud] = useState(preset?.audience || 'friends');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Começa na categoria do objetivo indicado ou do primeiro que ainda falta hoje
  useEffect(() => {
    if (!goals.length || cat) return;
    const start = goals.find((g) => g.id === state?.goalId)
      || (preset?.category && (goals.find((g) => g.category === preset.category && !g.status.periodDone) || goals.find((g) => g.category === preset.category)))
      || goals.find((g) => g.kind !== 'project' && !g.status.periodDone && g.status.activeToday) || goals[0];
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
      afterCheckin(r.goal);
      if (r.celebration) {
        // Fechou um marco: a Conquista oferece postar (com a escolha de público já feita aqui, se houver)
        const sent = share ? await sendPostPhoto(photo) : undefined;
        navigate('/conquista', { replace: true, state: { celebration: r.celebration, audience: share ? aud : null, text: note.trim(), photo: sent } });
        return;
      }
      if (share) {
        await api('/posts', { method: 'POST', body: { checkinId: r.checkin.id, audience: aud, text: note.trim(), photo: await sendPostPhoto(photo) } });
        afterPost();
      }
      if (closedTheDay(goal, r.goal)) {
        celebrate(r.goal, { checkinId: r.checkin.id, posted: share, level: r.me.leveledUp ? r.me.level : null });
      } else if (share) {
        toast(aud === 'public' ? 'Registrado e publicado para todo mundo.' : 'Registrado e publicado para seus amigos.');
      } else {
        toast(r.me.leveledUp ? `Registrado. Subiu para o nível ${r.me.level}!` : 'Registrado. Conta nas suas sequências.');
      }
      close();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  const minuteOptions = [5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 120, 150, 180, 240].concat((MINUTE_SET.has(mins) ? [] : [mins])).sort((a, b) => a - b).map((m) => [m, m < 60 || m % 60 ? `${m} min` : `${m / 60} h`]);
  const qtyOptions = Array.from({ length: 20 }, (_, k) => [k + 1, `${k + 1} ${goal?.target?.unit || ''}`.trim()]);

  return (
    <Sheet
      open
      routed
      onClose={close}
      labelledBy="registrar-titulo"
      peek={<Broto size={96} stage={me?.stage} golden={me?.golden} expression="foco" shadow={false} />}
      header={(
        <div className="row between gap-12">
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={close}><Icon name="close" /></button>
          <span className="t-16 strong">Registrar</span>
          <span style={{ width: 44 }} />
        </div>
      )}
    >
      <h1 id="registrar-titulo" className="title t-22" style={{ fontWeight: 800 }}>O que você fez hoje?</h1>
      <ErrorNote error={error} onRetry={reload} />
      {loading && !allGoals && <Skeleton height={180} />}

      {allGoals && (
        <>
          <div className="row gap-8 wrap" role="group" aria-label="Categoria">
            {CATEGORY_ORDER.map((c) => (
              <Chip key={c} small on={cat === c} onClick={() => pick(c)} style={{ opacity: goals.some((g) => g.category === c) ? 1 : 0.6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 4, background: CATEGORIES[c].color }} aria-hidden="true" />{CATEGORIES[c].label}
              </Chip>
            ))}
          </div>

          {!goal ? (
            <div className="stack gap-10">
              <p className="t-15 secondary">Você ainda não tem um objetivo de {unitWord}.</p>
              <Link className="btn btn-dark" to={`/metas/novo?categoria=${cat}`}>Criar objetivo de {unitWord}</Link>
            </div>
          ) : (
            <>
              <div className="row-group">
                {inCat.length > 1 && (
                  <SelectRow label="Objetivo" value={goal.id} onChange={setGoalId} options={inCat.map((g) => [g.id, g.title])} />
                )}
                {isCount ? (
                  <SelectRow label={`Quantidade · ${goal.status.todayValue} de ${goal.status.need} hoje`} value={qty} onChange={(v) => setQty(Number(v))} options={qtyOptions} chevron="right" />
                ) : (
                  <SelectRow label="Tempo" value={mins} onChange={(v) => setMins(Number(v))} options={minuteOptions} chevron="right" />
                )}
                {(cat === 'leitura' || cat === 'treino') && (
                  <label className="select-row">
                    <span className="grow t-15" style={{ fontWeight: 500 }}>{cat === 'leitura' ? 'Páginas' : 'Distância (km)'}</span>
                    <input className="inline-input" inputMode="decimal" value={cat === 'leitura' ? pages : km}
                      onChange={(e) => (cat === 'leitura' ? setPages(e.target.value.replace(/\D/g, '')) : setKm(e.target.value.replace(/[^\d.,]/g, '')))}
                      placeholder="opcional" aria-label={cat === 'leitura' ? 'Páginas' : 'Distância em km'} />
                  </label>
                )}
              </div>

              <label className="field">
                <span className="sr-only">Nota</span>
                <textarea className="textarea" rows={2} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional): como foi?" />
              </label>

              <div className="row-group">
                <SwitchRow label="Publicar no feed" hint={share ? undefined : 'Não vai pro feed. Conta nas suas sequências.'} checked={share} onChange={setShare} />
                {share && <SelectRow label="Para quem" value={aud} onChange={setAud} options={[['friends', 'Amigos'], ['public', 'Público']]} />}
              </div>
              {share && <PhotoPicker value={photo} onChange={setPhoto} />}

              {willClose && (
                <p className="row gap-8 t-14 strong" style={{ color: 'var(--nobi-text-streak)' }}>
                  <Icon name="flame" size={18} style={{ color: 'var(--nobi-brasa)' }} />
                  Isso fecha {goal.streak.unit === 'weeks' ? 'sua' : 'seu'} {goal.wouldBe}{goal.streak.unit === 'weeks' ? 'ª semana seguida' : 'º dia seguido'} de {unitWord}
                </p>
              )}
              <ErrorNote error={err} />
              <button type="button" className="btn btn-primary block" style={{ borderRadius: 27 }} onClick={submit} disabled={busy}>{busy ? 'Registrando…' : 'Registrar'}</button>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
