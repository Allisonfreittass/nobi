import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Avatar, BackButton, ErrorNote, Segmented, Sheet, Toggle } from '../components/ui.jsx';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { useLoad } from '../lib/useLoad.js';
import { api } from '../lib/api.js';
import { APP_NAME, APP_VERSION } from '../config.js';
import { useInstallAction } from '../components/InstallPrompt.jsx';
import InviteSheet from '../components/InviteSheet.jsx';
import { shareInvite } from '../lib/invite.js';

function Group({ title, children }) {
  return (
    <section className="stack gap-8">
      <h2 className="label-caps t-12 muted" style={{ padding: '0 4px' }}>{title}</h2>
      <div className="card flush card-list">{children}</div>
    </section>
  );
}

function Row({ label, desc, children, as: As = 'div', ...rest }) {
  return (
    <As className="list-row" {...rest}>
      <div className="grow stack" style={{ gap: 1 }}>
        <span className="t-15 strong">{label}</span>
        {desc && <span className="t-13 muted">{desc}</span>}
      </div>
      {children}
    </As>
  );
}

function AccountSheet({ open, onClose }) {
  const { me, setMe } = useSession();
  const toast = useToast();
  const [f, setF] = useState({ email: me.email || '', currentPassword: '', newPassword: '' });
  const [error, setError] = useState(null);
  async function save(e) {
    e.preventDefault();
    try {
      const body = { email: f.email, currentPassword: f.currentPassword };
      if (f.newPassword) body.newPassword = f.newPassword;
      setMe(await api('/me/account', { method: 'PATCH', body }));
      toast('Conta atualizada.');
      onClose();
    } catch (err) { setError(err); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="E-mail e senha">
      <form className="stack gap-12" onSubmit={save}>
        <label className="field">E-mail<input className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        {me.hasPassword && <label className="field">Senha atual<input className="input" type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} /></label>}
        <label className="field">{me.hasPassword ? 'Nova senha (opcional)' : 'Criar senha'}<input className="input" type="password" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} /></label>
        <ErrorNote error={error} />
        <button type="submit" className="btn btn-primary block">Salvar</button>
      </form>
    </Sheet>
  );
}

