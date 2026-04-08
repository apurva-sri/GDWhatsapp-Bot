// User profile management
const User = require("../models/User");
const CommandLog = require("../models/CommandLog");
const {
  successResponse,
  errorResponse,
} = require("../utils/responseFormatter");
const { deleteCache } = require("../config/redis");
const logger = require("../utils/logger");

/**
 * User Controller
 *
 * Handles user profile management and account settings.
 * All routes protected by authMiddleware.
 */

/**
 * GET /api/user/profile
 * Get the logged-in user's full profile
 */
const getProfile = async (req, res, next) => {
  try {
    logger.info(`👤 Fetching user profile: UserId=${req.user._id}`);
    // req.user is already attached by authMiddleware
    // Re-fetch to get latest data (stats may have updated)
    const user = await User.findById(req.user._id);
    if (!user) {
      logger.warn(`⚠️ User not found: UserId=${req.user._id}`);
      return errorResponse(res, "User not found", 404);
    }
    logger.info(
      `✅ Profile retrieved successfully: UserId=${user._id} | Email=${user.email}`,
    );
    // toJSON transform automatically strips tokens
    return successResponse(res, "Profile retrieved", user);
  } catch (error) {
    logger.error(
      `❌ Error fetching profile: UserId=${req.user._id} | Error=${error.message}`,
    );
    next(error);
  }
};

/**
 * GET /api/user/stats
 * Get usage statistics for the user
 */
const getStats = async (req, res, next) => {
  try {
    logger.info(`📊 Fetching user stats: UserId=${req.user._id}`);
    const user = await User.findById(req.user._id).select("stats createdAt");

    // Count logs by status
    const [totalLogs, failedLogs] = await Promise.all([
      CommandLog.countDocuments({ userId: req.user._id }),
      CommandLog.countDocuments({ userId: req.user._id, status: "failed" }),
    ]);

    const stats = {
      ...user.stats.toObject(),
      totalLogged: totalLogs,
      failedCommands: failedLogs,
      memberSince: user.createdAt,
    };
    logger.info(
      `✅ Stats retrieved: UserId=${req.user._id} | TotalLogs=${totalLogs} | FailedCommands=${failedLogs}`,
    );
    return successResponse(res, "Stats retrieved", stats);
  } catch (error) {
    logger.error(
      `❌ Error fetching stats: UserId=${req.user._id} | Error=${error.message}`,
    );
    next(error);
  }
};

/**
 * GET /api/user/history?limit=20
 * Get recent command history for the user
 */
const getHistory = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    logger.info(
      `📃 Fetching command history: UserId=${req.user._id} | Limit=${limit}`,
    );
    const logs = await CommandLog.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("-__v");

    logger.info(
      `✅ History retrieved: UserId=${req.user._id} | RecordsFound=${logs.length}`,
    );
    return successResponse(res, "History retrieved", logs);
  } catch (error) {
    logger.error(
      `❌ Error fetching history: UserId=${req.user._id} | Error=${error.message}`,
    );
    next(error);
  }
};

/**
 * DELETE /api/user/account
 * Deactivate the user's account
 * Clears their cached tokens and marks account inactive
 */
const deactivateAccount = async (req, res, next) => {
  try {
    logger.warn(`🔒 Account deactivation requested: UserId=${req.user._id}`);
    const user = await User.findById(req.user._id);
    if (!user) {
      logger.warn(`⚠️ User not found for deactivation: UserId=${req.user._id}`);
      return errorResponse(res, "User not found", 404);
    }

    user.isActive = false;
    user.deactivatedReason = "User requested deactivation";
    await user.save();
    logger.info(
      `✅ User account deactivated: UserId=${user._id} | Email=${user.email}`,
    );

    // Clear Redis cache for this user
    await deleteCache(`tokens:${req.user._id}`);
    logger.debug(`🚮 Redis cache cleared: tokens:${req.user._id}`);

    await deleteCache(`session:${user.whatsappNumber}`);
    logger.debug(`🚮 Redis cache cleared: session:${user.whatsappNumber}`);

    logger.info(`Account deactivated: ${user.email}`);
    return successResponse(res, "Account deactivated successfully");
  } catch (error) {
    logger.error(
      `❌ Error deactivating account: UserId=${req.user._id} | Error=${error.message}`,
    );
    next(error);
  }
};

module.exports = { getProfile, getStats, getHistory, deactivateAccount };
