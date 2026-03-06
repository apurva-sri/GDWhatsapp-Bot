// Winston logger configuration
const winston = require("winston");
const path = require("path");
const fs = require("fs");

/**
 * Logger Utility (Winston)
 *
 * WHY WINSTON INSTEAD OF console.log:
 * ─────────────────────────────────────
 
 * Winston:
 *   ✅ Timestamps on every line
 *   ✅ Log levels: error > warn > info > debug
 *   ✅ Color-coded console output in dev
 *   ✅ File output in production (error.log + combined.log)
 *   ✅ Silences debug logs automatically in production
 *   ✅ Token sanitization — sensitive values never appear in logs
 *
 * LOG LEVELS (severity order, high → low):
 *   error  → Something broke, needs attention
 *   warn   → Something unexpected but recoverable
 *   info   → Normal operations worth tracking
 *   debug  → Verbose detail for development only
 *
 * In development:  all levels shown (debug → error)
 * In production:   only warn + error shown (no debug/info noise)
 */

// ─── Logs Directory ───────────────────────────────────────────────
// Create logs/ directory if it doesn't exist.
// Without this, Winston crashes in production when trying to write log files.
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ─── Sensitive Field Sanitizer ────────────────────────────────────
/**
 * Strips sensitive values from log messages before they're written.
 * Prevents access tokens, refresh tokens, and encryption keys
 * from accidentally appearing in log files.
 *
 * e.g., "Token: ya29.a0AfH6SMBx..." → "Token: [REDACTED]"
 */
const SENSITIVE_PATTERNS = [
  // Google OAuth tokens (start with "ya29.")
  /ya29\.[A-Za-z0-9_-]{10,}/g,
  // JWT tokens (three base64 parts separated by dots)
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  // Encrypted tokens (AES output — long base64-like strings)
  /U2FsdGVkX1[A-Za-z0-9+/=]{20,}/g,
];

const sanitize = winston.format((info) => {
  let message =
    typeof info.message === "string"
      ? info.message
      : JSON.stringify(info.message);

  for (const pattern of SENSITIVE_PATTERNS) {
    message = message.replace(pattern, "[REDACTED]");
  }

  info.message = message;
  return info;
});

// ─── Console Format (development) ────────────────────────────────
// Human-readable, color-coded output for your terminal
const consoleFormat = winston.format.combine(
  sanitize(),
  winston.format.timestamp({ format: "HH:mm:ss" }), // Short time for dev
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return stack
      ? `[${timestamp}] ${level}: ${message}\n${stack}`
      : `[${timestamp}] ${level}: ${message}`;
  }),
);

// ─── File Format (production) ─────────────────────────────────────
// JSON format for log aggregation tools (Datadog, CloudWatch, etc.)
const fileFormat = winston.format.combine(
  sanitize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.json(), // Structured JSON — easy to query/filter
);

// ─── Logger Instance ──────────────────────────────────────────────
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "warn" : "debug",
  transports: [
    // Always: colored console output
    new winston.transports.Console({
      format: consoleFormat,
    }),

    // Production only: write to log files
    ...(process.env.NODE_ENV === "production"
      ? [
          // Errors only — for alerting and quick triage
          new winston.transports.File({
            filename: path.join(logsDir, "error.log"),
            level: "error",
            format: fileFormat,
            maxsize: 10 * 1024 * 1024, // 10MB max per file
            maxFiles: 5, // Keep last 5 rotated files
          }),
          // All levels — full audit trail
          new winston.transports.File({
            filename: path.join(logsDir, "combined.log"),
            format: fileFormat,
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5,
          }),
        ]
      : []),
  ],

  // Don't crash the server on uncaught logger errors
  exitOnError: false,
});

// ─── HTTP Request Logger ──────────────────────────────────────────
/**
 * Logs incoming HTTP requests in a clean format.
 * Used as Morgan stream in app.js:
 *   morgan("dev", { stream: logger.httpStream })
 */
logger.httpStream = {
  write: (message) => {
    // Morgan adds a newline — trim it before logging
    logger.info(message.trim());
  },
};

// ─── Convenience helpers ──────────────────────────────────────────
/**
 * Log a WhatsApp command with consistent formatting.
 * Used in whatsappController for clean command tracking.
 */
logger.logCommand = (from, command, status) => {
  logger.info(
    `📱 WA Command | From: ${from} | Cmd: ${command} | Status: ${status}`,
  );
};

/**
 * Log a Google Drive API operation.
 * Used in googleDriveService.
 */
logger.logDriveOp = (userId, operation, detail = "") => {
  logger.info(
    `📂 Drive Op | User: ${userId} | Op: ${operation}${detail ? ` | ${detail}` : ""}`,
  );
};

module.exports = logger;