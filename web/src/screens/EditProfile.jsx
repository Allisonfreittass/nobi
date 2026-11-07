import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Avatar, BackButton, Chip, ErrorNote, Segmented } from '../components/ui.jsx';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { api } from '../lib/api.js';

const INTERESTS = ['Leitura', 'Corrida', 'Inglês', 'Projeto pessoal', 'Musculação', 'Meditação', 'Carreira', 'Hábitos', 'Estudos', 'Escrita', 'Música', 'Alimentação'];

/** Reduz a foto para 256 px no próprio aparelho antes de enviar. */
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      resolve(c.toDataURL('image/jpeg', 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Não deu para abrir essa imagem.'));
    img.src = URL.createObjectURL(file);
  });
}

export default function EditProfile() {
  const { me, setMe } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef(null);
  const [form, setForm] = useState({ name: me.name, username: me.username, bio: me.bio, interests: me.interests, avatarUrl: me.avatarUrl, stats: me.privacy.stats });
  const [check, setCheck] = useState({ state: 'ok' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const u = form.username.toLowerCase();
    if (u === me.username) return setCheck({ state: 'ok' });
    if (!/^[a-z0-9_.]{3,24}$/.test(u)) return setCheck({ state: 'err', msg: 'Use de 3 a 24 letras, números, ponto ou _.' });
    setCheck({ state: 'checking' });
    const t = setTimeout(async () => {
      try {
        const r = await api(`/users/check-username?u=${encodeURIComponent(u)}`);
        setCheck(r.available ? { state: 'ok', msg: 'Disponível' } : { state: 'err', msg: 'Esse @ já está em uso.' });
      } catch { setCheck({ state: 'ok' }); }
    }, 350);
    return () => clearTimeout(t);
  }, [form.username, me.username]);

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try { set('avatarUrl', await resizeImage(f)); } catch (err) { toast(err.message); }
    e.target.value = '';
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const { stats, ...rest } = form;
      const updated = await api('/me', { method: 'PATCH', body: { ...rest, privacy: { stats } } });
      setMe(updated);
      toast('Perfil atualizado.');
      navigate('/perfil', { replace: true });
    } catch (e) { setError(e); setBusy(false); }
  }

  const all = [...new Set([...INTERESTS, ...form.interests])];
  const preview = { ...me, name: form.name || me.name, avatarUrl: form.avatarUrl };

  return (
    <div className="screen no-nav">
      <header className="screen-head">
        <BackButton />
        <h1 className="title t-20">Editar perfil</h1>
        <button type="button" className="btn btn-primary sm" style={{ height: 44 }} onClick={save} disabled={busy || check.state !== 'ok' || !form.name.trim()}>Salvar</button>
      </header>

      <section className="stack center gap-10">
        <span style={{ width: 96, height: 96, borderRadius: 32, overflow: 'hidden', display: 'inline-flex' }}><Avatar user={preview} size={96} className="profile-avatar" /></span>
        <span className="t-13 muted">Foto ou avatar do Broto</span>
        <div className="row gap-8 wrap" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn-outline sm" onClick={() => fileRef.current?.click()}><Icon name="camera" size={17} /> Foto</button>
          <button type="button" className="btn btn-outline sm" aria-pressed={form.avatarUrl === 'broto'} onClick={() => set('avatarUrl', 'broto')}>Avatar do Broto</button>
          {form.avatarUrl && <button type="button" className="btn btn-ghost sm" onClick={() => set('avatarUrl', '')}>Usar inicial</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} aria-label="Escolher foto" />
      </section>

      <label className="field">Nome<input className="input" value={form.name} maxLength={60} onChange={(e) => set('name', e.target.value)} autoComplete="name" /></label>
      <div className="field">
        <label htmlFor="username">Nome de usuário</label>
        <div className="input-prefix"><span aria-hidden="true">@</span>
          <input id="username" className="input" value={form.username} maxLength={24} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))} aria-describedby="username-hint" />
        </div>
        <span id="username-hint" className={`field-hint ${check.state === 'err' ? 'err' : check.msg ? 'ok' : ''}`} aria-live="polite">
          {check.state === 'checking' ? 'Verificando…' : check.msg || ' '}
        </span>
      </div>
      <div className="field">
        <div className="row between"><label htmlFor="bio">Bio</label><span className="field-hint">{form.bio.length}/120</span></div>
        <textarea id="bio" className="textarea" rows={3} maxLength={120} value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder="Lendo mais, correndo melhor e terminando o app." />
      </div>

      <section className="stack gap-10">
        <div className="stack"><h2 className="t-15 strong">Interesses</h2><span className="t-13 muted">aparecem no perfil e ajudam a achar desafios</span></div>
        <div className="row gap-8 wrap">
          {all.map((i) => {
            const on = form.interests.includes(i);
            return <Chip key={i} on={on} onClick={() => set('interests', on ? form.interests.filter((x) => x !== i) : [...form.interests, i])}>{i}</Chip>;
          })}
        </div>
      </section>

      <section className="card stack gap-12">
        <div className="row between gap-12">
          <div className="stack"><span className="strong t-15">Estatísticas no perfil</span><span className="t-13 muted">sequência, consistência e mapa do mês</span></div>
          <Segmented compact label="Quem vê as estatísticas" options={[['friends', 'Amigos'], ['public', 'Público']]} value={form.stats} onChange={(v) => set('stats', v)} />
        </div>
      </section>
      <ErrorNote error={error} />
      <Link to="/configuracoes" className="btn btn-ghost">Mais em Configurações <Icon name="chevron" size={18} /></Link>
    </div>
  );
}
