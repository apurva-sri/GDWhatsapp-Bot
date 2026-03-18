const { createClient } = require("redis");
const logger = require("../utils/logger");


let redisClient = null;

const connectRedis = async () => {
  const config = {
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error("Redis: max reconnect attempts reached");
          return new Error("Redis max retries exceeded");
        }
        return Math.min(retries * 100, 3000); // ms to wait before retry
      },
    },
  };

  // Only add password if set — supports both password-protected and open Redis
  if (process.env.REDIS_PASSWORD) {
    config.password = process.env.REDIS_PASSWORD;
  }

  redisClient = createClient(config);

  redisClient.on("connect", () => logger.info("✅ Redis Connected"));
  redisClient.on("ready", () => logger.info("✅ Redis Ready"));
  redisClient.on("error", (err) =>
    logger.error(`❌ Redis Error: ${err.message}`),
  );
  redisClient.on("reconnecting", () => logger.warn("Redis reconnecting..."));

  // redis v4 requires explicit connect (unlike ioredis)
  await redisClient.connect();

  return redisClient;
};

// ─── Helper functions ─────────────────────────────────────────────

const getClient = () => redisClient;

/**
 * Store a value with optional TTL in seconds.
 * Value is JSON-serialized so objects/arrays work fine.
 */
const setCache = async (key, value, ttlSeconds = null) => {
  if (!redisClient) throw new Error("Redis not initialized");
  const serialized = JSON.stringify(value);
  if (ttlSeconds) {
    await redisClient.setEx(key, ttlSeconds, serialized);
  } else {
    await redisClient.set(key, serialized);
  }
};

/**
 * Retrieve a cached value. Returns null if missing or expired.
 */
const getCache = async (key) => {
  if (!redisClient) throw new Error("Redis not initialized");
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
};

/**
 * Delete a key from cache.
 */
const deleteCache = async (key) => {
  if (!redisClient) throw new Error("Redis not initialized");
  await redisClient.del(key);
};

/**
 * Check if a key exists.
 */
const exists = async (key) => {
  if (!redisClient) throw new Error("Redis not initialized");
  return await redisClient.exists(key);
};

module.exports = {
  connectRedis,
  getClient,
  setCache,
  getCache,
  deleteCache,
  exists,
};
