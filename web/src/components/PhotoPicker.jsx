import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { resizeImage } from '../lib/image.js';

/**
 * Escolher uma foto para o post. Guarda o arquivo já reduzido; o envio acontece só ao publicar.
 * value: { dataUrl, w, h } | null
 */
export default function PhotoPicker({ value, onChange }) {
  const ref = useRef(null);
  const [error, setError] = useState(null);
  async function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError(null);
    try { onChange(await resizeImage(f, { maxSide: 1440 })); } catch (err) { setError(err.message); }
  }
  return (
    <div className="stack gap-8">
      {value ? (
        <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
          <img src={value.dataUrl} alt="Foto escolhida" style={{ width: 112, height: 112, objectFit: 'cover', borderRadius: 18 }} />
          <button type="button" className="icon-btn" aria-label="Remover foto" onClick={() => onChange(null)} style={{ position: 'absolute', top: -10, right: -10, width: 36, height: 36 }}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-outline sm" style={{ alignSelf: 'flex-start' }} onClick={() => ref.current?.click()}>
          <Icon name="camera" size={18} /> Adicionar foto
        </button>
      )}
      {error && <span className="field-hint err">{error}</span>}
      <input ref={ref} type="file" accept="image/*" hidden onChange={pick} aria-label="Escolher foto" />
    </div>
  );
}

/** Envia a foto escolhida e devolve o objeto que o post espera. */
export async function sendPostPhoto(value) {
  if (!value) return undefined;
  const { api } = await import('../lib/api.js');
  const { url } = await api('/uploads', { method: 'POST', body: { purpose: 'post', data: value.dataUrl } });
  return { url, w: value.w, h: value.h };
}
