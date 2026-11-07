import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Field, ErrorNote } from '../components/ui.jsx';
import { Logo } from '../components/Logo.jsx';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  async function submit(e) {
    e.preventDefault();
    try {
      const r = await api('/auth/reset', { method: 'POST', body: { token: params.get('token'), password } });
      signIn(r.token, r.me);
      navigate('/', { replace: true });
    } catch (err) { setError(err); }
  }
  return (
    <form className="screen no-nav" onSubmit={submit} style={{ maxWidth: 440 }}>
      <Logo />
      <h1 className="title t-28">Nova senha</h1>
      <Field label="Nova senha" hint="Pelo menos 8 caracteres.">
        {(id) => <input id={id} className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <ErrorNote error={error} />
      <button type="submit" className="btn btn-primary block">Salvar e entrar</button>
    </form>
  );
}
