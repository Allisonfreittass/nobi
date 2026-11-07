import { api } from './api.js';

/**
 * Reduz a foto no próprio aparelho antes de enviar (menos dados no 4G, upload rápido).
 * square: recorta no centro (foto de perfil). Retorna { dataUrl, w, h }.
 */
export function resizeImage(file, { maxSide = 1440, square = false, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let sx = 0; let sy = 0; let sw = img.naturalWidth; let sh = img.naturalHeight;
      if (square) {
        const s = Math.min(sw, sh);
        sx = (sw - s) / 2; sy = (sh - s) / 2; sw = s; sh = s;
      }
      const scale = Math.min(1, maxSide / Math.max(sw, sh));
      const w = Math.round(sw * scale);
      const h = Math.round(sh * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#FFFFFF'; // PNG transparente não vira preto no JPEG
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      resolve({ dataUrl: c.toDataURL('image/jpeg', quality), w, h });
    };
    img.onerror = () => reject(new Error('Não deu para abrir essa imagem.'));
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadImage(file, purpose) {
  const opts = purpose === 'avatar' ? { maxSide: 256, square: true, quality: 0.85 } : { maxSide: 1440 };
  const { dataUrl, w, h } = await resizeImage(file, opts);
  const { url } = await api('/uploads', { method: 'POST', body: { purpose, data: dataUrl } });
  return { url, w, h, preview: dataUrl };
}
