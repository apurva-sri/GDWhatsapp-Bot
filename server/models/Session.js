const mongoose = require("mongoose");

/**
 * Session Model — WhatsApp Conversation State
 *
 * WHY DO WE NEED THIS?
 * ────────────────────
 * WhatsApp is stateless — every message is an independent HTTP request.
 * But some commands are multi-step. For example:
 *
 *   User: "upload"
 *   Bot:  "Please send the file you want to upload."
 *   User: [sends a PDF]        ← How does the bot know this PDF is for upload?
 *
 * Without session: Bot has no idea what the PDF is for.
 * With session:    Bot checks DB → sees user is in "awaiting_file" state → uploads it.
 *
 * Another example:
 *   User: "delete project.pdf"
 *   Bot:  "Are you sure? Reply YES to confirm."
 *   User: "YES"                ← Bot needs to remember WHICH file to delete
 *
 * Session stores:
 * - What state the user is in (idle, awaiting_file, awaiting_confirmation)
 * - Context data (e.g., which file they want to delete)
 * - TTL: auto-expires after 10 minutes of inactivity (so state doesn't get stuck)
 *
 * NOTE: We also use Redis for fast session reads, but MongoDB is the
 * persistent backup. The sessionService.js will sync between both.
 */

const SESSION_STATES = {
  IDLE: "idle", // No active command, waiting for new input
  AWAITING_FILE: "awaiting_file", // User said "upload", waiting for file
  AWAITING_DELETE_CONFIRM: "awaiting_delete_confirm", // Waiting for YES/NO
  AWAITING_SHARE_EMAIL: "awaiting_share_email", // Waiting for email address
};

const sessionSchema = new mongoose.Schema(
  {
    // The user's WhatsApp number — primary key for lookups
    // Format: "whatsapp:+919876543210"
    whatsappNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Link to the User document
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Current state of the conversation
    state: {
      type: String,
      enum: Object.values(SESSION_STATES),
      default: SESSION_STATES.IDLE,
    },

    // Any data needed to complete the current multi-step command
    // Examples:
    //   delete flow:  { fileName: "report.pdf", fileId: "1BxiM..." }
    //   share flow:   { fileName: "report.pdf", fileId: "1BxiM..." }
    //   upload flow:  {} (just waiting for a file attachment)
    context: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // When this session was last active
    // Used with TTL index to auto-delete stale sessions
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// ── TTL Index ───────────────────────────────────────────────────
// MongoDB automatically deletes session documents 600 seconds
// (10 minutes) after lastActivityAt. This prevents stuck states.
// e.g., user says "delete file.pdf" then walks away — session clears itself.
sessionSchema.index({ lastActivityAt: 1 }, { expireAfterSeconds: 600 });

// ── Instance Methods ────────────────────────────────────────────

/** Reset session back to idle (after command completes or times out) */
sessionSchema.methods.reset = async function () {
  this.state = SESSION_STATES.IDLE;
  this.context = {};
  this.lastActivityAt = new Date();
  return this.save();
};

/** Update state and store context for multi-step commands */
sessionSchema.methods.setState = async function (newState, contextData = {}) {
  this.state = newState;
  this.context = contextData;
  this.lastActivityAt = new Date();
  return this.save();
};

/** Touch the session to reset the 10-minute TTL timer */
sessionSchema.methods.touch = async function () {
  this.lastActivityAt = new Date();
  return this.save();
};

const Session = mongoose.model("Session", sessionSchema);

module.exports = Session;
module.exports.SESSION_STATES = SESSION_STATES;
