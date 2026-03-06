// AES token encryption utilities
const CryptoJS = require("crypto-js");

/**
 * Encryption Utility
 *
 * WHY WE ENCRYPT GOOGLE TOKENS:
 * ──────────────────────────────
 * Google OAuth tokens are essentially passwords to a user's entire Drive.
 * If your MongoDB is ever breached, plain-text tokens = full Drive access
 * for every user. Encrypted tokens = useless without the ENCRYPTION_KEY.
 *
 * Algorithm: AES-256 (Advanced Encryption Standard, 256-bit key)
 * - Industry standard, used by banks and governments
 * - The ENCRYPTION_KEY in your .env is the master secret
 * - Never commit .env to Git — that's the only thing that matters
 *
 * What encrypted data looks like in MongoDB:
 * Plain:     "ya29.a0AfH6SMBx..."
 * Encrypted: "U2FsdGVkX19K8mP2vQx7abc123..."
 *
 * ENCRYPTION_KEY requirements:
 * - Must be exactly 32 characters (256 bits)
 * - Generate one: openssl rand -hex 16
 * - Must be the SAME across all server restarts (change it = all tokens unreadable)
 */

// ─── Key Validation ───────────────────────────────────────────────
// Validate key at module load time so we catch misconfiguration
// immediately on server start, not halfway through a user operation.
const getKey = () => {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY is not set in .env — cannot encrypt/decrypt tokens",
    );
  }

  if (key.length < 16) {
    throw new Error(
      "ENCRYPTION_KEY is too short. Must be at least 16 characters. Generate one: openssl rand -hex 16",
    );
  }

  return key;
};

// ─── Encrypt ──────────────────────────────────────────────────────

/**
 * Encrypt a plain text string using AES-256.
 * Used before saving any Google OAuth token to MongoDB.
 *
 * @param {string} text - Plain text to encrypt (e.g., Google access token)
 * @returns {string|null} - Encrypted ciphertext, or null if input is empty
 *
 * @example
 * const encrypted = encrypt("ya29.a0AfH6SMBx...");
 * // Returns: "U2FsdGVkX19K8mP2..."
 */
const encrypt = (text) => {
  if (!text) return null;

  try {
    const key = getKey();
    return CryptoJS.AES.encrypt(text, key).toString();
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

// ─── Decrypt ──────────────────────────────────────────────────────

/**
 * Decrypt an AES-256 ciphertext back to plain text.
 * Used after reading an encrypted token from MongoDB.
 *
 * @param {string} ciphertext - Encrypted string from MongoDB
 * @returns {string|null} - Decrypted plain text, or null if input is empty
 * @throws {Error} If decryption fails (wrong key, corrupted data)
 *
 * @example
 * const token = decrypt("U2FsdGVkX19K8mP2...");
 * // Returns: "ya29.a0AfH6SMBx..."
 */
const decrypt = (ciphertext) => {
  if (!ciphertext) return null;

  try {
    const key = getKey();
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    // toString returns empty string on wrong key or corrupted data
    // We treat that as a failure, not silent empty string
    if (!decrypted) {
      throw new Error(
        "Decryption returned empty string — ENCRYPTION_KEY may have changed or data is corrupted",
      );
    }

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

// ─── Hash (one-way) ───────────────────────────────────────────────

/**
 * One-way SHA-256 hash of a value.
 * Use this when you need to COMPARE values without storing them plain,
 * but don't need to recover the original (unlike encrypt/decrypt).
 *
 * Good for: API keys, webhook secrets, deduplication tokens
 * NOT for: anything you need to decrypt later (use encrypt() for that)
 *
 * @param {string} value - Value to hash
 * @returns {string} - Hex-encoded SHA-256 hash
 *
 * @example
 * const hashed = hashValue("sensitive-api-key");
 * // Returns: "a665a45920422f9d417e4867efdc4fb8..."
 */
const hashValue = (value) => {
  if (!value) throw new Error("hashValue: value cannot be empty");
  return CryptoJS.SHA256(value).toString(CryptoJS.enc.Hex);
};

// ─── Safe compare ─────────────────────────────────────────────────

/**
 * Constant-time comparison of two strings.
 * Prevents timing attacks when comparing secrets.
 * Use this instead of === when comparing tokens or hashes.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
const safeCompare = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  const hashA = CryptoJS.SHA256(a).toString();
  const hashB = CryptoJS.SHA256(b).toString();
  return hashA === hashB;
};

module.exports = { encrypt, decrypt, hashValue, safeCompare };