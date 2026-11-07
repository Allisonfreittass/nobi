import { useState } from 'react';
import Icon from './Icon.jsx';
import { Sheet } from './ui.jsx';
import { AppIcon } from './Logo.jsx';
import { useInstall } from '../lib/install.js';
import { APP_NAME } from '../config.js';

export function IOSInstructions({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="Adicionar à Tela de Início">
      <ol className="stack gap-14" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
        {[
          <>Toque em <strong>Compartilhar</strong> <Icon name="share" size={17} style={{ verticalAlign: '-3px' }} /> na barra do Safari.</>,
          <>Role e toque em <strong>Adicionar à Tela de Início</strong>.</>,
          <>Toque em <strong>Adicionar</strong>. O {APP_NAME} abre em tela cheia, como um app.</>,
        ].map((t, i) => (
          <li key={i} className="row gap-12" style={{ alignItems: 'flex-start' }}>
            <span className="num t-16" style={{ width: 28, height: 28, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--nobi-track)' }}>{i + 1}</span>
            <span className="t-15" style={{ paddingTop: 3 }}>{t}</span>
          </li>
        ))}
      </ol>
      <p className="t-13 muted">No iPhone, isso funciona pelo Safari.</p>
      <button type="button" className="btn btn-dark block" onClick={onClose}>Entendi</button>
    </Sheet>
  );
}

/** Hook para disparar a instalação (Android) ou abrir o passo a passo (iPhone). */
export function useInstallAction() {
  const install = useInstall();
  const [ios, setIos] = useState(false);
  const run = async () => {
    if (install.canPrompt) return install.prompt();
    if (install.isIOS) setIos(true);
    return null;
  };
  return { install, run, sheet: <IOSInstructions open={ios} onClose={() => setIos(false)} /> };
}

/** Cartão discreto no Feed. Aparece no máximo a partir da 2ª visita e some por 60 dias se fechar. */
export default function InstallCard() {
  const { install, run, sheet } = useInstallAction();
  if (!install.showCard) return null;
  return (
    <section className="card row gap-12" aria-label={`Instalar o ${APP_NAME}`} style={{ padding: '12px 8px 12px 14px' }}>
      <AppIcon size={40} />
      <div className="grow stack" style={{ gap: 1 }}>
        <span className="strong t-15">Instalar o {APP_NAME}</span>
        <span className="t-13 muted">Na tela de início, como app.</span>
      </div>
      <button type="button" className="btn btn-dark sm" onClick={run}>Adicionar</button>
      <button type="button" className="icon-btn plain" aria-label="Agora não" onClick={install.dismiss}><Icon name="close" size={18} /></button>
      {sheet}
    </section>
  );
}
