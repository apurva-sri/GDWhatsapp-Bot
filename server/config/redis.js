// Redis client setup
const redis = require("redis");

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
});

redisClient.on("error", (err) => {
  console.error("Redis client error:", err);
});

redisClient.connect();

module.exports = redisClient;
