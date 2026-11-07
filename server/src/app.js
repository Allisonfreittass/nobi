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
import { uploads } from './routes/uploads.js';
import { push, cron } from './routes/push.js';
import { tasks } from './routes/tasks.js';
import { metas } from './routes/metas.js';
import { clubs, community, reports } from './routes/clubs.js';
import { UPLOAD_DIR } from './services/storage.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.webOrigin, allowedHeaders: ['Content-Type', 'Authorization', 'X-Local-Date', 'X-Local-Time', 'X-Time-Zone'] }));
  // Fotos chegam já reduzidas; o limite da Vercel por requisição é 4,5 MB
  app.use('/api/uploads', express.json({ limit: '4mb' }));
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
  app.use('/api/uploads', express.static(UPLOAD_DIR, { maxAge: '365d', immutable: true, fallthrough: true }));
  app.use('/api/uploads', requireAuth, uploads);
  app.use('/api/push', requireAuth, push);
  app.use('/api/tasks', requireAuth, tasks);
  app.use('/api/metas', requireAuth, metas);
  app.use('/api/clubs', requireAuth, clubs);
  app.use('/api/community', requireAuth, community);
  app.use('/api/reports', requireAuth, reports);
  app.use('/api/cron', cron);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  app.use(errorHandler);
  return app;
}
