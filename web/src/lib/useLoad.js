import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

// Memória das telas: mostra na hora o que já foi carregado e atualiza por trás.
// Fica só na memória da aba (some ao fechar) e é limpa ao entrar ou sair da conta.
const cache = new Map();
export const clearLoadCache = () => cache.clear();

/** Carrega um endpoint e expõe { data, error, loading, reload, setData }. */
export function useLoad(path, { skip = false } = {}) {
  const [data, setDataState] = useState(() => (path ? cache.get(path) ?? null : null));
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!skip && !(path && cache.has(path)));
  const alive = useRef(true);
  const setData = useCallback((v) => {
    setDataState((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      if (path) cache.set(path, next);
      return next;
    });
  }, [path]);
  const reload = useCallback(async () => {
    if (!path || skip) return;
    if (!cache.has(path)) setLoading(true);
    setError(null);
    try {
      const d = await api(path);
      cache.set(path, d);
      if (alive.current) setDataState(d);
    } catch (e) {
      if (alive.current && !cache.has(path)) setError(e);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [path, skip]);
  useEffect(() => {
    alive.current = true;
    reload();
    return () => { alive.current = false; };
  }, [reload]);
  return { data, error, loading, reload, setData };
}

export function useMedia(query) {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches;
  const [match, setMatch] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

export const useDesktop = () => useMedia('(min-width: 1024px)');
