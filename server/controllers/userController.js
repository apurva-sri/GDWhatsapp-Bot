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
    // req.user is already attached by authMiddleware
    // Re-fetch to get latest data (stats may have updated)
    const user = await User.findById(req.user._id);
    if (!user) return errorResponse(res, "User not found", 404);
    // toJSON transform automatically strips tokens
    return successResponse(res, "Profile retrieved", user);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/user/stats
 * Get usage statistics for the user
 */
const getStats = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("stats createdAt");

    // Count logs by status
    const [totalLogs, failedLogs] = await Promise.all([
      CommandLog.countDocuments({ userId: req.user._id }),
      CommandLog.countDocuments({ userId: req.user._id, status: "failed" }),
    ]);

    return successResponse(res, "Stats retrieved", {
      ...user.stats.toObject(),
      totalLogged: totalLogs,
      failedCommands: failedLogs,
      memberSince: user.createdAt,
    });
  } catch (error) {
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
    const logs = await CommandLog.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("-__v");

    return successResponse(res, "History retrieved", logs);
  } catch (error) {
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
    const user = await User.findById(req.user._id);
    if (!user) return errorResponse(res, "User not found", 404);

    user.isActive = false;
    user.deactivatedReason = "User requested deactivation";
    await user.save();

    // Clear Redis cache for this user
    await deleteCache(`tokens:${req.user._id}`);
    await deleteCache(`session:${user.whatsappNumber}`);

    logger.info(`Account deactivated: ${user.email}`);
    return successResponse(res, "Account deactivated successfully");
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, getStats, getHistory, deactivateAccount };