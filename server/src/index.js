import { config } from './config.js';
import { connectDb, disconnectDb } from './db.js';
import { createApp } from './app.js';

await connectDb();
const server = createApp().listen(config.port, () => console.log(`[api] Nobi API em http://localhost:${config.port}`));

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    server.close();
    await disconnectDb();
    process.exit(0);
  });
}
