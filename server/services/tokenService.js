const User = require("../models/User");
const { getAuthenticatedClient } = require("../config/google");
const { encrypt, decrypt } = require("../utils/encrypt");
const { setCache, getCache } = require("../config/redis");
const logger = require("../utils/logger");

/**
 * Token Service
 *
 * This solves a critical problem:
 * Google access tokens expire after 1 hour.
 *
 * Every time a WhatsApp command arrives, we need a valid access token.
 * This service:
 * 1. Checks Redis cache first (fast, avoids DB hit)
 * 2. If not cached or expired → fetches from MongoDB → decrypts
 * 3. If token is expired → uses refresh token to get a new one from Google
 * 4. Saves the new token back to DB + Redis cache
 *
 * The WhatsApp controller calls getValidAccessToken(userId) before every Drive call.
 */

/**
 * Get a guaranteed-valid access token for a user
 * Handles caching, decryption, and auto-refresh transparently
 */
const getValidAccessToken = async (userId) => {
  // ── Check Redis cache first ────────────────────────────────
  const cacheKey = `tokens:${userId}`;
  const cached = await getCache(cacheKey);

  if (cached) {
    logger.info(`Token cache hit for user ${userId}`);
    return cached.accessToken;
  }

  // ── Fetch from MongoDB ─────────────────────────────────────
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  // Decrypt the stored tokens
  const accessToken = decrypt(user.tokens.accessToken);
  const refreshToken = decrypt(user.tokens.refreshToken);

  // ── Check if access token is expired ──────────────────────
  if (user.isTokenExpired()) {
    logger.info(`Access token expired for ${user.email}. Refreshing...`);

    try {
      // Use the refresh token to get a new access token from Google
      const oauth2Client = getAuthenticatedClient(accessToken, refreshToken);

      // This call uses the refresh token to get new credentials
      const { credentials } = await oauth2Client.refreshAccessToken();
      const newAccessToken = credentials.access_token;
      const newExpiry = new Date(credentials.expiry_date);

      // Save the new access token to MongoDB (encrypted)
      user.tokens.accessToken = encrypt(newAccessToken);
      user.tokens.tokenExpiry = newExpiry;
      await user.save();

      // Cache the fresh token in Redis
      // TTL = seconds until expiry (minus 5 min buffer)
      const ttl = Math.floor((newExpiry - Date.now()) / 1000) - 300;
      await setCache(
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
      // Refresh token itself may be expired/revoked
      // User needs to re-authenticate via Google
      throw new Error("TOKEN_REFRESH_FAILED");
    }
  }

  // Token is still valid — cache it and return
  const ttl = Math.floor((user.tokens.tokenExpiry - Date.now()) / 1000) - 300;
  await setCache(cacheKey, { accessToken }, ttl > 0 ? ttl : 3300);

  return accessToken;
};

/**
 * Get both access token and refresh token for a user
 * Used when initializing Google Drive API client
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
