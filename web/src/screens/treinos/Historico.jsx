import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { BackButton, ErrorNote, Segmented, SelectRow, Skeleton } from '../../components/ui.jsx';
import { useLoad, invalidateLoad } from '../../lib/useLoad.js';
import { api } from '../../lib/api.js';
import { useToast } from '../../lib/toast.jsx';
import { useConfirm } from '../../lib/confirm.jsx';
import { shortDate } from '../../lib/format.js';
import { Delta, kg, kgShort, progressText, setsText, volume } from './parts.jsx';

const TABS = [['programas', 'Programas'], ['comparar', 'Comparar'], ['exercicios', 'Exercícios']];
const dayMonth = (iso) => { const [, m, d] = iso.split('-'); return `${Number(d)}/${Number(m)}`; };
const spanDays = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 86400000) + 1 : 0);

// ——— Programas arquivados ———

function Programas({ plans, onChange }) {
  const toast = useToast();
  const confirm = useConfirm();
  const archived = plans.filter((p) => p.archivedAt);
  if (!archived.length) {
    return (
      <section className="card empty">
        <h2 className="title t-18">Nada arquivado ainda</h2>
        <p className="t-14 secondary" style={{ maxWidth: 320 }}>Quando você terminar um treino e arquivar, ele fica aqui com as cargas, para comparar com os próximos.</p>
      </section>
    );
  }
  async function restore(p) {
    try {
      await api(`/treinos/${p.id}/restaurar`, { method: 'POST' });
      invalidateLoad('/treinos');
      onChange();
      toast('Treino de volta aos ativos.');
    } catch (e) { toast(e.message); }
  }
  async function destroy(p) {
    if (!(await confirm({ title: `Excluir “${p.name}” de vez?`, message: 'Apaga o programa e todas as cargas registradas nele. Não dá para desfazer.', confirmLabel: 'Excluir de vez', danger: true }))) return;
    try {
      await api(`/treinos/${p.id}`, { method: 'DELETE' });
      invalidateLoad('/treinos/exercicios');
      onChange();
      toast('Treino excluído.');
    } catch (e) { toast(e.message); }
  }
  return archived.map((p) => {
    const s = p.summary;
    return (
      <article key={p.id} className="card stack gap-12">
        <Link to={`/treinos/${p.id}`} className="stack gap-4 plan-link">
          <span className="row between gap-12"><span className="title t-18 ellipsis">{p.name}</span><Icon name="chevron" size={18} className="muted" /></span>
          <span className="t-13 secondary">{s.firstDate ? `${shortDate(s.firstDate)} a ${shortDate(s.lastDate)}` : 'Sem sessões'} · {progressText(p.progress)}</span>
        </Link>
        <div className="stat-row">
          <div><span className="num t-20">{s.sessions}</span><span className="t-12 muted">treinos</span></div>
          <div><span className="num t-20">{Math.round(s.volume / 1000).toLocaleString('pt-BR')} t</span><span className="t-12 muted">volume</span></div>
          <div><span className="num t-20">{s.sessions ? Math.round(s.volume / s.sessions).toLocaleString('pt-BR') : 0}</span><span className="t-12 muted">kg por treino</span></div>
        </div>
        {s.exercises.length > 0 && (
          <div className="stack gap-4">
            {s.exercises.slice(0, 3).map((e) => (
              <div key={e.slug} className="row between gap-8 t-13">
                <span className="ellipsis">{e.name}</span>
                <span className="secondary" style={{ whiteSpace: 'nowrap' }}>{kg(e.firstLoad)} → <strong>{kg(e.bestLoad)}</strong></span>
              </div>
            ))}
          </div>
        )}
        <div className="row gap-8">
          <button type="button" className="btn btn-outline sm" onClick={() => restore(p)}>Restaurar</button>
          <button type="button" className="icon-btn plain" aria-label={`Excluir ${p.name} de vez`} onClick={() => destroy(p)}><Icon name="trash" size={18} /></button>
        </div>
      </article>
    );
  });
}

// ——— Um programa contra o outro ———

