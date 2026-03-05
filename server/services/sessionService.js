// Redis session management
const redisClient = require("../config/redis");

const setSession = async (key, value, ttl = 3600) => {
  // Set session in Redis
};

const getSession = async (key) => {
  // Get session from Redis
};

const deleteSession = async (key) => {
  // Delete session from Redis
};

module.exports = {
  setSession,
  getSession,
  deleteSession,
};
