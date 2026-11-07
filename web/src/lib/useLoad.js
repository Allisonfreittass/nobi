import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

// Memória das telas: mostra na hora o que já foi carregado e atualiza por trás.
// Fica só na memória da aba (some ao fechar) e é limpa ao entrar ou sair da conta.
const cache = new Map();
export const clearLoadCache = () => cache.clear();
const subscribers = new Map(); // path -> Set(setState) para atualizar telas abertas

/** Esquece telas que mudaram, para a próxima abertura buscar de novo. */
export function invalidateLoad(...paths) {
  for (const p of paths) cache.delete(p);
}

/** Depois de um registro: troca o objetivo na lista e marca as telas que dependem dele. */
export function afterCheckin(goal) {
  if (goal && cache.has('/goals')) {
    const next = cache.get('/goals').map((g) => (g.id === goal.id ? goal : g));
    cache.set('/goals', next);
    subscribers.get('/goals')?.forEach((fn) => fn(next));
  }
  // Metas › Hoje: troca o hábito na Rotina das telas abertas
  const hojeKey = '/metas?view=hoje';
  if (goal && cache.has(hojeKey)) {
    const d = cache.get(hojeKey);
    const next = { ...d, routine: d.routine.map((g) => (g.id === goal.id ? goal : g)) };
    cache.set(hojeKey, next);
    subscribers.get(hojeKey)?.forEach((fn) => fn(next));
  }
  invalidateLoad('/home', '/me/stats', `/goals/${goal?.id}`, '/metas?view=semana', '/metas?view=mes', '/metas?view=concluidas');
}

/** Depois de publicar: o Feed e o perfil precisam buscar de novo. */
export function afterPost() {
  for (const key of [...cache.keys()]) if (key.startsWith('/feed') || key.startsWith('/users/')) cache.delete(key);
}

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
    if (!path) return () => { alive.current = false; };
    if (!subscribers.has(path)) subscribers.set(path, new Set());
    subscribers.get(path).add(setDataState);
    return () => { alive.current = false; subscribers.get(path)?.delete(setDataState); };
  }, [reload, path]);
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
