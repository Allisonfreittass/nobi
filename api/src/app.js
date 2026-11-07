import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { localDay, requireAuth, errorHandler } from './lib/http.js';
import { auth } from './routes/auth.js';
import { me } from './routes/me.js';
import { users } from './routes/users.js';
import { goals } from './routes/goals.js';
import { posts, feed } from './routes/posts.js';
import { home } from './routes/home.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.webOrigin, allowedHeaders: ['Content-Type', 'Authorization', 'X-Local-Date', 'X-Local-Time'] }));
  app.use(express.json({ limit: '600kb' }));
  app.use(localDay);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', auth);
  app.use('/api/me', requireAuth, me);
  app.use('/api/users', requireAuth, users);
  app.use('/api/goals', requireAuth, goals);
  app.use('/api/posts', requireAuth, posts);
  app.use('/api/feed', requireAuth, feed);
  app.use('/api/home', requireAuth, home);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  app.use(errorHandler);
  return app;
}
