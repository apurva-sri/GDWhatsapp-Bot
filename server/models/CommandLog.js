// Command audit log schema
const mongoose = require("mongoose");


const commandLogSchema = new mongoose.Schema(
  {
    // ─── Who ──────────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Stored separately from userId so we can query even if user is deleted
    whatsappNumber: {
      type: String,
      required: true,
      index: true,
    },

    // ─── What (the command) ───────────────────────────────────────
    // The exact raw text the user sent on WhatsApp
    // e.g., "delete Q3 Report.pdf"
    rawMessage: {
      type: String,
      required: true,
      maxlength: 1000, // Prevent abuse / oversized messages
    },

    // Parsed command name
    // e.g., "list" | "upload" | "delete" | "search" | "share" | "info" | "help" | "unknown"
    command: {
      type: String,
      required: true,
      enum: [
        "list",
        "upload",
        "delete",
        "search",
        "share",
        "info",
        "help",
        "unknown",
      ],
      index: true, // Admin dashboard filters by command type
    },

    // Parsed parameters extracted from the message
    // delete: { fileName: "report.pdf" }
    // share:  { fileName: "report.pdf", email: "alice@gmail.com" }
    // search: { query: "quarterly" }
    params: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ─── File context (NEW) ───────────────────────────────────────
    // If the command acted on a specific Drive file, store its ID
    // Lets us cross-reference logs with FileMetadata
    driveFileId: {
      type: String,
      default: null,
    },

    // For upload commands: the Twilio media URL of the file sent by user
    // We download from this URL and push to Google Drive
    mediaUrl: {
      type: String,
      default: null,
    },
    // MIME type of uploaded file (e.g., "application/pdf")
    mediaMimeType: {
      type: String,
      default: null,
    },

    // ─── Result ───────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["success", "failed", "pending"],
      default: "pending",
      index: true,
    },
    // What the bot sent back to the user on WhatsApp
    responseMessage: {
      type: String,
      default: null,
    },
    // How many milliseconds the command took end-to-end
    executionTimeMs: {
      type: Number,
      default: null,
    },
    // If failed: the error message (internal — not shown to user)
    errorMessage: {
      type: String,
      default: null,
    },

    // ─── Retry tracking (NEW) ─────────────────────────────────────
    // If a Drive API call fails transiently (network, rate limit),
    // we retry via RabbitMQ. Track how many times we retried.
    retryCount: {
      type: Number,
      default: 0,
    },

    // ─── Request metadata (NEW) ───────────────────────────────────
    // Useful for abuse detection and debugging
    twilioMessageSid: {
      type: String, // Twilio's unique message identifier
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  },
);

// ─── Indexes ──────────────────────────────────────────────────────

// Most common admin dashboard query: "show all logs for user X, newest first"
commandLogSchema.index({ userId: 1, createdAt: -1 });

// "show all failed commands in the last 24h" (monitoring / alerting)
commandLogSchema.index({ status: 1, createdAt: -1 });

// TTL: auto-delete logs older than 90 days to prevent unbounded growth
// Change 7776000 to any number of seconds (90 days = 90 * 24 * 60 * 60)
commandLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7776000 }, // 90 days
);

// ─── Static Methods ───────────────────────────────────────────────

/**
 * Create a new log entry when a command starts processing.
 * Returns the log doc so we can update it when the command finishes.
 *
 * Usage in controller:
 *   const log = await CommandLog.startLog(userId, from, body, "delete", { fileName });
 *   // ... do the work ...
 *   await log.complete("✅ File deleted.", executionMs);
 *   // OR
 *   await log.fail("Drive API error", executionMs);
 */
commandLogSchema.statics.startLog = function (
  userId,
  whatsappNumber,
  rawMessage,
  command,
  params = {},
) {
  return this.create({
    userId,
    whatsappNumber,
    rawMessage,
    command,
    params,
    status: "pending",
  });
};

// ─── Instance Methods ──────────────────────────────────────────────

/**
 * Mark this log entry as successfully completed.
 * @param {string} responseMessage - What the bot replied to the user
 * @param {number} executionTimeMs - How long it took
 * @param {string} driveFileId - Optional: which Drive file was acted on
 */
commandLogSchema.methods.complete = function (
  responseMessage,
  executionTimeMs,
  driveFileId = null,
) {
  this.status = "success";
  this.responseMessage = responseMessage;
  this.executionTimeMs = executionTimeMs;
  if (driveFileId) this.driveFileId = driveFileId;
  return this.save();
};

/**
 * Mark this log entry as failed.
 * @param {string} errorMessage - Internal error (not shown to user)
 * @param {number} executionTimeMs - How long it took before failing
 */
commandLogSchema.methods.fail = function (errorMessage, executionTimeMs) {
  this.status = "failed";
  this.errorMessage = errorMessage;
  this.executionTimeMs = executionTimeMs;
  return this.save();
};

const CommandLog = mongoose.model("CommandLog", commandLogSchema);
module.exports = CommandLog;
