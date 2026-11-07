// Entrada da API na Vercel: todas as rotas /api/* chegam aqui (ver vercel.json).
import { createApp } from '../server/src/app.js';
import { ensureDb } from '../server/src/db.js';

const app = createApp();

export default async function handler(req, res) {
  try {
    await ensureDb();
  } catch (e) {
    console.error('[db]', e.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Serviço indisponível. Tente de novo em instantes.' }));
  }
  return app(req, res);
}
