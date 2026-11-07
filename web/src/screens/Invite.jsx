import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Broto from '../components/Broto.jsx';
import { Avatar } from '../components/ui.jsx';
import { Logo } from '../components/Logo.jsx';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { savePendingInvite } from '../lib/invite.js';
import { APP_NAME, BRAND_LINE } from '../config.js';
import { firstName } from '../lib/format.js';
import { useStatusBar } from '../lib/statusBar.js';

export default function Invite() {
  useStatusBar('#FF5B2E'); // topo colorido: faixa do relógio na mesma cor
  const { username } = useParams();
  const { me } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [inviter, setInviter] = useState(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/auth/invite/${encodeURIComponent(username)}`).then(setInviter).catch(() => setInviter(null));
  }, [username]);

  // Guarda o convite para aceitar logo depois do login ou cadastro
  useEffect(() => { if (inviter && !me) savePendingInvite(inviter.username); }, [inviter, me]);

  async function accept() {
    setBusy(true);
    try {
      await api(`/users/${inviter.username}/invite`, { method: 'POST' });
      toast(`Agora você e ${firstName(inviter.name)} são amigos.`);
      navigate(`/u/${inviter.username}`, { replace: true });
    } catch (e) { toast(e.message); setBusy(false); }
  }

  const isSelf = me && inviter && me.username === inviter.username;
  return (
    <div className="block-brasa" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="stack center gap-16" style={{ flex: 1, justifyContent: 'flex-end', padding: 'calc(40px + env(safe-area-inset-top)) 24px 28px' }}>
        <div className="nobi-hop" style={{ animationDuration: '2.4s' }}><Broto size={140} arms="wave" title="Broto acenando" /></div>
        {inviter && (
          <div className="stack center gap-10">
            <span style={{ boxShadow: '0 0 0 4px var(--nobi-creme)', borderRadius: '50%' }}><Avatar user={inviter} size={64} /></span>
            <h1 className="display" style={{ fontSize: 'clamp(2.125rem, 9vw, 3rem)', textAlign: 'center' }}>{firstName(inviter.name)} te chamou<br />pro {APP_NAME}<span style={{ color: 'var(--nobi-creme)' }}>.</span></h1>
          </div>
        )}
        {inviter === null && <h1 className="display t-40" style={{ textAlign: 'center' }}>Convite não encontrado</h1>}
        <p className="title t-18" style={{ fontWeight: 600, textAlign: 'center' }}>{BRAND_LINE[0]} {BRAND_LINE[1]}</p>
      </div>
      <div style={{ background: 'var(--nobi-bg)', color: 'var(--nobi-text)', borderRadius: '32px 32px 0 0', padding: '24px 20px calc(28px + env(safe-area-inset-bottom))' }}>
        <div className="stack gap-12" style={{ maxWidth: 440, margin: '0 auto' }}>
          {inviter && !me && (
            <>
              <p className="t-14 secondary center">Crie sua conta e vocês já ficam amigos: um acompanha a evolução do outro.</p>
              <Link to="/entrar?modo=criar" className="btn btn-primary block">Criar conta</Link>
              <Link to="/entrar" className="btn btn-ghost block">Já tenho conta</Link>
            </>
          )}
          {inviter && me && !isSelf && (
            <button type="button" className="btn btn-primary block" disabled={busy} onClick={accept}>Aceitar e virar amigo de {firstName(inviter.name)}</button>
          )}
          {isSelf && <p className="t-14 secondary center">Este é o seu link de convite. Mande para quem você quer chamar.</p>}
          {(inviter === null || isSelf) && <Link to="/" className="btn btn-dark block">Ir para o {APP_NAME}</Link>}
          <div className="row center" style={{ justifyContent: 'center', marginTop: 4 }}><Logo size={22} /></div>
        </div>
      </div>
    </div>
  );
}
