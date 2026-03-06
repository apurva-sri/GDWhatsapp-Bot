/**
 * Validation Utility
 *
 * WHY A SEPARATE VALIDATION FILE:
 * ────────────────────────────────
 * Without this, validation logic gets copy-pasted across controllers:
 *   if (!email || !email.includes("@")) { ... }  ← in authController
 *   if (!email || !email.includes("@")) { ... }  ← in driveController
 *   if (!email || !email.includes("@")) { ... }  ← in whatsappController
 *
 * With this file, every controller just calls:
 *   if (!isValidEmail(email)) { ... }
 *
 * Also used by commandParser.js to validate share command emails.
 */

// ─── String validators ────────────────────────────────────────────

/**
 * Check if a value is a non-empty string after trimming.
 * @param {any} value
 * @returns {boolean}
 */
const isNonEmptyString = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};

/**
 * Validate an email address format.
 * Checks for basic structure: something@something.something
 *
 * @param {string} email
 * @returns {boolean}
 *
 * @example
 * isValidEmail("alice@gmail.com")  // true
 * isValidEmail("not-an-email")     // false
 */
const isValidEmail = (email) => {
  if (!isNonEmptyString(email)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(email.trim().toLowerCase());
};

/**
 * Validate a WhatsApp number format as sent by Twilio.
 * Expected format: "whatsapp:+<country code><number>"
 *
 * @param {string} number
 * @returns {boolean}
 *
 * @example
 * isValidWhatsAppNumber("whatsapp:+919876543210")  // true
 * isValidWhatsAppNumber("+919876543210")            // false
 */
const isValidWhatsAppNumber = (number) => {
  if (!isNonEmptyString(number)) return false;
  return /^whatsapp:\+\d{7,15}$/.test(number.trim());
};

/**
 * Validate a Google Drive file ID format.
 * Drive file IDs are alphanumeric strings, typically 25-44 chars.
 *
 * @param {string} fileId
 * @returns {boolean}
 */
const isValidDriveFileId = (fileId) => {
  if (!isNonEmptyString(fileId)) return false;
  return /^[a-zA-Z0-9_-]{10,60}$/.test(fileId.trim());
};

// ─── Object validators ────────────────────────────────────────────

/**
 * Check that all required fields exist and are non-empty in an object.
 * Returns an array of missing field names (empty array = all present).
 *
 * @param {object}   obj      - The object to check (e.g., req.body)
 * @param {string[]} fields   - List of required field names
 * @returns {string[]}        - Names of missing fields
 *
 * @example
 * const missing = requireFields(req.body, ["email", "fileId"]);
 * if (missing.length > 0) {
 *   return badRequestResponse(res, `Missing fields: ${missing.join(", ")}`);
 * }
 */
const requireFields = (obj, fields) => {
  if (!obj || typeof obj !== "object") return fields;
  return fields.filter(
    (field) => obj[field] === undefined || obj[field] === null || obj[field] === ""
  );
};

// ─── Sanitizers ───────────────────────────────────────────────────

/**
 * Sanitize a filename for safe use in Drive API calls.
 * Removes characters that could cause issues.
 *
 * @param {string} filename
 * @returns {string}
 *
 * @example
 * sanitizeFilename("../etc/passwd")      // "etcpasswd"
 * sanitizeFilename("My File (2024).pdf") // "My File (2024).pdf"
 */
const sanitizeFilename = (filename) => {
  if (!isNonEmptyString(filename)) return "untitled";
  return filename
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "") // Remove filesystem-unsafe chars
    .replace(/\.{2,}/g, ".")        // Collapse multiple dots (prevent path traversal)
    .substring(0, 255);             // Drive filename limit
};

/**
 * Sanitize a search query before passing to Drive API.
 * Prevents injection into Drive's query syntax.
 *
 * @param {string} query
 * @returns {string}
 */
const sanitizeSearchQuery = (query) => {
  if (!isNonEmptyString(query)) return "";
  return query
    .trim()
    .replace(/'/g, "\\'")  // Escape single quotes (Drive query uses them)
    .substring(0, 100);    // Reasonable search query limit
};

// ─── Pagination helpers ───────────────────────────────────────────

/**
 * Parse and validate pagination query params from req.query.
 * Returns safe defaults if params are missing or invalid.
 *
 * @param {object} query    - req.query object
 * @param {number} maxLimit - Maximum allowed limit (default 50)
 * @returns {{ page: number, limit: number, skip: number }}
 *
 * @example
 * const { page, limit, skip } = parsePagination(req.query);
 * const files = await File.find().skip(skip).limit(limit);
 */
const parsePagination = (query, maxLimit = 50) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit) || 10));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

module.exports = {
  isNonEmptyString,
  isValidEmail,
  isValidWhatsAppNumber,
  isValidDriveFileId,
  requireFields,
  sanitizeFilename,
  sanitizeSearchQuery,
  parsePagination,
};
