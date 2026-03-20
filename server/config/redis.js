const { createClient } = require("redis");
const logger = require("../utils/logger");

let redisClient = null;

const connectRedis = async () => {
  // ── Production (Upstash) uses REDIS_URL ───────────────────
  // ── Development (local) uses REDIS_HOST + REDIS_PORT ──────
  const config = process.env.REDIS_URL
    ? {
        // Cloud Redis (Upstash) — full URL includes auth + TLS
        url: process.env.REDIS_URL,
        socket: {
          tls: true, // Upstash requires TLS
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error("Redis: max reconnect attempts reached");
              return new Error("Redis max retries exceeded");
            }
            return Math.min(retries * 100, 3000);
          },
        },
      }
    : {
        // Local Redis — host + port
        socket: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT) || 6379,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error("Redis: max reconnect attempts reached");
              return new Error("Redis max retries exceeded");
            }
            return Math.min(retries * 100, 3000);
          },
        },
        // Only add password if set
        ...(process.env.REDIS_PASSWORD && {
          password: process.env.REDIS_PASSWORD,
        }),
      };

  redisClient = createClient(config);

  redisClient.on("connect", () => logger.info("✅ Redis Connected"));
  redisClient.on("ready", () => logger.info("✅ Redis Ready"));
  redisClient.on("error", (err) =>
    logger.error(`❌ Redis Error: ${err.message}`),
  );
  redisClient.on("reconnecting", () => logger.warn("Redis reconnecting..."));

  await redisClient.connect();
  return redisClient;
};

// ─── Helper functions ──────────────────────────────────────────────

const getClient = () => redisClient;

const setCache = async (key, value, ttlSeconds = null) => {
  if (!redisClient) throw new Error("Redis not initialized");
  const serialized = JSON.stringify(value);
  if (ttlSeconds) {
    await redisClient.setEx(key, ttlSeconds, serialized);
  } else {
    await redisClient.set(key, serialized);
  }
};

const getCache = async (key) => {
  if (!redisClient) throw new Error("Redis not initialized");
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
};

const deleteCache = async (key) => {
  if (!redisClient) throw new Error("Redis not initialized");
  await redisClient.del(key);
};

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
