import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const SessionCtx = createContext(null);

function applyPrefs(prefs) {
  const root = document.documentElement;
  const theme = prefs?.theme || 'system';
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.classList.toggle('no-mascot-motion', prefs?.mascotMotion === false);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141218' : '#F7F5F0');
}

export function SessionProvider({ children }) {
  const [me, setMe] = useState(undefined); // undefined = carregando, null = sem sessão
  const [next, setNext] = useState(null); // para onde ir logo depois de entrar
  const [bootError, setBootError] = useState(null); // sem conexão ao abrir (a sessão continua guardada)

  const refresh = useCallback(async () => {
    if (!getToken()) return setMe(null);
    setBootError(null);
    try { setMe(await api('/me')); } catch (e) {
      if (e.status === 401) { setToken(null); setMe(null); } else setBootError(e);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const out = () => { setToken(null); setMe(null); };
    window.addEventListener('nobi:logout', out);
    return () => window.removeEventListener('nobi:logout', out);
  }, []);
  useEffect(() => {
    applyPrefs(me?.prefs);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyPrefs(me?.prefs);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [me?.prefs]);

  const value = useMemo(() => ({
    me,
    setMe,
    refresh,
    next,
    bootError,
    signIn(token, user, to) { setToken(token); setNext(to || null); setMe(user); },
    signOut() { setToken(null); setMe(null); },
    patchMe: (patch) => setMe((m) => (m ? { ...m, ...patch } : m)),
  }), [me, refresh, next, bootError]);

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export const useSession = () => useContext(SessionCtx);

/** Animações do Broto ligadas? Respeita a preferência do sistema e a opção nas Configurações. */
export function useMascotMotion() {
  const { me } = useSession();
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return !reduced && me?.prefs?.mascotMotion !== false;
}
