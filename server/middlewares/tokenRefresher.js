// Auto-refresh Google tokens
const { getValidAccessToken } = require("../services/tokenService");
const logger = require("../utils/logger");

/**
 * Token Refresher Middleware
 *
 * Runs after authMiddleware on protected routes.
 * Ensures the user's Google access token is always fresh
 * before any Drive API call is made.
 *
 * If token refresh fails (user revoked access), sets
 * req.tokenError so controllers can handle it gracefully.
 */
const tokenRefresher = async (req, res, next) => {
  try {
    if (!req.user) return next(); // authMiddleware didn't set user — skip

    // This will auto-refresh if expired, using the refresh token
    const accessToken = await getValidAccessToken(req.user._id);
    req.accessToken = accessToken; // Attach to request for controllers to use
    next();
  } catch (error) {
    if (error.message === "TOKEN_REFRESH_FAILED") {
      logger.warn(`Token refresh failed for user ${req.user?._id}`);
      req.tokenError = "TOKEN_REFRESH_FAILED";
      next(); // Don't block — let controller handle it
    } else {
      next(error);
    }
  }
};

module.exports = tokenRefresher;