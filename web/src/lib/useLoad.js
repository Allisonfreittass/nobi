import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/** Carrega um endpoint e expõe { data, error, loading, reload, setData }. */
export function useLoad(path, { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const alive = useRef(true);
  const reload = useCallback(async () => {
    if (!path || skip) return;
    setLoading(true);
    setError(null);
    try {
      const d = await api(path);
      if (alive.current) setData(d);
    } catch (e) {
      if (alive.current) setError(e);
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
