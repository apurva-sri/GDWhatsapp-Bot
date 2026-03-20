const User = require("../models/User");
const { getAuthenticatedClient } = require("../config/google");
const { encrypt, decrypt } = require("../utils/encrypt");
const { setCache, getCache } = require("../config/redis");
const logger = require("../utils/logger");

/**
 * Token Service
 *
 * Fixes applied:
 * ─────────────
 * 1. Replaced user.save() with User.findByIdAndUpdate() to avoid
 *    the pre-save hook crash ("next is not a function")
 * 2. Wrapped ALL Redis calls in try/catch — Redis failure now
 *    gracefully falls back to MongoDB instead of crashing the request
 */

// ── Safe Redis helpers ────────────────────────────────────────────
// Redis is a cache — if it's down, we just skip it and use MongoDB.
// These wrappers ensure Redis failure NEVER crashes a Drive request.

const safeGetCache = async (key) => {
  try {
    return await getCache(key);
  } catch (err) {
    logger.warn(`Redis getCache failed (key: ${key}): ${err.message}`);
    return null; // treat as cache miss
  }
};

const safeSetCache = async (key, value, ttl) => {
  try {
    await setCache(key, value, ttl);
  } catch (err) {
    logger.warn(`Redis setCache failed (key: ${key}): ${err.message}`);
    // non-fatal — just means next request won't have cached token
  }
};

// ── Main function ─────────────────────────────────────────────────

/**
 * Get a guaranteed-valid access token for a user.
 * Handles caching, decryption, and auto-refresh transparently.
 *
 * @param {string} userId - MongoDB User._id
 * @returns {string} valid Google access token
 */
const getValidAccessToken = async (userId) => {
  const cacheKey = `tokens:${userId}`;

  // ── 1. Check Redis cache first ─────────────────────────────
  const cached = await safeGetCache(cacheKey);
  if (cached?.accessToken) {
    logger.info(`Token cache hit for user ${userId}`);
    return cached.accessToken;
  }

  // ── 2. Fetch from MongoDB ──────────────────────────────────
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const accessToken = decrypt(user.tokens.accessToken);
  const refreshToken = decrypt(user.tokens.refreshToken);

  // ── 3. Refresh if expired ──────────────────────────────────
  if (user.isTokenExpired()) {
    logger.info(`Access token expired for ${user.email}. Refreshing...`);

    try {
      const oauth2Client = getAuthenticatedClient(accessToken, refreshToken);
      const { credentials } = await oauth2Client.refreshAccessToken();

      const newAccessToken = credentials.access_token;
      const newExpiry = new Date(credentials.expiry_date);

      // ✅ Use findByIdAndUpdate instead of user.save()
      // This bypasses the pre-save hook entirely
      await User.findByIdAndUpdate(userId, {
        "tokens.accessToken": encrypt(newAccessToken),
        "tokens.tokenExpiry": newExpiry,
        lastActiveAt: new Date(),
      });

      // Cache the fresh token
      const ttl = Math.floor((newExpiry - Date.now()) / 1000) - 300;
      await safeSetCache(
        cacheKey,
        { accessToken: newAccessToken },
        ttl > 0 ? ttl : 3300,
      );

      logger.info(`✅ Token refreshed for ${user.email}`);
      return newAccessToken;
    } catch (refreshError) {
      logger.error(
        `Token refresh failed for ${user.email}: ${refreshError.message}`,
      );
      throw new Error("TOKEN_REFRESH_FAILED");
    }
  }

  // ── 4. Token still valid — cache and return ────────────────
  const ttl = Math.floor((user.tokens.tokenExpiry - Date.now()) / 1000) - 300;
  await safeSetCache(cacheKey, { accessToken }, ttl > 0 ? ttl : 3300);

  return accessToken;
};

/**
 * Get both decrypted tokens for a user.
 * Used when building the Google Drive API client.
 *
 * @param {string} userId
 * @returns {{ accessToken: string, refreshToken: string }}
 */
const getUserTokens = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  return {
    accessToken: decrypt(user.tokens.accessToken),
    refreshToken: decrypt(user.tokens.refreshToken),
  };
};

module.exports = { getValidAccessToken, getUserTokens };
