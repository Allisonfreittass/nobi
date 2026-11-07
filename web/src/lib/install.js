import { useEffect, useState } from 'react';

// O Chrome (Android) dispara este evento uma vez; guardamos para usar quando a pessoa tocar no botão.
let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; notify(); });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
}

const KEY_DISMISS = 'nobi.install.dismissedAt';
const KEY_VISITS = 'nobi.visits';
const QUIET_DAYS = 60;

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } };

// Conta visitas uma vez por carregamento do app
const visits = (() => {
  const n = Number(read(KEY_VISITS) || 0) + 1;
  write(KEY_VISITS, String(n));
  return n;
})();

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
export const isIOS = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
export const isMobile = isIOS || /android|mobile/i.test(ua);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((x) => x + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  const standalone = isStandalone();
  const canPrompt = Boolean(deferred);
  const available = !standalone && (canPrompt || isIOS);
  const dismissedAt = Number(read(KEY_DISMISS) || 0);
  const quiet = Date.now() - dismissedAt < QUIET_DAYS * 86400000;

  return {
    available,
    canPrompt,
    isIOS,
    // Cartão no Feed: celular, segunda visita em diante, e não dispensado recentemente
    showCard: available && isMobile && visits >= 2 && !quiet,
    async prompt() {
      if (!deferred) return 'unavailable';
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      notify();
      return outcome;
    },
    dismiss() { write(KEY_DISMISS, String(Date.now())); force((x) => x + 1); },
  };
}
