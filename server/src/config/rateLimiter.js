import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from './redis.js';

/**
 * Creates a RedisStore-backed rate limiter when Redis is available,
 * falling back to in-memory store otherwise.
 */
function createLimiter(options) {
  let store;
  try {
    const redis = getRedisClient();
    if (redis.status === 'ready' || redis.status === 'connect') {
      store = new RedisStore({
        // @ts-expect-error – rate-limit-redis v6 sendCommand signature
        sendCommand: (...args) => redis.call(...args),
        prefix: 'rl:'
      });
    }
  } catch {
    // Redis not available — use default in-memory store
  }

  return rateLimit({
    ...options,
    ...(store ? { store } : {})
  });
}

// ── Strict: auth endpoints (login, signup, password reset) ──
export const authLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,  // 1 hour
  limit: 6000,                 // 60 attempts per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many attempts. Please wait 1 hour before trying again.'
  }
});

// ── Standard: read-heavy endpoints (browse campaigns, donations list) ──
export const standardLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 60000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests. Please slow down and try again shortly.'
  }
});

// ── Write: create/update endpoints (create campaign, donate, edit profile) ──
export const writeLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 12000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many submission attempts. Please wait before trying again.'
  }
});

// ── Payment: donation checkout & verification (extra sensitive) ──
export const paymentLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 6000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many payment attempts. Please wait and try again.'
  }
});

// ── Admin: admin dashboard, moderation actions ──
export const adminLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many admin requests. Please slow down.'
  }
});

// ── Strictest: webhook (already raw-body, but add rate limit just in case) ──
export const webhookLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,  // 5 minutes
  limit: 3000,                // 300 webhooks per 5 minutes (Razorpay can burst)
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { status: 429, message: 'Too many webhook deliveries.' }
});
