import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isGolden, preloadBroto, stageFromLevel } from '../components/Broto.jsx';
import { api, getToken, setToken } from './api.js';
import { clearLoadCache } from './useLoad.js';
import { refreshStatusBar } from './statusBar.js';

const SessionCtx = createContext(null);

function applyPrefs(prefs) {
  const root = document.documentElement;
  const theme = prefs?.theme || 'system';
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.classList.toggle('no-mascot-motion', prefs?.mascotMotion === false);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141218' : '#F7F5F0');
  refreshStatusBar();
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
    const out = () => { clearLoadCache(); setToken(null); setMe(null); };
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
    signIn(token, user, to) { clearLoadCache(); setToken(token); setNext(to || null); setMe(user); },
    signOut() { clearLoadCache(); setToken(null); setMe(null); },
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

/**
 * Forma e cor do Broto de uma pessoa (DESIGN.md §6). Nível e sequência vêm do servidor:
 * stage sai de stageFromLevel(level) e golden de isGolden(maior sequência ativa).
 */
export function brotoOf(user) {
  // O servidor já manda golden = isGolden(maxActiveDays); ele é atualizado a cada registro.
  const golden = typeof user?.golden === 'boolean' ? user.golden : isGolden(user?.maxActiveDays || 0);
  return { stage: stageFromLevel(user?.level || 1), golden, accessory: user?.brotoAccessory || null };
}

/** Broto da pessoa logada: { stage, golden, accessory }. */
export function useBroto() {
  const { me } = useSession();
  return brotoOf(me);
}

/** Abre a tela de Conquista já com a arte do Broto comemorando carregada. */
export function useOpenAchievement() {
  const navigate = useNavigate();
  const { me } = useSession();
  return useCallback((state, options = {}) => {
    const { stage, golden } = brotoOf(me);
    preloadBroto([{ expression: 'comemorando', stage, golden: state?.celebration?.golden ?? golden }]);
    navigate('/conquista', { ...options, state });
  }, [navigate, me]);
}
