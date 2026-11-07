import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Broto from '../components/Broto.jsx';
import { Field, ErrorNote } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { APP_NAME, BRAND_LINE, GOOGLE_CLIENT_ID } from '../config.js';

function GoogleButton({ onCredential }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    const render = () => {
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => onCredential(r.credential) });
      const dark = document.documentElement.dataset.theme === 'dark';
      window.google.accounts.id.renderButton(ref.current, {
        theme: dark ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'pt-BR',
        width: Math.min(400, ref.current.offsetWidth || 320), // o Google aceita no máximo 400 px
      });
    };
    if (window.google?.accounts) { render(); return undefined; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
    return () => s.remove();
  }, [onCredential]);
  // Botão oficial do Google (Google Identity Services)
  // colorScheme 'normal': sem isso o navegador pinta um fundo branco atrás do iframe do Google
  return <div ref={ref} style={{ minHeight: 44, display: 'flex', justifyContent: 'center', colorScheme: 'normal' }} />;
}

export default function Login() {
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [providers, setProviders] = useState({ google: false, apple: false });
  const social = providers.google || providers.apple;
  const [mode, setMode] = useState(params.get('modo') === 'criar' ? 'signup' : 'email');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    api('/auth/providers').then((p) => {
      setProviders(p);
      if ((p.google || p.apple) && params.get('modo') !== 'criar') setMode('social');
    }).catch(() => {});
  }, [params]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const go = (m) => { setMode(m); setError(null); setSent(false); };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'forgot') {
        await api('/auth/forgot', { method: 'POST', body: { email: form.email } });
        setSent(true);
        return;
      }
      const path = mode === 'signup' ? '/auth/signup' : '/auth/login';
      const r = await api(path, { method: 'POST', body: form });
      // A rota pública manda para `next` assim que a sessão existe
      signIn(r.token, r.me, mode === 'signup' ? '/metas/novo?primeiro=1' : undefined);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function google(credential) {
    try {
      const r = await api('/auth/google', { method: 'POST', body: { credential } });
      signIn(r.token, r.me);
      navigate('/', { replace: true });
    } catch (err) { setError(err); }
  }

  const title = { signup: 'Criar conta', forgot: 'Esqueci a senha', email: 'Entrar com e-mail' }[mode];

  return (
    <div className="block-brasa" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="stack center gap-18" style={{ flex: 1, justifyContent: 'flex-end', padding: 'calc(48px + env(safe-area-inset-top)) 24px 28px' }}>
        <div className="nobi-hop" style={{ animationDuration: '2.4s' }}>
          <Broto size={150} arms="wave" title={`${APP_NAME}: o Broto acenando`} />
        </div>
        <div className="stack center gap-8">
          <h1 className="display t-64">{APP_NAME}<span style={{ color: 'var(--nobi-creme)' }}>.</span></h1>
          <p className="title t-22" style={{ fontWeight: 600 }}>{BRAND_LINE[0]}<br />{BRAND_LINE[1]}</p>
        </div>
      </div>

      <div style={{ background: 'var(--nobi-bg)', color: 'var(--nobi-text)', borderRadius: '32px 32px 0 0', padding: '24px 20px calc(28px + env(safe-area-inset-bottom))' }}>
        <div className="stack gap-12" style={{ maxWidth: 440, margin: '0 auto' }}>
          {mode === 'social' ? (
            <>
              {providers.apple && <button type="button" className="btn btn-dark lg block">Continuar com Apple</button>}
              {providers.google && <GoogleButton onCredential={google} />}
              <button type="button" className="btn btn-link" style={{ height: 52 }} onClick={() => go('email')}>Entrar com e-mail</button>
            </>
          ) : (
            <form className="stack gap-12" onSubmit={submit} noValidate>
              {title && <h2 className="title t-20">{title}</h2>}
              {mode === 'signup' && (
                <Field label="Como quer ser chamado">
                  {(id) => <input id={id} className="input" autoComplete="name" value={form.name} onChange={set('name')} placeholder="Seu nome" required />}
                </Field>
              )}
              <Field label="E-mail">
                {(id) => <input id={id} className="input" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder="voce@email.com" required />}
              </Field>
              {mode !== 'forgot' && (
                <Field label="Senha" hint={mode === 'signup' ? 'Pelo menos 8 caracteres.' : undefined}>
                  {(id) => <input id={id} className="input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} placeholder="Sua senha" required />}
                </Field>
              )}
              <ErrorNote error={error} />
              {sent && <p className="t-14 secondary" role="status">Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha.</p>}
              <div className="row between">
                {social || mode !== 'email' ? (
                  <button type="button" className="btn btn-ghost" style={{ padding: 0, color: 'var(--nobi-text-secondary)', fontSize: 14, fontWeight: 600 }} onClick={() => go(social ? 'social' : 'email')}>
                    ← {social ? 'Outras opções' : 'Voltar'}
                  </button>
                ) : <span />}
                {mode === 'email' && (
                  <button type="button" className="btn btn-ghost" style={{ padding: 0, color: 'var(--nobi-text-secondary)', fontSize: 14, fontWeight: 600 }} onClick={() => go('forgot')}>Esqueci a senha</button>
                )}
              </div>
              <button type="submit" className="btn btn-primary block" disabled={busy}>
                {busy ? 'Só um instante…' : mode === 'signup' ? 'Criar conta' : mode === 'forgot' ? 'Enviar link' : 'Entrar'}
              </button>
            </form>
          )}
          <p className="t-12 secondary center" style={{ marginTop: 4, lineHeight: 1.5 }}>
            {mode === 'signup' ? (
              <>Já tem conta? <button type="button" className="btn-link strong" style={{ border: 'none', background: 'none', minHeight: 44, color: 'var(--nobi-text)' }} onClick={() => go(social ? 'social' : 'email')}>Entrar</button></>
            ) : (
              <>Ainda não tem conta? <button type="button" className="btn-link strong" style={{ border: 'none', background: 'none', minHeight: 44, color: 'var(--nobi-text)' }} onClick={() => go('signup')}>Criar conta</button></>
            )}
            <br />Ao continuar, você concorda com os <Link to="/termos" style={{ textDecoration: 'underline' }}>Termos e a Política de Privacidade</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
