import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

let memoryServer = null;
let connecting = null;

/** Para funções serverless (Vercel): conecta uma vez e reaproveita entre requisições. */
export function ensureDb() {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!connecting) connecting = connectDb().catch((e) => { connecting = null; throw e; });
  return connecting;
}

/**
 * Conecta no MongoDB. Sem MONGODB_URI (só em desenvolvimento), sobe um MongoDB
 * embutido que guarda os dados em server/.data, para não perder tudo ao reiniciar.
 */
export async function connectDb({ ephemeral = false } = {}) {
  let uri = config.mongoUri;
  if (!uri) {
    // Nome em variável para o empacotador da Vercel não levar o MongoDB embutido para produção
    const devOnly = 'mongodb-memory-server';
    const { MongoMemoryServer } = await import(devOnly);
    // Nos testes vários arquivos sobem um banco ao mesmo tempo: o limite padrão de 10 s para iniciar não basta
    const instance = ephemeral ? { launchTimeout: 60000 } : {};
    if (!ephemeral) {
      const dbPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.data');
      fs.mkdirSync(dbPath, { recursive: true });
      Object.assign(instance, { dbPath, storageEngine: 'wiredTiger', port: 27027 });
    }
    memoryServer = await MongoMemoryServer.create({ instance });
    uri = memoryServer.getUri('nobi');
    console.log(`[db] MongoDB embutido em ${uri}${ephemeral ? ' (temporário)' : ' (dados em server/.data)'}`);
  }
  await mongoose.connect(uri, { dbName: config.mongoDb });
  // Em desenvolvimento alinha os índices com o código. Em produção só cria os que faltam (nunca apaga).
  if (config.isProd) await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
  else await mongoose.connection.syncIndexes();
  return uri;
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

export const usingEmbeddedDb = () => !config.mongoUri;
