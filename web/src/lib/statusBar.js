import { useEffect } from 'react';

// Cor da faixa atrás do relógio/notch (iPhone com o app instalado) e do theme-color.
// Telas com topo colorido (Login, Conquista, Desafio) avisam a cor; as demais usam o fundo do app.
const stack = [];

function apply() {
  const root = document.documentElement;
  const color = stack[stack.length - 1];
  if (color) root.style.setProperty('--nobi-statusbar', color);
  else root.style.removeProperty('--nobi-statusbar');
  const resolved = getComputedStyle(root).getPropertyValue(color ? '--nobi-statusbar' : '--nobi-bg').trim();
  if (resolved) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved);
}

/** Use em telas cujo topo não é o fundo padrão. Ex.: useStatusBar('#FF5B2E') */
export function useStatusBar(color) {
  useEffect(() => {
    if (!color) return undefined;
    stack.push(color);
    apply();
    return () => {
      const i = stack.lastIndexOf(color);
      if (i >= 0) stack.splice(i, 1);
      apply();
    };
  }, [color]);
}

/** Reaplica depois de trocar o tema (o fundo padrão muda). */
export const refreshStatusBar = apply;
