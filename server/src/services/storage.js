// Guarda imagens fora do banco. Produção: Vercel Blob, com BLOB_STORE_ID (autenticação OIDC
// automática da Vercel, padrão dos Blobs novos) ou BLOB_READ_WRITE_TOKEN (Blobs antigos).
// Desenvolvimento sem token: grava em server/.uploads e serve em /api/uploads.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { HttpError } from '../lib/http.js';

export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.uploads');
const MAX_BYTES = 3 * 1024 * 1024;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Confere os primeiros bytes: só aceita JPEG, PNG ou WebP de verdade, não importa o que o cliente diga. */
function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function decodeDataUrl(dataUrl) {
  const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new HttpError(400, 'Imagem inválida.');
  const buffer = Buffer.from(m[1], 'base64');
  if (buffer.length > MAX_BYTES) throw new HttpError(413, 'Imagem grande demais.');
  const contentType = sniff(buffer);
  if (!contentType) throw new HttpError(400, 'Use uma foto JPG, PNG ou WebP.');
  return { buffer, contentType };
}

const blobConfigured = () => Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
export const storageReady = () => blobConfigured() || !config.isProd;

/** Salva e devolve a URL pública. folder: 'avatars' | 'posts'. */
export async function saveImage({ buffer, contentType }, folder, userId) {
  const name = `${folder}/${userId}/${crypto.randomUUID()}.${EXT[contentType]}`;
  if (blobConfigured()) {
    const { put } = await import('@vercel/blob');
    try {
      const blob = await put(name, buffer, { access: 'public', contentType, addRandomSuffix: false, cacheControlMaxAge: 31536000 });
      return blob.url;
    } catch (e) {
      console.error('[blob]', e.message);
      throw new HttpError(503, 'Não deu para guardar a foto agora. Tente de novo.');
    }
  }
  if (config.isProd) throw new HttpError(503, 'Envio de fotos ainda não está configurado.');
  const file = path.join(UPLOAD_DIR, name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buffer);
  return `/api/uploads/${name}`;
}

/** Só aceitamos referências a imagens que nós mesmos guardamos. */
export function isOurImage(url) {
  const u = String(url || '');
  if (/^\/api\/uploads\/(avatars|posts)\/[a-f0-9]{24}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(u)) return true;
  return /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/(avatars|posts)\/[a-f0-9]{24}\/[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(u);
}

const pathFromUrl = (url) => {
  const u = String(url);
  if (u.startsWith('/api/uploads/')) return u.slice('/api/uploads/'.length);
  try { return decodeURIComponent(new URL(u).pathname.slice(1)); } catch { return null; }
};

/** Apaga fotos nossas (troca de foto de perfil, post apagado). Falha não interrompe a ação principal. */
export async function deleteImages(urls) {
  const ours = urls.filter(isOurImage);
  if (!ours.length) return;
  try {
    if (blobConfigured()) {
      const { del } = await import('@vercel/blob');
      await del(ours);
    } else {
      await Promise.all(ours.map((u) => fs.rm(path.join(UPLOAD_DIR, pathFromUrl(u)), { force: true })));
    }
  } catch (e) {
    console.error('[blob] não apagou:', e.message);
  }
}

/** Apaga todas as fotos de um usuário (exclusão de conta), inclusive envios que nunca foram usados. */
export async function deleteUserImages(userId) {
  const prefixes = [`avatars/${userId}/`, `posts/${userId}/`];
  if (blobConfigured()) {
    const { list, del } = await import('@vercel/blob');
    for (const prefix of prefixes) {
      let cursor;
      do {
        const page = await list({ prefix, cursor, limit: 1000 });
        if (page.blobs.length) await del(page.blobs.map((b) => b.url));
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
    }
    return;
  }
  await Promise.all(prefixes.map((p) => fs.rm(path.join(UPLOAD_DIR, p), { recursive: true, force: true })));
}
