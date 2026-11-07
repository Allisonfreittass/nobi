import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/index.js';
import { isDateStr, serverToday, diffDays } from './dates.js';

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
export const bad = (msg, extra) => new HttpError(400, msg, extra);
export const notFound = (msg = 'Não encontrado.') => new HttpError(404, msg);
export const forbidden = (msg = 'Sem permissão.') => new HttpError(403, msg);

export const signToken = (user) => jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: '60d' });

/**
 * O cliente manda a data e a hora locais (X-Local-Date / X-Local-Time) para que "hoje" seja o dia de quem usa.
 * Aceitamos no máximo 1 dia de diferença do relógio do servidor.
 */
export function localDay(req, _res, next) {
  const server = serverToday('UTC');
  const h = req.get('X-Local-Date');
  req.today = isDateStr(h) && Math.abs(diffDays(server, h)) <= 1 ? h : serverToday();
  const t = req.get('X-Local-Time');
  req.localTime = /^\d{2}:\d{2}$/.test(t || '') ? t : null;
  next();
}

export async function requireAuth(req, _res, next) {
  const m = /^Bearer (.+)$/.exec(req.get('Authorization') || '');
  if (!m) return next(new HttpError(401, 'Entre para continuar.'));
  try {
    const { sub } = jwt.verify(m[1], config.jwtSecret);
    const user = await User.findById(sub);
    if (!user) return next(new HttpError(401, 'Sessão expirada.'));
    req.user = user;
    next();
  } catch {
    next(new HttpError(401, 'Sessão expirada.'));
  }
}

export function errorHandler(err, _req, res, _next) {
  if (err.status) return res.status(err.status).json({ error: err.message, ...err.extra });
  if (err.name === 'ValidationError') return res.status(400).json({ error: 'Dados inválidos.', fields: Object.keys(err.errors) });
  if (err.name === 'CastError') return res.status(404).json({ error: 'Não encontrado.' });
  if (err.code === 11000) return res.status(409).json({ error: 'Já existe.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Arquivo grande demais.' });
  console.error(err);
  res.status(500).json({ error: 'Algo deu errado do nosso lado.' });
}

export const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));
