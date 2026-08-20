import { getRedisClient } from '../config/redis.js';

/**
 * Express middleware that caches JSON responses in Redis.
 *
 * Usage:
 *   router.get('/campaigns', cache({ ttl: 120, key: 'campaigns:list' }), handler);
 *
 * The cache key is built from `options.key` + the request's query string,
 * so different pagination/filter params produce different cache entries.
 *
 * @param {{ ttl?: number, key?: string, skip?: (req) => boolean }} options
 *   ttl  — seconds to live (default 60)
 *   key  — base cache key prefix (required)
 *   skip — function returning true to bypass the cache for this request
 */
export function cache(options = {}) {
  const { ttl = 60, key, skip } = options;

  if (!key) {
    throw new Error('cache middleware requires a `key` option');
  }

  return async (req, res, next) => {
    // Skip cache if condition is met (e.g. authenticated admin requests)
    if (skip && skip(req)) return next();

    let redis;
    try {
      redis = getRedisClient();
    } catch {
      // Redis unavailable — fall through to the handler
      return next();
    }

    const queryPart = new URLSearchParams(req.query).toString();
    const cacheKey = queryPart ? `${key}:${queryPart}` : key;

    try {
      // ── Try to serve from cache ──
      const cached = await redis.get(cacheKey);
      if (cached !== null) {
        const parsed = JSON.parse(cached);
        res.setHeader('X-Cache', 'HIT');
        return res.json(parsed);
      }

      // ── Intercept res.json to write the response into Redis ──
      const originalJson = res.json.bind(res);
      res.json = function (body) {
        // Don't cache error responses (status >= 400)
        if (res.statusCode < 400) {
          redis.set(cacheKey, JSON.stringify(body), 'EX', ttl).catch(() => {});
        }
        res.setHeader('X-Cache', 'MISS');
        return originalJson(body);
      };

      next();
    } catch {
      // Redis read error — fall through
      next();
    }
  };
}

/**
 * Invalidate cache entries matching a pattern.
 * Use after mutations (create, update, delete).
 *
 * @param {string} pattern — Redis key pattern, e.g. 'campaigns:*'
 */
export async function invalidateCache(pattern) {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Silently fail — cache will expire naturally
  }
}
