import Redis from 'ioredis';

let redisClient = null;

/**
 * Returns a singleton Redis client. Connects lazily on first call.
 * Set REDIS_URL in .env (defaults to redis://localhost:6379).
 * In Docker Compose the hostname is "redis".
 */
export function getRedisClient() {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) {
        console.warn('[redis] too many connection retries — giving up');
        return null; // stop retrying
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true
  });

  redisClient.on('connect', () => console.log('[redis] connected'));
  redisClient.on('error', (err) => console.error('[redis] error:', err.message));
  redisClient.on('close', () => console.warn('[redis] connection closed'));

  return redisClient;
}

/**
 * Connect to Redis. Safe to call multiple times.
 */
export async function connectRedis() {
  const client = getRedisClient();
  if (client.status !== 'ready' && client.status !== 'connecting') {
    await client.connect();
  }
  return client;
}

/**
 * Gracefully close the Redis connection.
 */
export async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