function DeleteSheet({ open, onClose }) {
  const { me, signOut } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  async function remove(e) {
    e.preventDefault();
    try {
      await api('/me', { method: 'DELETE', body: { password } });
      signOut();
      navigate('/entrar', { replace: true });
    } catch (err) { setError(err); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Excluir conta">
      <form className="stack gap-12" onSubmit={remove}>
        <p className="t-14 secondary">Isso apaga seu perfil, objetivos, registros, posts e comentários. Não dá para desfazer. Se quiser guardar uma cópia, exporte seus dados antes.</p>
        {me.hasPassword && <label className="field">Sua senha<input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
        <label className="field">Digite EXCLUIR para confirmar<input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="characters" /></label>
        <ErrorNote error={error} />
        <button type="submit" className="btn btn-dark block" style={{ background: 'var(--nobi-danger)', color: '#FFFFFF' }} disabled={confirm.trim().toUpperCase() !== 'EXCLUIR'}>Excluir minha conta</button>
      </form>
    </Sheet>
  );
}

export default function Settings() {
  const { me, setMe, signOut } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const blocked = useLoad('/me/blocked');
  const requests = useLoad('/users/follow-requests');
  const [sheet, setSheet] = useState(null);
  const installer = useInstallAction();
  async function invite() {
    if ((await shareInvite(me.username)) === 'unavailable') setSheet('invite');
  }

  async function patch(body, optimistic) {
    const prev = me;
    setMe({ ...me, ...optimistic });
    try { setMe(await api('/me', { method: 'PATCH', body })); } catch (e) { setMe(prev); toast(e.message); }
  }
  const prefs = (p) => patch({ prefs: p }, { prefs: { ...me.prefs, ...p, notify: { ...me.prefs.notify, ...(p.notify || {}) } } });
  const privacy = (p) => patch({ privacy: p }, { privacy: { ...me.privacy, ...p } });

  async function exportData() {
    try {
      const res = await api('/me/export', { raw: true });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `nobi-${me.username}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { toast(e.message); }
  }
  async function answer(r, action) {
    await api(`/users/follow-requests/${r.id}/${action}`, { method: 'POST' });
    requests.setData((l) => l.filter((x) => x.id !== r.id));
  }
  async function unblock(u) {
    await api(`/me/blocked/${u.id}`, { method: 'DELETE' });
    blocked.setData((l) => l.filter((x) => x.id !== u.id));
  }

  const n = me.prefs.notify;
  return (
    <div className="screen no-nav">
      <header className="screen-head"><BackButton /><h1 className="title t-20">Configurações</h1><span style={{ width: 44 }} /></header>

      <Link to="/perfil/editar" className="card row gap-12 tap">
        <Avatar user={me} size={52} />
        <div className="grow stack" style={{ gap: 1 }}><span className="strong t-16">{me.name}</span><span className="t-13 muted">@{me.username}</span></div>
        <span className="t-14 strong row gap-4">Editar perfil <Icon name="chevron" size={18} /></span>
      </Link>

      <Group title="Notificações">
        <Row label="Lembrete de check-in" desc="um aviso por dia, só se faltar algo"><Toggle checked={n.checkin} onChange={(v) => prefs({ notify: { checkin: v } })} label="Lembrete de check-in" /></Row>
        <Row label="Reações e comentários" desc="quando alguém reage ao seu post"><Toggle checked={n.social} onChange={(v) => prefs({ notify: { social: v } })} label="Reações e comentários" /></Row>
        <Row label="Desafios e ranking" desc="convites e fim de semana do ranking"><Toggle checked={n.challenges} onChange={(v) => prefs({ notify: { challenges: v } })} label="Desafios e ranking" /></Row>
        <Row label="Horário do lembrete">
          <label><span className="sr-only">Horário do lembrete</span>
            <input type="time" className="input" style={{ width: 120, minHeight: 44, height: 44 }} value={me.prefs.reminderTime} disabled={!n.checkin} onChange={(e) => e.target.value && prefs({ reminderTime: e.target.value })} />
          </label>
        </Row>
      </Group>

      <Group title="Privacidade">
        <Row label="Perfil" desc="quem vê seus posts e estatísticas">
          <Segmented compact label="Quem vê o perfil" options={[['friends', 'Amigos'], ['public', 'Público']]} value={me.privacy.profile} onChange={(v) => privacy({ profile: v })} />
        </Row>
        <Row label="Novos seguidores" desc="aprovar antes de seguir você"><Toggle checked={me.privacy.approveFollowers} onChange={(v) => privacy({ approveFollowers: v })} label="Aprovar novos seguidores" /></Row>
        {(requests.data || []).map((r) => (
          <div key={r.id} className="list-row">
            <Avatar user={r.user} size={36} />
            <span className="grow t-14"><strong>{r.user.name}</strong> quer seguir você</span>
            <button type="button" className="btn btn-dark sm" onClick={() => answer(r, 'accept')}>Aceitar</button>
            <button type="button" className="icon-btn plain" aria-label={`Recusar ${r.user.name}`} onClick={() => answer(r, 'decline')}><Icon name="close" /></button>
          </div>
        ))}
        <Row label="Contas bloqueadas" desc={blocked.data?.length ? `${blocked.data.length} ${blocked.data.length === 1 ? 'conta' : 'contas'}` : 'nenhuma'} />
        {(blocked.data || []).map((u) => (
          <div key={u.id} className="list-row">
            <Avatar user={u} size={32} /><span className="grow t-14 strong">{u.name}</span>
            <button type="button" className="btn btn-outline sm" onClick={() => unblock(u)}>Desbloquear</button>
          </div>
        ))}
      </Group>

      <Group title="Preferências">
        <Row label="Tema"><Segmented compact label="Tema" options={[['light', 'Claro'], ['dark', 'Escuro'], ['system', 'Auto']]} value={me.prefs.theme} onChange={(v) => prefs({ theme: v })} /></Row>
        <Row label="Semana começa"><Segmented compact label="Semana começa" options={[['mon', 'Segunda'], ['sun', 'Domingo']]} value={me.prefs.weekStart} onChange={(v) => prefs({ weekStart: v })} /></Row>
        <Row label="Animações do Broto" desc="pulos e reações ao concluir algo"><Toggle checked={me.prefs.mascotMotion} onChange={(v) => prefs({ mascotMotion: v })} label="Animações do Broto" /></Row>
      </Group>

      <Group title="App">
        <Row as="button" type="button" label="Convidar amigos" desc="quem entrar pelo seu link vira seu amigo" onClick={invite}><Icon name="share" size={18} /></Row>
        {installer.install.available && (
          <Row as="button" type="button" label="Adicionar à tela de início" desc="abre em tela cheia, como app" onClick={installer.run}><Icon name="download" size={18} /></Row>
        )}
      </Group>

      <Group title="Conta">
        <Row as="button" type="button" label="E-mail e senha" desc={me.email || undefined} onClick={() => setSheet('account')}><Icon name="chevron" size={18} /></Row>
        <Row as="button" type="button" label="Exportar meus dados" desc="arquivo com tudo que é seu" onClick={exportData}><Icon name="download" size={18} /></Row>
        <Row as={Link} to="/termos" label="Ajuda e termos"><Icon name="chevron" size={18} /></Row>
        <Row as="button" type="button" label="Sair" onClick={() => { signOut(); navigate('/entrar', { replace: true }); }}><Icon name="logout" size={18} /></Row>
      </Group>
      <button type="button" className="btn btn-danger block" onClick={() => setSheet('delete')}>Excluir conta</button>
      <p className="t-12 muted center">{APP_NAME} · versão {APP_VERSION}</p>

      {sheet === 'account' && <AccountSheet open onClose={() => setSheet(null)} />}
      {sheet === 'delete' && <DeleteSheet open onClose={() => setSheet(null)} />}
      <InviteSheet open={sheet === 'invite'} onClose={() => setSheet(null)} username={me.username} />
      {installer.sheet}
    </div>
  );
}
