/**
 * Faixa sólida atrás do relógio e do notch. Com viewport-fit=cover o conteúdo rola por baixo da
 * barra de status do iPhone e se mistura com ela; a faixa esconde esse conteúdo. Fora do iPhone
 * (ou sem notch) a altura é zero.
 */
export default function StatusBarShield() {
  return <div className="statusbar-shield" aria-hidden="true" />;
}
