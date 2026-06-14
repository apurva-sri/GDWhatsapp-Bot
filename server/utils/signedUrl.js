const crypto = require("crypto");

/**
 * Generate a signed download token.
 * @param {string} userId - User ID
 * @param {string} fileId - Google Drive File ID
 * @param {number} ttlSeconds - Time-to-live in seconds (default 2 hours for WhatsApp/Twilio retrieval buffer)
 * @returns {string} token - The signed token format: expiresAt.hmac
 */
function generateDownloadToken(userId, fileId, ttlSeconds = 7200) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const message = `${userId}:${fileId}:${expiresAt}`;
  const hmac = crypto
    .createHmac("sha256", process.env.JWT_SECRET || "fallback_signing_key")
    .update(message)
    .digest("hex");
  return `${expiresAt}.${hmac}`;
}

/**
 * Verify a signed download token.
 * @param {string} userId - User ID
 * @param {string} fileId - Google Drive File ID
 * @param {string} token - The token to verify
 * @returns {boolean} isValid
 */
function verifyDownloadToken(userId, fileId, token) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [expiresAtStr, signature] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false; // Expired
  }

  const message = `${userId}:${fileId}:${expiresAt}`;
  const expectedHmac = crypto
    .createHmac("sha256", process.env.JWT_SECRET || "fallback_signing_key")
    .update(message)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedHmac, "hex")
    );
  } catch (err) {
    return false;
  }
}

module.exports = {
  generateDownloadToken,
  verifyDownloadToken,
};
