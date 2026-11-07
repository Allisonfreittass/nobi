import { api } from './api.js';
import { APP_NAME } from '../config.js';

const KEY = 'nobi.invite';

export const inviteUrl = (username) => `${window.location.origin}/convite/${username}`;

export function savePendingInvite(username) {
  try { localStorage.setItem(KEY, username); } catch { /* sem storage */ }
}

/** Depois de entrar, aceita o convite guardado (se houver). Retorna o convidador ou null. */
export async function acceptPendingInvite() {
  let username = null;
  try { username = localStorage.getItem(KEY); } catch { return null; }
  if (!username) return null;
  try { localStorage.removeItem(KEY); } catch { /* ok */ }
  try {
    const r = await api(`/users/${encodeURIComponent(username)}/invite`, { method: 'POST' });
    return r.self ? null : r.inviter;
  } catch { return null; }
}

/** Copia texto mesmo fora de https (onde navigator.clipboard não existe). */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* cai no plano B */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

/** Abre o compartilhar do sistema. Retorna 'shared' | 'cancelled' | 'unavailable'. */
export async function shareInvite(username) {
  const url = inviteUrl(username);
  const text = `Bora evoluir junto no ${APP_NAME}?`;
  if (!navigator.share || !window.isSecureContext) return 'unavailable';
  try {
    await navigator.share({ title: APP_NAME, text, url });
    return 'shared';
  } catch (e) {
    return e?.name === 'AbortError' ? 'cancelled' : 'unavailable';
  }
}
