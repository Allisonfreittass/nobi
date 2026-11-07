import { useState } from 'react';
import Icon from './Icon.jsx';
import { Sheet } from './ui.jsx';
import { copyText, inviteUrl } from '../lib/invite.js';

/** Plano B do convite: mostra o link para copiar quando o compartilhar do sistema não existe. */
export default function InviteSheet({ open, onClose, username }) {
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(username);
  async function copy() {
    setCopied(await copyText(url));
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Sheet open={open} onClose={onClose} title="Convidar amigos">
      <p className="t-14 secondary">Mande este link. Quando a pessoa entrar ou criar conta por ele, vocês já ficam amigos.</p>
      <label className="field">
        <span className="sr-only">Link do convite</span>
        <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} style={{ fontSize: 'var(--nobi-text-md)' }} />
      </label>
      <button type="button" className="btn btn-primary block" onClick={copy}>
        <Icon name={copied ? 'check' : 'share'} size={18} /> {copied ? 'Link copiado' : 'Copiar link'}
      </button>
      <a className="btn btn-outline block" href={`https://wa.me/?text=${encodeURIComponent(`Bora evoluir junto? ${url}`)}`} target="_blank" rel="noreferrer">Enviar pelo WhatsApp</a>
    </Sheet>
  );
}
