import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || '',
  mongoDb: process.env.MONGODB_DB || 'nobi',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-troque-em-producao',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:5173',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:contato@nobievolua.com.br',
  cronSecret: process.env.CRON_SECRET || '',
  isProd: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production',
};

if (config.isProd && (!config.mongoUri || config.jwtSecret.startsWith('dev-only'))) {
  throw new Error('Em produção, defina MONGODB_URI e JWT_SECRET.');
}
