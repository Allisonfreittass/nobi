import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Broto from '../components/Broto.jsx';
import { BackButton, ErrorNote, SelectRow, Skeleton } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useLoad, afterPost } from '../lib/useLoad.js';
import { brotoOf, useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { drawWeeklyStory, canvasToBlob } from '../lib/storyCard.js';
import { APP_NAME } from '../config.js';

const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export default function Weekly() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { me } = useSession();
  const toast = useToast();
  const start = params.get('inicio');
  const { data: s, error, reload } = useLoad(`/me/weekly${start ? `?start=${start}` : ''}`);
  const latest = useLoad('/me/weekly');
  const canvasRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(null);
  const [audience, setAudience] = useState('friends');

  useEffect(() => {
    if (!s || !s.activeDays) { setPreview(null); return; }
    let alive = true;
    drawWeeklyStory(s, me).then((c) => {
      if (!alive) return;
      canvasRef.current = c;
      setPreview(c.toDataURL('image/jpeg', 0.92));
    });
    return () => { alive = false; };
  }, [s, me]);

  const fileName = s ? `nobi-semana-${s.start}.png` : 'nobi-semana.png';
  async function download(blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob || await canvasToBlob(canvasRef.current));
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // Compartilhar abre a folha do celular com a imagem: o Instagram aparece e oferece Story
  async function share() {
    setBusy('share');
    try {
      const blob = await canvasToBlob(canvasRef.current);
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Minha semana no ${APP_NAME}`, text: `${s.activeDays} de 7 dias ativos no ${APP_NAME}` });
      } else {
        await download(blob);
        toast('Imagem salva. Abra o Instagram e poste nos Stories.');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') toast('Não deu para compartilhar. Use Baixar imagem.');
    } finally { setBusy(null); }
  }

  async function publish() {
    setBusy('post');
    try {
      const { url } = await api('/uploads', { method: 'POST', body: { purpose: 'post', data: canvasRef.current.toDataURL('image/jpeg', 0.88) } });
      await api('/posts', { method: 'POST', body: { audience, weekly: { label: s.label, bestStreak: s.bestStreak }, photo: { url, w: 1080, h: 1920 } } });
      afterPost();
      toast(audience === 'public' ? 'Publicado para todo mundo.' : 'Publicado para seus amigos.');
      navigate('/');
    } catch (e) { toast(e.message); } finally { setBusy(null); }
  }

  const isLatest = !s || !latest.data || s.start >= latest.data.start;
  const go = (delta) => setParams(delta ? { inicio: addDays(s.start, delta * 7) } : {}, { replace: true });

  return (
    <div className="screen no-nav">
      <header className="screen-head">
        <BackButton />
        <h1 className="title t-20">Resumo da semana</h1>
        <span style={{ width: 44 }} />
      </header>
      <ErrorNote error={error} onRetry={reload} />
      {!s && !error && <Skeleton height={520} />}
      {s && (
        <>
          <div className="row between">
            <button type="button" className="icon-btn" aria-label="Semana anterior" onClick={() => go(-1)}><Icon name="back" /></button>
            <span className="stack center" style={{ gap: 0 }}>
              <span className="title t-18">{s.label}</span>
              <span className="t-12 muted">{s.complete ? 'semana completa' : 'semana em andamento'}</span>
            </span>
            <button type="button" className="icon-btn" aria-label="Próxima semana" onClick={() => go(1)} disabled={isLatest} style={{ opacity: isLatest ? 0.35 : 1 }}><Icon name="chevron" /></button>
          </div>

          {s.activeDays === 0 ? (
            <div className="card empty">
              <div className="broto-plate"><Broto size={96} expression="saudade" stage={brotoOf(me).stage} title="Broto com saudade, guardando o seu lugar" /></div>
              <h2 className="title t-20">Nenhum registro nesta semana</h2>
              <p className="secondary t-14" style={{ maxWidth: 300 }}>Sem problema. O Broto guarda o lugar, e a próxima semana pode render um belo story.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {preview ? (
                  <img src={preview} alt={`Card da semana: ${s.activeDays} de 7 dias ativos`} style={{ width: 'min(100%, 340px)', aspectRatio: '9 / 16', borderRadius: 28, boxShadow: '0 30px 60px -30px rgba(20,18,24,0.5)' }} />
                ) : <Skeleton height={560} style={{ width: 'min(100%, 340px)', borderRadius: 28 }} />}
              </div>
              <button type="button" className="btn btn-primary lg block" onClick={share} disabled={!preview || busy}>
                <Icon name="share" size={19} /> {busy === 'share' ? 'Abrindo…' : 'Compartilhar no Instagram'}
              </button>
              <p className="t-13 muted center" style={{ marginTop: -6 }}>Abre o compartilhar do celular. Escolha Instagram e depois Story.</p>
              <div className="row gap-8">
                <button type="button" className="btn btn-outline grow" onClick={() => download()} disabled={!preview}><Icon name="download" size={18} /> Baixar imagem</button>
              </div>
              <div className="card stack gap-12">
                <span className="strong t-15">Publicar no {APP_NAME}</span>
                <div className="row-group">
                  <SelectRow label="Para quem" value={audience} onChange={setAudience} options={[['friends', 'Amigos'], ['public', 'Público']]} />
                </div>
                <button type="button" className="btn btn-dark block" onClick={publish} disabled={!preview || busy}>{busy === 'post' ? 'Publicando…' : 'Publicar no feed'}</button>
              </div>
              <section className="card stack gap-8" aria-label="Detalhes da semana">
                <span className="t-15"><strong>{s.checkins}</strong> {s.checkins === 1 ? 'registro' : 'registros'} em <strong>{s.activeDays}</strong> {s.activeDays === 1 ? 'dia' : 'dias'}</span>
                {s.topGoal && <span className="t-15">Mais presente: <strong>{s.topGoal.title}</strong> ({s.topGoal.days} {s.topGoal.days === 1 ? 'dia' : 'dias'})</span>}
                {s.bestStreak > 1 && <span className="t-15">Maior sequência: <strong>{s.bestStreak} dias</strong>{s.bestStreakGoal ? ` em ${s.bestStreakGoal}` : ''}</span>}
                {s.xp > 0 && <span className="t-15">XP ganho: <strong>+{s.xp}</strong></span>}
                {s.achievements.length > 0 && <span className="t-15">Conquistas: <strong>{s.achievements.join(', ')}</strong></span>}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
