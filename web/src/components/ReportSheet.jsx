import { useState } from 'react';
import { ErrorNote, Sheet } from './ui.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';

const REASONS = [
  ['spam', 'Spam ou propaganda'],
  ['assedio', 'Assédio ou ataque'],
  ['improprio', 'Conteúdo impróprio'],
  ['falso', 'Perfil ou registro falso'],
  ['outro', 'Outro motivo'],
];
const WHAT = { post: 'este post', user: 'esta conta', comment: 'este comentário', club: 'este clube' };

/** Denunciar post, pessoa, comentário ou clube. Quem denunciou não é revelado. */
export default function ReportSheet({ open, onClose, targetType, targetId, clubSlug, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const close = () => { setReason(null); setDetails(''); setError(null); onClose(); };

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await api('/reports', { method: 'POST', body: { targetType, targetId, clubSlug, reason, details } });
      toast('Denúncia enviada. Obrigado por cuidar da comunidade.');
      onDone?.();
      close();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onClose={close} title={`Denunciar ${WHAT[targetType] || ''}`}>
      <p className="t-14 secondary">A moderação {clubSlug ? 'do clube ' : ''}vê a denúncia. A pessoa não fica sabendo quem denunciou.</p>
      <div className="card flush card-list" role="radiogroup" aria-label="Motivo">
        {REASONS.map(([v, label]) => (
          <label key={v} className="list-row" style={{ cursor: 'pointer', minHeight: 52 }}>
            <input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} style={{ width: 20, height: 20, accentColor: 'var(--nobi-tinta)' }} />
            <span className="t-15 strong grow">{label}</span>
          </label>
        ))}
      </div>
      <label className="field">Detalhes (opcional)
        <textarea className="textarea" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Conte o que aconteceu" />
      </label>
      <ErrorNote error={error} />
      <button type="button" className="btn btn-dark block" disabled={!reason || busy} onClick={send}>{busy ? 'Enviando…' : 'Enviar denúncia'}</button>
    </Sheet>
  );
}