function Comparar({ plans }) {
  // Do mais antigo para o mais novo: "Antes" é o penúltimo, "Depois" o último
  const withData = plans.filter((p) => p.summary.sessions > 0).sort((x, y) => (x.summary.firstDate < y.summary.firstDate ? -1 : 1));
  const [aId, setA] = useState(withData.at(-2)?.id || '');
  const [bId, setB] = useState(withData.at(-1)?.id || '');
  const a = withData.find((p) => p.id === aId);
  const b = withData.find((p) => p.id === bId);

  const rows = useMemo(() => {
    if (!a || !b) return [];
    const byA = new Map(a.summary.exercises.map((e) => [e.slug, e]));
    const byB = new Map(b.summary.exercises.map((e) => [e.slug, e]));
    const slugs = [...new Set([...byA.keys(), ...byB.keys()])];
    return slugs.map((s) => ({ slug: s, name: (byB.get(s) || byA.get(s)).name, a: byA.get(s), b: byB.get(s) }))
      .sort((x, y) => Number(Boolean(y.a && y.b)) - Number(Boolean(x.a && x.b)) || (y.b?.volume || 0) - (x.b?.volume || 0));
  }, [a, b]);

  if (withData.length < 2) {
    return (
      <section className="card empty">
        <h2 className="title t-18">Precisa de dois treinos com sessões</h2>
        <p className="t-14 secondary" style={{ maxWidth: 320 }}>Faça pelo menos um treino em dois programas diferentes para comparar as cargas entre eles.</p>
      </section>
    );
  }
  const label = (p) => `${p.name}${p.archivedAt ? '' : ' (ativo)'}`;
  const options = withData.map((p) => [p.id, label(p)]);
  const perSession = (p) => (p.summary.sessions ? p.summary.volume / p.summary.sessions : 0);
  const stats = a && b ? [
    ['Treinos feitos', a.summary.sessions, b.summary.sessions, (n) => n],
    ['Duração (dias)', spanDays(a.summary.firstDate, a.summary.lastDate), spanDays(b.summary.firstDate, b.summary.lastDate), (n) => n],
    ['Volume por treino', perSession(a), perSession(b), (n) => volume(n)],
    ['Volume total', a.summary.volume, b.summary.volume, (n) => volume(n)],
  ] : [];

  return (
    <>
      <section className="card flush card-list">
        <SelectRow label="Antes" value={aId} options={options} onChange={setA} />
        <SelectRow label="Depois" value={bId} options={options} onChange={setB} />
      </section>

      {a && b && a.id === b.id && <p className="t-14 secondary">Escolha dois treinos diferentes.</p>}
      {a && b && a.id !== b.id && (
        <>
          <section className="card flush" aria-label="Resumo dos dois treinos">
            <table className="compare-table">
              <thead><tr><th scope="col"><span className="sr-only">Medida</span></th><th scope="col">{a.name}</th><th scope="col">{b.name}</th></tr></thead>
              <tbody>
                {stats.map(([name, va, vb, f]) => (
                  <tr key={name}><th scope="row">{name}</th><td>{f(va)}</td><td>{f(vb)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="stack gap-10" aria-label="Melhor carga por exercício">
            <div className="section-head"><h2 className="title t-18">Melhor carga por exercício</h2></div>
            <section className="card flush">
              <table className="compare-table">
                <thead><tr><th scope="col">Exercício</th><th scope="col">Antes</th><th scope="col">Depois</th><th scope="col"><span className="sr-only">Diferença</span></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.slug}>
                      <th scope="row"><Link to={`?aba=exercicios&ex=${r.slug}`}>{r.name}</Link></th>
                      <td>{r.a ? kgShort(r.a.bestLoad) : '—'}</td>
                      <td>{r.b ? kgShort(r.b.bestLoad) : '—'}</td>
                      <td>{r.a && r.b ? <Delta from={r.a.bestLoad} to={r.b.bestLoad} /> : <span className="t-12 muted">{r.a ? 'só antes' : 'novo'}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <p className="t-13 muted">Cargas em kg. Exercícios com o mesmo nome são o mesmo exercício nos dois treinos.</p>
          </section>
        </>
      )}
    </>
  );
}

// ——— Evolução de um exercício ———

/** Linha da melhor carga por treino: uma série, um eixo, crosshair com tooltip ao passar o dedo/mouse. */
function LoadChart({ points }) {
  const [hover, setHover] = useState(null);
  const W = 340; const H = 180; const P = { l: 36, r: 12, t: 14, b: 26 };
  const loads = points.map((p) => p.bestLoad);
  const lo = Math.max(0, Math.floor((Math.min(...loads) * 0.9) / 5) * 5);
  const hi = Math.ceil((Math.max(...loads) * 1.05 + 1) / 5) * 5;
  const x = (i) => P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (points.length - 1));
  const y = (v) => P.t + (H - P.t - P.b) * (1 - (v - lo) / (hi - lo || 1));
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.bestLoad).toFixed(1)}`).join(' ');
  // Troca de programa: linha vertical tracejada, para ver onde um treino novo começou
  const switches = points.map((p, i) => (i && p.planId !== points[i - 1].planId ? i : null)).filter((i) => i != null);
  const hp = hover != null ? points[hover] : null;

  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    setHover(best);
  };

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="load-chart" role="img" aria-label={`Melhor carga por treino, de ${kg(loads[0])} a ${kg(loads.at(-1))}`}
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" className="chart-axis">{t}</text>
          </g>
        ))}
        {switches.map((i) => <line key={i} x1={(x(i) + x(i - 1)) / 2} x2={(x(i) + x(i - 1)) / 2} y1={P.t} y2={H - P.b} className="chart-switch" />)}
        <text x={P.l} y={H - 6} className="chart-axis">{dayMonth(points[0].date)}</text>
        {points.length > 1 && <text x={W - P.r} y={H - 6} textAnchor="end" className="chart-axis">{dayMonth(points.at(-1).date)}</text>}
        {hp && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} className="chart-cross" />}
        <path d={path} className="chart-line" />
        {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.bestLoad)} r={hover === i ? 5.5 : 4} className="chart-dot" />)}
      </svg>
      {hp && (
        <div className="chart-tip" style={{ left: `${Math.min(80, Math.max(20, (x(hover) / W) * 100))}%` }} role="status">
          <strong>{kg(hp.bestLoad)}</strong>
          <span>{shortDate(hp.date)} · {hp.planName}</span>
          <span>{setsText(hp.sets)}</span>
        </div>
      )}
    </div>
  );
}

function Exercicio({ slug }) {
  const { data, error } = useLoad(`/treinos/exercicios/${slug}`);
  if (error) return <ErrorNote error={error} />;
  if (!data) return <Skeleton height={260} />;
  const pts = data.points;
  const first = pts[0].bestLoad;
  const best = Math.max(...pts.map((p) => p.bestLoad));
  return (
    <>
      <section className="card stack gap-12" aria-label={`Evolução de ${data.name}`}>
        <div className="row between gap-12">
          <div className="stack" style={{ gap: 2 }}>
            <h2 className="title t-20">{data.name}</h2>
            <span className="t-13 secondary">Melhor carga por treino · {pts.length} {pts.length === 1 ? 'treino' : 'treinos'}</span>
          </div>
          <div className="stack" style={{ gap: 2, alignItems: 'flex-end' }}>
            <span className="num t-22">{kgShort(best)} <span className="t-13 secondary">kg</span></span>
            <Delta from={first} to={best} />
          </div>
        </div>
        <LoadChart points={pts} />
        <p className="t-12 muted">A linha tracejada marca a troca de programa.</p>
      </section>
      <section className="card flush card-list" aria-label="Todos os registros">
        {[...pts].reverse().map((p, i) => (
          <div key={i} className="list-row">
            <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
              <span className="t-15 strong">{shortDate(p.date)}</span>
              <span className="t-13 secondary ellipsis">{p.planName} · {setsText(p.sets)}</span>
            </span>
            <span className="t-14 strong" style={{ whiteSpace: 'nowrap' }}>{kg(p.bestLoad)}</span>
          </div>
        ))}
      </section>
    </>
  );
}

function Exercicios({ slug, onPick }) {
  const { data, error } = useLoad('/treinos/exercicios');
  if (error) return <ErrorNote error={error} />;
  if (!data) return <Skeleton height={200} />;
  if (!data.length) {
    return <section className="card empty"><h2 className="title t-18">Nenhuma carga registrada</h2><p className="t-14 secondary">Faça um treino para ver a evolução de cada exercício aqui.</p></section>;
  }
  const current = slug && data.some((e) => e.slug === slug) ? slug : data[0].slug;
  return (
    <>
      <section className="card flush card-list">
        <SelectRow label="Exercício" value={current} options={data.map((e) => [e.slug, e.name])} onChange={onPick} />
      </section>
      <Exercicio key={current} slug={current} />
    </>
  );
}

export default function Historico() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([t]) => t === params.get('aba')) ? params.get('aba') : 'programas';
  const { data, error, reload } = useLoad('/treinos/historico');
  const go = (next) => setParams(next, { replace: true });

  return (
    <div className="screen">
      <header className="screen-head">
        <BackButton onClick={() => (window.history.length > 1 ? window.history.back() : go({}))} />
        <h1 className="title t-20">Histórico de treinos</h1>
        <span style={{ width: 44 }} />
      </header>
      <Segmented label="Visão" className="bg-segment" value={tab} options={TABS} onChange={(t) => go(t === 'programas' ? {} : { aba: t })} />
      <ErrorNote error={error} onRetry={reload} />
      {tab === 'exercicios' ? <Exercicios slug={params.get('ex')} onPick={(s) => go({ aba: 'exercicios', ex: s })} />
        : !data ? <Skeleton height={200} />
          : tab === 'comparar' ? <Comparar plans={data} />
            : <Programas plans={data} onChange={reload} />}
    </div>
  );
}
