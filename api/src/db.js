import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

let memoryServer = null;

/**
 * Conecta no MongoDB. Sem MONGODB_URI (só em desenvolvimento), sobe um MongoDB
 * embutido que guarda os dados em api/.data, para não perder tudo ao reiniciar.
 */
export async function connectDb({ ephemeral = false } = {}) {
  let uri = config.mongoUri;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const instance = {};
    if (!ephemeral) {
      const dbPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.data');
      fs.mkdirSync(dbPath, { recursive: true });
      Object.assign(instance, { dbPath, storageEngine: 'wiredTiger', port: 27027 });
    }
    memoryServer = await MongoMemoryServer.create({ instance });
    uri = memoryServer.getUri('nobi');
    console.log(`[db] MongoDB embutido em ${uri}${ephemeral ? ' (temporário)' : ' (dados em api/.data)'}`);
  }
  await mongoose.connect(uri);
  await mongoose.connection.syncIndexes();
  return uri;
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

export const usingEmbeddedDb = () => !config.mongoUri;
