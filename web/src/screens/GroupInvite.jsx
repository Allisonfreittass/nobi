// Link de convite de grupo privado (/grupo/:code): prévia e "Entrar no grupo".
// Ninguém entra sem tocar no botão; sem conta, o convite fica guardado até o cadastro.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Broto from '../components/Broto.jsx';
import Icon from '../components/Icon.jsx';
import { Logo } from '../components/Logo.jsx';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { invalidateLoad } from '../lib/useLoad.js';
import { savePendingGroupInvite } from '../lib/invite.js';
import { APP_NAME } from '../config.js';
import { CATEGORIES } from '../lib/format.js';
import { useStatusBar } from '../lib/statusBar.js';

export default function GroupInvite() {
  useStatusBar('#FF5B2E');
  const { code } = useParams();
  const { me } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [group, setGroup] = useState(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/auth/group-invite/${encodeURIComponent(code)}`).then(setGroup).catch(() => setGroup(null));
  }, [code]);

  // Sem conta: guarda só quando a pessoa escolhe seguir, e entra no grupo logo depois do cadastro ou login
  const keep = () => savePendingGroupInvite(code);

  async function join() {
    setBusy(true);
    try {
      const c = await api(`/clubs/link/${encodeURIComponent(code)}/join`, { method: 'POST' });
      invalidateLoad('/community');
      toast(c.already ? 'Você já está nesse grupo.' : `Você entrou em ${c.name}.`);
      navigate(`/clubes/${c.slug}`, { replace: true });
    } catch (e) { toast(e.message); setBusy(false); }
  }

  const cat = group && CATEGORIES[group.category];
  return (
    <div className="block-brasa" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="stack center gap-16" style={{ flex: 1, justifyContent: 'flex-end', padding: 'calc(40px + env(safe-area-inset-top)) 24px 28px' }}>
        <div className="nobi-hop" style={{ animationDuration: '2.4s' }}><span className="broto-plate round"><Broto size={140} expression="padrao" /></span></div>
        {group && (
          <div className="stack center gap-10">
            <span className="t-14 strong row gap-6" style={{ justifyContent: 'center' }}><Icon name={cat?.icon || 'users'} size={16} />Grupo privado · {cat?.label}</span>
            <h1 className="display" style={{ fontSize: 'clamp(2.125rem, 9vw, 3rem)', textAlign: 'center' }}>Te chamaram para<br />{group.name}<span style={{ color: 'var(--nobi-creme)' }}>.</span></h1>
            <span className="t-15">{group.membersCount} {group.membersCount === 1 ? 'pessoa' : 'pessoas'} no grupo</span>
          </div>
        )}
        {group === null && <h1 className="display t-40" style={{ textAlign: 'center' }}>Convite não vale mais</h1>}
      </div>
      <div style={{ background: 'var(--nobi-bg)', color: 'var(--nobi-text)', borderRadius: '32px 32px 0 0', padding: '24px 20px calc(28px + env(safe-area-inset-bottom))' }}>
        <div className="stack gap-12" style={{ maxWidth: 440, margin: '0 auto' }}>
          {group && !me && (
            <>
              <p className="t-14 secondary center">Crie sua conta ou entre para participar do grupo: feed, ranking da semana e desafios só de vocês.</p>
              <Link to="/entrar?modo=criar" className="btn btn-primary block" onClick={keep}>Criar conta</Link>
              <Link to="/entrar" className="btn btn-ghost block" onClick={keep}>Já tenho conta</Link>
            </>
          )}
          {group && me && (
            <>
              <button type="button" className="btn btn-primary block" disabled={busy} onClick={join}>{busy ? 'Entrando…' : 'Entrar no grupo'}</button>
              <Link to="/" className="btn btn-ghost block">Agora não</Link>
            </>
          )}
          {group === null && (
            <>
              <p className="t-14 secondary center">O link pode ter sido trocado por alguém do grupo. Peça um novo.</p>
              <Link to="/" className="btn btn-dark block">Ir para o {APP_NAME}</Link>
            </>
          )}
          <div className="row center" style={{ justifyContent: 'center', marginTop: 4 }}><Logo size={22} /></div>
        </div>
      </div>
    </div>
  );
}
