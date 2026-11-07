// Guarda imagens fora do banco. Produção: Vercel Blob (precisa de BLOB_READ_WRITE_TOKEN).
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

export const storageReady = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN) || !config.isProd;

/** Salva e devolve a URL pública. folder: 'avatars' | 'posts'. */
export async function saveImage({ buffer, contentType }, folder, userId) {
  const name = `${folder}/${userId}/${crypto.randomUUID()}.${EXT[contentType]}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const blob = await put(name, buffer, { access: 'public', contentType, addRandomSuffix: false, cacheControlMaxAge: 31536000 });
    return blob.url;
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
  return /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/(avatars|posts)\/[a-f0-9]{24}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(u);
}
