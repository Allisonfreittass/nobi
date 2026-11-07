import { createContext, useCallback, useContext, useState } from 'react';
import { Sheet, SelectRow, ErrorNote } from '../components/ui.jsx';
import { api } from './api.js';
import { afterPost } from './useLoad.js';
import { useToast } from './toast.jsx';
import PhotoPicker, { sendPostPhoto } from '../components/PhotoPicker.jsx';

const ShareCtx = createContext(() => {});

/**
 * Folha "Compartilhar no feed". Só abre quando a pessoa pede: nada vai para o feed sozinho (DESIGN.md §8.2).
 * payload: { checkinId?, goalId?, celebration?, title }
 */
export function ShareProvider({ children }) {
  const toast = useToast();
  const [payload, setPayload] = useState(null);
  const [audience, setAudience] = useState('friends');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [onDone, setOnDone] = useState(null);
  const [photo, setPhoto] = useState(null);

  const open = useCallback((p, done) => {
    setPayload(p);
    setText('');
    setPhoto(null);
    setError(null);
    setAudience(p.audience || 'friends');
    setOnDone(() => done || null);
  }, []);

  async function publish() {
    setBusy(true);
    try {
      const { title, audience: _a, ...body } = payload;
      const r = await api('/posts', { method: 'POST', body: { ...body, audience, text, photo: await sendPostPhoto(photo) } });
      setPayload(null);
      afterPost();
      toast(audience === 'public' ? 'Publicado para todo mundo.' : 'Publicado para seus amigos.');
      onDone?.(r.post);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ShareCtx.Provider value={open}>
      {children}
      <Sheet open={Boolean(payload)} onClose={() => setPayload(null)} title="Compartilhar no feed">
        {payload?.title && <p className="secondary t-14">{payload.title}</p>}
        <div className="row-group">
          <SelectRow label="Para quem" hint={audience === 'public' ? 'aparece no seu perfil e no Explorar' : 'só seus amigos veem e podem reagir'} value={audience} onChange={setAudience} options={[['friends', 'Amigos'], ['public', 'Público']]} />
        </div>
        <label className="field">
          Legenda (opcional)
          <textarea className="textarea" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Conte como foi" />
        </label>
        <PhotoPicker value={photo} onChange={setPhoto} />
        <ErrorNote error={error} />
        <button type="button" className="btn btn-primary block" onClick={publish} disabled={busy}>{busy ? 'Publicando…' : 'Publicar'}</button>
      </Sheet>
    </ShareCtx.Provider>
  );
}

export const useShare = () => useContext(ShareCtx);
