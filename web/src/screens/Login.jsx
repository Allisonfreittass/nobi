import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Broto from '../components/Broto.jsx';
import { Field, ErrorNote } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';
import { APP_NAME, BRAND_LINE, GOOGLE_CLIENT_ID } from '../config.js';
import { useStatusBar } from '../lib/statusBar.js';

function GoogleButton({ onCredential, text = 'continue_with' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    const render = () => {
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => onCredential(r.credential) });
      const dark = document.documentElement.dataset.theme === 'dark';
      window.google.accounts.id.renderButton(ref.current, {
        theme: dark ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text, locale: 'pt-BR',
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
  }, [onCredential, text]);
  // Botão oficial do Google (Google Identity Services)
  // colorScheme 'normal': sem isso o navegador pinta um fundo branco atrás do iframe do Google
  return <div ref={ref} style={{ minHeight: 44, display: 'flex', justifyContent: 'center', colorScheme: 'normal' }} />;
}

// Sign in with Apple JS (web). O botão segue o padrão da Apple: preto, logo e "Continuar com Apple".
const APPLE_SDK = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/pt_BR/appleid.auth.js';
async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function AppleButton({ clientId, onToken, onError }) {
  const [ready, setReady] = useState(Boolean(window.AppleID));
  useEffect(() => {
    if (window.AppleID) return undefined;
    const s = document.createElement('script');
    s.src = APPLE_SDK;
    s.async = true;
    s.onload = () => setReady(true);
    document.head.appendChild(s);
    return () => s.remove();
  }, []);
  async function signIn() {
    try {
      const nonce = crypto.randomUUID();
      window.AppleID.auth.init({ clientId, scope: 'name email', redirectURI: `${window.location.origin}/entrar`, usePopup: true, nonce: await sha256Hex(nonce) });
      const r = await window.AppleID.auth.signIn();
      onToken({ idToken: r.authorization.id_token, nonce, user: r.user });
    } catch (e) {
      if (e?.error !== 'popup_closed_by_user' && e?.error !== 'user_cancelled_authorize') onError(new Error('Não deu para entrar com a Apple. Tente de novo.'));
    }
  }
  return (
    <button type="button" className="btn btn-dark lg block apple-btn" disabled={!ready} onClick={signIn}>
      <svg width="18" height="22" viewBox="0 0 17 21" aria-hidden="true" fill="currentColor"><path d="M14.2 11.1c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.7 5.3 2 6.4 1.1 8c-1.9 3.2-.5 8 1.3 10.6.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.9 3.4-.9s2 .9 3.4.8c1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.8-1.1-2.9-4.4zM11.6 3.4c.7-.9 1.2-2.1 1.1-3.4-1 0-2.3.7-3.1 1.6-.7.8-1.3 2-1.1 3.2 1.2.1 2.4-.6 3.1-1.4z" /></svg>
      Continuar com Apple
    </button>
  );
}

export default function Login() {
  useStatusBar('#FF5B2E'); // topo colorido: faixa do relógio na mesma cor
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

  async function apple(body) {
    try {
      const r = await api('/auth/apple', { method: 'POST', body });
      signIn(r.token, r.me, r.created ? '/metas/novo?primeiro=1' : undefined);
    } catch (err) { setError(err); }
  }

  async function google(credential) {
    try {
      const r = await api('/auth/google', { method: 'POST', body: { credential } });
      // Conta nova pelo Google segue o mesmo caminho do cadastro: criar o primeiro objetivo
      signIn(r.token, r.me, r.created ? '/metas/novo?primeiro=1' : undefined);
    } catch (err) { setError(err); }
  }


  const title = { signup: 'Criar conta', forgot: 'Esqueci a senha', email: 'Entrar com e-mail' }[mode];

  return (
    <div className="block-brasa" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="stack center gap-18" style={{ flex: 1, justifyContent: 'flex-end', padding: 'calc(48px + env(safe-area-inset-top)) 24px 28px' }}>
        <div className="nobi-hop" style={{ animationDuration: '2.4s' }}>
          <span className="broto-plate round"><Broto size={150} expression="padrao" title={`${APP_NAME}: o Broto sorrindo`} priority /></span>
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
              {providers.apple && <AppleButton clientId={providers.appleClientId} onToken={apple} onError={setError} />}
              {providers.google && <GoogleButton onCredential={google} />}
              <button type="button" className="btn btn-link" style={{ height: 52 }} onClick={() => go('email')}>Entrar com e-mail</button>
            </>
          ) : (
            <form className="stack gap-12" onSubmit={submit} noValidate>
              {title && <h2 className="title t-20">{title}</h2>}
              {mode === 'signup' && providers.google && (
                <>
                  <GoogleButton onCredential={google} text="signup_with" />
                  <div className="row gap-10 t-13 muted" aria-hidden="true">
                    <span className="grow" style={{ height: 1, background: 'var(--nobi-border-strong)' }} />ou com e-mail<span className="grow" style={{ height: 1, background: 'var(--nobi-border-strong)' }} />
                  </div>
                </>
              )}
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
                  <button type="button" className="btn btn-ghost" style={{ padding: 0, color: 'var(--nobi-text-secondary)', fontSize: 'var(--nobi-text-base)', fontWeight: 600 }} onClick={() => go(social ? 'social' : 'email')}>
                    ← {social ? 'Outras opções' : 'Voltar'}
                  </button>
                ) : <span />}
                {mode === 'email' && (
                  <button type="button" className="btn btn-ghost" style={{ padding: 0, color: 'var(--nobi-text-secondary)', fontSize: 'var(--nobi-text-base)', fontWeight: 600 }} onClick={() => go('forgot')}>Esqueci a senha</button>
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
            <br />Ao continuar, você concorda com os <Link to="/termos" style={{ textDecoration: 'underline' }}>Termos de Uso</Link> e a <Link to="/privacidade" style={{ textDecoration: 'underline' }}>Política de Privacidade</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
