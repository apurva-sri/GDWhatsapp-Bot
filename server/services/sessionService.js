// Redis session management
const Session = require("../models/Session");
const { SESSION_STATES } = require("../models/Session");
const { setCache, getCache, deleteCache } = require("../config/redis");
const logger = require("../utils/logger");

/**
 * Session Service
 *
 * Manages WhatsApp conversation state using a TWO-LAYER approach:
 *
 * Layer 1 — Redis (fast):
 *   - Sub-millisecond reads
 *   - TTL auto-expires stale state
 *   - Checked FIRST on every message
 *
 * Layer 2 — MongoDB (persistent):
 *   - Survives Redis restart
 *   - Source of truth
 *   - Checked only on Redis miss
 *
 * READ:  Redis → (miss) → MongoDB → populate Redis
 * WRITE: MongoDB first → then Redis (so they're always in sync)
 */

const SESSION_TTL = 600; // 10 minutes in seconds
const cacheKey = (number) => `session:${number}`;

/**
 * Get or create a session for a WhatsApp number.
 * Called at the start of every incoming message handler.
 *
 * @param {string} whatsappNumber - e.g., "whatsapp:+919876543210"
 * @param {string} userId - MongoDB User._id
 * @returns {Promise<Session>}
 */
const getOrCreateSession = async (whatsappNumber, userId) => {
  // ── Layer 1: Check Redis ───────────────────────────────────
  const cached = await getCache(cacheKey(whatsappNumber));
  if (cached) {
    // Return a lightweight plain object (not a Mongoose doc)
    // We only need state + context for most decisions
    return cached;
  }

  // ── Layer 2: Check MongoDB ─────────────────────────────────
  let session = await Session.findOne({ whatsappNumber });

  if (!session) {
    // First time this user messages the bot — create a fresh session
    session = await Session.create({
      whatsappNumber,
      userId,
      state: SESSION_STATES.IDLE,
      context: {},
    });
    logger.info(`New session created for ${whatsappNumber}`);
  }

  // Populate Redis cache for next message
  const sessionData = {
    whatsappNumber: session.whatsappNumber,
    userId: session.userId.toString(),
    state: session.state,
    context: session.context,
  };

  await setCache(cacheKey(whatsappNumber), sessionData, SESSION_TTL);
  return sessionData;
};

/**
 * Update the session state and context.
 * Always writes to MongoDB first, then syncs to Redis.
 *
 * @param {string} whatsappNumber
 * @param {string} newState - One of SESSION_STATES values
 * @param {object} context  - Data needed to complete the multi-step command
 */
const updateSession = async (whatsappNumber, newState, context = {}) => {
  // Write to MongoDB (persistent)
  const session = await Session.findOneAndUpdate(
    { whatsappNumber },
    {
      state: newState,
      context,
      lastActivityAt: new Date(),
    },
    { new: true },
  );

  if (!session) {
    logger.warn(`updateSession: no session found for ${whatsappNumber}`);
    return;
  }

  // Sync to Redis cache
  const sessionData = {
    whatsappNumber: session.whatsappNumber,
    userId: session.userId.toString(),
    state: session.state,
    context: session.context,
  };

  await setCache(cacheKey(whatsappNumber), sessionData, SESSION_TTL);
  return sessionData;
};

/**
 * Reset session back to IDLE after a command completes or user cancels.
 */
const resetSession = async (whatsappNumber) => {
  return updateSession(whatsappNumber, SESSION_STATES.IDLE, {});
};

/**
 * Fully delete a session (e.g., when user deactivates account).
 */
const deleteSession = async (whatsappNumber) => {
  await Session.deleteOne({ whatsappNumber });
  await deleteCache(cacheKey(whatsappNumber));
};

module.exports = {
  getOrCreateSession,
  updateSession,
  resetSession,
  deleteSession,
  SESSION_STATES,
};
