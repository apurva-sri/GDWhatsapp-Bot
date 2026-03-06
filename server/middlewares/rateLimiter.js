const { getClient } = require("../config/redis");
const logger = require("../utils/logger");

/**
 * Rate Limiter Middleware
 *
 * Uses the official 'redis' package (v4).
 * Key difference from ioredis: method names are camelCase
 *   ioredis: redis.incr(), redis.expire(), redis.ttl()
 *   redis v4: redis.incr(), redis.expire(), redis.ttl()  ← same! ✅
 *
 * Two limiters:
 * 1. whatsappRateLimiter — called as async function in whatsappController
 * 2. apiRateLimiter      — Express middleware for REST API routes
 */

// ─── WhatsApp Rate Limiter ────────────────────────────────────────
// Called as a function (not middleware) inside whatsappController
// Returns { allowed: bool, message: string, remaining: number }

const whatsappRateLimiter = async (
  fromNumber,
  limit = 20,
  windowSeconds = 60,
) => {
  const redis = getClient();

  // Fail open if Redis isn't ready yet
  if (!redis || !redis.isReady) {
    logger.warn("Redis not ready — skipping WhatsApp rate limit check");
    return { allowed: true, remaining: limit };
  }

  const key = `ratelimit:whatsapp:${fromNumber}`;

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      // First request in this window — set expiry
      await redis.expire(key, windowSeconds);
    }

    if (current > limit) {
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        message: `⚠️ Too many commands. Please wait ${ttl} seconds.`,
        remaining: 0,
      };
    }

    return { allowed: true, remaining: limit - current };
  } catch (error) {
    logger.error(`WhatsApp rate limiter error: ${error.message}`);
    return { allowed: true, remaining: limit }; // Fail open
  }
};

// ─── API Rate Limiter ─────────────────────────────────────────────
// Express middleware — used as app.use("/api", apiRateLimiter)

const apiRateLimiter = (req, res, next) => {
  const redis = getClient();

  // Not ready yet (cold start) — let request through
  if (!redis || !redis.isReady) return next();

  const ip = req.ip || "unknown";
  const key = `ratelimit:api:${ip}`;

  redis
    .incr(key)
    .then((current) => {
      if (current === 1) redis.expire(key, 60);
      if (current > 100) {
        return res.status(429).json({
          success: false,
          message: "Too many requests. Please slow down.",
        });
      }
      next();
    })
    .catch(() => next()); // Fail open on Redis error
};

module.exports = { whatsappRateLimiter, apiRateLimiter };
