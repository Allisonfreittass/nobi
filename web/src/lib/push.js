import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { isIOS, isStandalone } from './install.js';

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
// No iPhone, notificações só funcionam com o app adicionado à tela de início
export const needsInstallFirst = () => isIOS && !isStandalone();

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

function keyToBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Estado e ações das notificações no celular. state: 'unsupported' | 'install' | 'denied' | 'off' | 'on' */
export function usePush() {
  const [state, setState] = useState('off');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (needsInstallFirst()) return setState('install');
    if (!pushSupported()) return setState('unsupported');
    if (Notification.permission === 'denied') return setState('denied');
    const sub = await currentSubscription();
    setState(sub && Notification.permission === 'granted' ? 'on' : 'off');
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Precisa vir de um toque (o navegador bloqueia pedido automático)
  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const { key } = await api('/push/key');
      if (!key) throw new Error('Notificações ainda não estão configuradas no servidor.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { await refresh(); return false; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(key) });
      await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
      setState('on');
      return true;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await api('/push/subscribe', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      setState('off');
    } finally {
      setBusy(false);
    }
  }, []);

  const test = useCallback(() => api('/push/test', { method: 'POST' }), []);
  return { state, busy, enable, disable, test, refresh };
}
