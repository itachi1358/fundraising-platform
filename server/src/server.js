import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/database.js';
import { connectRedis } from './config/redis.js';

if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) throw new Error('MONGODB_URI and JWT_SECRET must be set');

async function start() {
  await connectDatabase();
  try {
    await connectRedis();
  } catch {
    console.warn('[redis] not available — caching & distributed rate limiting disabled');
  }
  app.listen(process.env.PORT || 5000, () => console.log(`API listening on ${process.env.PORT || 5000}`));
}

start().catch((error) => { console.error('Startup failed', error); process.exit(1); });
