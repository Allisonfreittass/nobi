import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/index.js';
import { config } from '../config.js';
import { bad, signToken, HttpError } from '../lib/http.js';
import { meView } from './me.js';
import { linkGoogle, nowSecond } from '../services/accounts.js';

export const auth = Router();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATAR_COLORS = ['#FFD8C7', '#D9D1FF', '#CDEBDD', '#FFE9A8', '#D6E6F5', '#F8D3E1'];

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 18) || 'nobi';
}

export async function uniqueUsername(base) {
  const root = slug(base).padEnd(3, '0');
  for (let i = 0; i < 50; i++) {
    const u = i === 0 ? root : `${root}${Math.floor(Math.random() * 9000 + 100)}`;
    if (!(await User.exists({ username: u }))) return u;
  }
  return `${root}${Date.now().toString(36)}`;
}

const randomColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

auth.get('/invite/:username', async (req, res) => {
  const u = await User.findOne({ username: String(req.params.username).toLowerCase() }).lean();
  if (!u) throw new HttpError(404, 'Convite não encontrado.');
  res.json({ name: u.name, username: u.username, avatarUrl: u.avatarUrl || '', avatarColor: u.avatarColor });
});

auth.get('/providers', (_req, res) => {
  res.json({ email: true, google: Boolean(config.googleClientId), apple: false });
});

auth.post('/signup', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim()) throw bad('Conte como você quer ser chamado.');
  if (!EMAIL.test(email || '')) throw bad('E-mail inválido.');
  if ((password || '').length < 8) throw bad('A senha precisa ter pelo menos 8 caracteres.');
  if (await User.exists({ email: email.toLowerCase() })) throw new HttpError(409, 'Esse e-mail já tem conta. Tente entrar.');
  const user = await User.create({
    name: name.trim().slice(0, 60),
    email,
    passwordHash: await bcrypt.hash(password, 10),
    username: await uniqueUsername(email.split('@')[0]),
    avatarColor: randomColor(),
  });
  res.status(201).json({ token: signToken(user), me: await meView(user, req.today) });
});

auth.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: String(email || '').toLowerCase() });
  // Conta criada pelo Google não tem senha no Nobi (a senha do Google fica com o Google)
  if (user && !user.passwordHash && user.googleId) {
    throw new HttpError(401, 'Essa conta entra com o Google. Use o botão do Google ou crie uma senha em Configurações → E-mail e senha.', { googleOnly: true });
  }
  if (!user?.passwordHash || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
    throw new HttpError(401, 'E-mail ou senha não conferem.');
  }
  res.json({ token: signToken(user), me: await meView(user, req.today) });
});

auth.post('/google', async (req, res) => {
  if (!config.googleClientId) throw new HttpError(501, 'Login com Google não está configurado.');
  const client = new OAuth2Client(config.googleClientId);
  const ticket = await client.verifyIdToken({ idToken: req.body?.credential, audience: config.googleClientId }).catch(() => null);
  const p = ticket?.getPayload();
  if (!p?.sub || !p.email_verified) throw new HttpError(401, 'Não deu para confirmar sua conta Google.');
  let created = false;
  let user = await User.findOne({ $or: [{ googleId: p.sub }, { email: p.email.toLowerCase() }] });
  if (!user) {
    created = true;
    user = await User.create({
      name: p.name || p.email.split('@')[0],
      email: p.email,
      googleId: p.sub,
      emailVerified: true,
      username: await uniqueUsername(p.email.split('@')[0]),
      avatarColor: randomColor(),
    });
  } else if (!user.googleId) {
    linkGoogle(user, p.sub);
    await user.save();
  }
  res.json({ token: signToken(user), me: await meView(user, req.today), created });
});

// Sem serviço de e-mail ainda: em desenvolvimento o link sai no terminal da API.
auth.post('/forgot', async (req, res) => {
  const user = await User.findOne({ email: String(req.body?.email || '').toLowerCase() });
  if (user) {
    const token = crypto.randomBytes(24).toString('hex');
    user.resetToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    if (!config.isProd) console.log(`[auth] Link para redefinir a senha de ${user.email}: ${config.webOrigin}/redefinir-senha?token=${token}`);
  }
  res.json({ ok: true }); // mesma resposta exista ou não a conta
});

auth.post('/reset', async (req, res) => {
  const { token, password } = req.body || {};
  if ((password || '').length < 8) throw bad('A senha precisa ter pelo menos 8 caracteres.');
  const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  const user = await User.findOne({ resetToken: hash, resetTokenExpiresAt: { $gt: new Date() } });
  if (!user) throw bad('Esse link expirou. Peça outro.');
  user.passwordHash = await bcrypt.hash(password, 10);
  user.emailVerified = true;
  user.sessionsValidAfter = nowSecond();
  user.resetToken = undefined;
  user.resetTokenExpiresAt = undefined;
  await user.save();
  res.json({ token: signToken(user), me: await meView(user, req.today) });
});
