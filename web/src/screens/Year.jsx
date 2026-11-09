// "Ano no Nobi": retrospectiva do ano com card de story (como o Year in Sport do Strava).
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Broto from '../components/Broto.jsx';
import { Avatar, BackButton, ErrorNote, SelectRow, Skeleton } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useLoad, afterPost } from '../lib/useLoad.js';
import { brotoOf, useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { drawYearStory, canvasToBlob } from '../lib/storyCard.js';
import { APP_NAME } from '../config.js';
import { CATEGORIES, firstName } from '../lib/format.js';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const fmt = (n) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export default function Year() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { me } = useSession();
  const toast = useToast();
  const yParam = params.get('ano');
  const { data: y, error, reload } = useLoad(`/me/year${yParam ? `?year=${yParam}` : ''}`);
  const canvasRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(null);
  const [audience, setAudience] = useState('friends');
  const thisYear = new Date().getFullYear();

  useEffect(() => {
    if (!y?.activeDays) { setPreview(null); return undefined; }
    let alive = true;
    drawYearStory(y, me).then((c) => { if (alive) { canvasRef.current = c; setPreview(c.toDataURL('image/jpeg', 0.92)); } });
    return () => { alive = false; };
  }, [y, me]);

  const fileName = y ? `nobi-${y.year}.png` : 'nobi-ano.png';
  async function download(blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob || await canvasToBlob(canvasRef.current));
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function share() {
    setBusy('share');
    try {
      const blob = await canvasToBlob(canvasRef.current);
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `Meu ${y.year} no ${APP_NAME}`, text: `${y.activeDays} dias de evolução em ${y.year}` });
      else { await download(blob); toast('Imagem salva. Abra o Instagram e poste nos Stories.'); }
    } catch (e) { if (e?.name !== 'AbortError') toast('Não deu para compartilhar. Use Baixar imagem.'); } finally { setBusy(null); }
  }
  async function publish() {
    setBusy('post');
    try {
      const { url } = await api('/uploads', { method: 'POST', body: { purpose: 'post', data: canvasRef.current.toDataURL('image/jpeg', 0.88) } });
      await api('/posts', { method: 'POST', body: { audience, year: { year: y.year, bestStreak: y.longestRun }, photo: { url, w: 1080, h: 1920 } } });
      afterPost();
      toast(audience === 'public' ? 'Publicado para todo mundo.' : 'Publicado para seus amigos.');
      navigate('/');
    } catch (e) { toast(e.message); } finally { setBusy(null); }
  }
  const go = (delta) => setParams({ ano: String(y.year + delta) }, { replace: true });

  return (
    <div className="screen no-nav">
      <header className="screen-head"><BackButton /><h1 className="title t-20">Seu ano no {APP_NAME}</h1><span style={{ width: 44 }} /></header>
      <ErrorNote error={error} onRetry={reload} />
      {!y && !error && <Skeleton height={520} />}
      {y && (
        <>
          <div className="row between">
            <button type="button" className="icon-btn" aria-label="Ano anterior" onClick={() => go(-1)}><Icon name="back" /></button>
            <span className="stack center" style={{ gap: 0 }}>
              <span className="title t-22">{y.year}</span>
              <span className="t-12 muted">{y.complete ? 'ano completo' : 'ano em andamento'}</span>
            </span>
            <button type="button" className="icon-btn" aria-label="Próximo ano" onClick={() => go(1)} disabled={y.year >= thisYear} style={{ opacity: y.year >= thisYear ? 0.35 : 1 }}><Icon name="chevron" /></button>
          </div>
          {y.activeDays === 0 ? (
            <div className="card empty">
              <div className="broto-plate"><Broto size={96} expression="saudade" {...brotoOf(me)} title="Broto esperando o seu ano começar" /></div>
              <h2 className="title t-20">Nenhum registro em {y.year}</h2>
              <p className="secondary t-14" style={{ maxWidth: 300 }}>Todo ano começa com um dia. O próximo registro já conta.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {preview ? <img src={preview} alt={`Card do ano: ${y.activeDays} dias de evolução em ${y.year}`} style={{ width: 'min(100%, 340px)', aspectRatio: '9 / 16', borderRadius: 28, boxShadow: '0 30px 60px -30px rgba(20,18,24,0.5)' }} />
                  : <Skeleton height={560} style={{ width: 'min(100%, 340px)', borderRadius: 28 }} />}
              </div>
              <button type="button" className="btn btn-primary lg block" onClick={share} disabled={!preview || busy}><Icon name="share" size={19} /> {busy === 'share' ? 'Abrindo…' : 'Compartilhar no Instagram'}</button>
              <button type="button" className="btn btn-outline block" onClick={() => download()} disabled={!preview}><Icon name="download" size={18} /> Baixar imagem</button>
              <div className="card stack gap-12">
                <span className="strong t-15">Publicar no {APP_NAME}</span>
                <div className="row-group"><SelectRow label="Para quem" value={audience} onChange={setAudience} options={[['friends', 'Amigos'], ['public', 'Público']]} /></div>
                <button type="button" className="btn btn-dark block" onClick={publish} disabled={!preview || busy}>{busy === 'post' ? 'Publicando…' : 'Publicar no feed'}</button>
              </div>
              <section className="card stack gap-10" aria-label={`Detalhes de ${y.year}`}>
                <span className="t-15"><strong>{fmt(y.checkins)}</strong> registros em <strong>{fmt(y.activeDays)}</strong> dias</span>
                {y.longestRun > 1 && <span className="t-15">Maior sequência do ano: <strong>{y.longestRun} dias seguidos</strong></span>}
                {y.bestMonth != null && <span className="t-15">Seu melhor mês: <strong>{MONTHS[y.bestMonth]}</strong> ({y.months[y.bestMonth]} dias)</span>}
                {(y.km > 0 || y.pages > 0 || y.minutes > 0) && (
                  <span className="t-15">{[y.km > 0 && `${fmt(y.km)} km`, y.pages > 0 && `${fmt(y.pages)} páginas`, y.minutes > 0 && `${fmt(Math.round(y.minutes / 6) / 10)} h de foco`].filter(Boolean).join(' · ')}</span>
                )}
                {y.topGoals.length > 0 && (
                  <div className="stack gap-6">
                    <span className="t-14 strong">Mais presentes</span>
                    {y.topGoals.map((g) => (
                      <span key={g.title} className="row gap-8 t-14">
                        <span style={{ width: 10, height: 10, borderRadius: 4, background: CATEGORIES[g.category]?.color }} aria-hidden="true" />
                        <span className="grow">{g.title}</span><span className="secondary">{g.days} dias</span>
                      </span>
                    ))}
                  </div>
                )}
                {y.topCheer && (
                  <span className="row gap-8 t-15"><Avatar user={y.topCheer} size={28} /><span><strong>{firstName(y.topCheer.name)}</strong> foi sua maior torcida: {y.topCheer.count} “Boa!”</span></span>
                )}
                {y.achievements.length > 0 && <span className="t-15">Conquistas: <strong>{y.achievements.join(', ')}</strong></span>}
                {y.accessories.length > 0 && <span className="t-15">Acessórios do Broto: <strong>{y.accessories.map((a) => a.name).join(', ')}</strong></span>}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
