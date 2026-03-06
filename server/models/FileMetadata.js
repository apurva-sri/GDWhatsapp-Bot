// Cached Drive file metadata schema
const mongoose = require("mongoose");

/**
 * FileMetadata Model — Google Drive File Cache
 *
 * WHY DO WE NEED THIS?
 * ────────────────────
 * Every WhatsApp command like "delete report.pdf" or "share notes.docx"
 * needs the Google Drive FILE ID to act on it (not the filename).
 *
 * Without cache:
 *   User: "delete report.pdf"
 *   → Call Google Drive API to search for "report.pdf" → get file ID → delete
 *   → 2 API calls, ~1-2 seconds, uses Google API quota
 *
 * With cache:
 *   User: "delete report.pdf"
 *   → Check MongoDB for "report.pdf" → get file ID instantly → delete
 *   → 1 DB query, ~50ms, zero Google API quota used
 *
 * We populate this cache when:
 * - User runs "list" command (we cache all returned files)
 * - User runs "search" command (we cache search results)
 * - User uploads a file (we cache the new file's metadata)
 *
 * Cache invalidation:
 * - TTL: files auto-expire after 1 hour (Google Drive can change)
 * - On delete: we remove the cached entry
 * - On upload: we add the new entry
 */

const fileMetadataSchema = new mongoose.Schema(
  {
    // Owner of this file cache entry
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Google Drive's unique file identifier
    // This is what all Drive API calls need (not the filename)
    driveFileId: {
      type: String,
      required: true,
    },

    // Human-readable filename (e.g., "Q3 Report.pdf")
    name: {
      type: String,
      required: true,
    },

    // MIME type (e.g., "application/pdf", "image/jpeg",
    // "application/vnd.google-apps.document" for Google Docs)
    mimeType: {
      type: String,
      default: null,
    },

    // File size in bytes (null for Google Docs/Sheets/Slides — they have no size)
    size: {
      type: Number,
      default: null,
    },

    // Direct link to open the file in Google Drive
    webViewLink: {
      type: String,
      default: null,
    },

    // When the file was last modified in Google Drive
    modifiedTime: {
      type: Date,
      default: null,
    },

    // When this cache entry expires (set to 1 hour from creation)
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    },
  },
  {
    timestamps: true,
  },
);

// ── Indexes ─────────────────────────────────────────────────────

// TTL index: MongoDB auto-deletes expired cache entries
fileMetadataSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index: fast lookup by userId + driveFileId
fileMetadataSchema.index({ userId: 1, driveFileId: 1 }, { unique: true });

// Text index: enables fast search by filename
// Used when user sends "search quarterly report"
fileMetadataSchema.index({ userId: 1, name: "text" });

// ── Static Methods ───────────────────────────────────────────────

/**
 * Bulk upsert multiple files from a Drive API list response
 * Called after every "list" or "search" command
 */
fileMetadataSchema.statics.cacheFiles = async function (userId, files) {
  const ops = files.map((file) => ({
    updateOne: {
      filter: { userId, driveFileId: file.id },
      update: {
        $set: {
          userId,
          driveFileId: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size ? parseInt(file.size) : null,
          webViewLink: file.webViewLink,
          modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : null,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) {
    await this.bulkWrite(ops);
  }
};

/**
 * Find a file by name (case-insensitive) for a specific user
 * Used by commands like "delete report.pdf" to get the file ID
 */
fileMetadataSchema.statics.findByName = function (userId, name) {
  return this.findOne({
    userId,
    name: { $regex: new RegExp(name, "i") }, // case-insensitive
  });
};

const FileMetadata = mongoose.model("FileMetadata", fileMetadataSchema);
module.exports = FileMetadata;