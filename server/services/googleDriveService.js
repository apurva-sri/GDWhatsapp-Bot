const { google } = require("googleapis");
const { getAuthenticatedClient } = require("../config/google");
const { getValidAccessToken, getUserTokens } = require("./tokenService");
const FileMetadata = require("../models/FileMetadata");
const logger = require("../utils/logger");
const axios = require("axios");

const getDriveClient = async (userId, accessToken = null) => {
  let token = accessToken;

  if (!token) {
    token = await getValidAccessToken(userId);
  }

  const { refreshToken } = await getUserTokens(userId);
  const auth = getAuthenticatedClient(token, refreshToken);
  return google.drive({ version: "v3", auth });
};

// ─── LIST FILES ───────────────────────────────────────────────────

/**
 * List the user's most recent Drive files.
 * @param {string} userId
 * @param {number} limit
 * @param {string} [accessToken] - Pre-fetched token from tokenRefresher
 */
const listFiles = async (userId, limit = 10, accessToken = null) => {
  try {
    const drive = await getDriveClient(userId, accessToken);

    const response = await drive.files.list({
      pageSize: limit,
      fields: "files(id, name, mimeType, size, webViewLink, modifiedTime)",
      orderBy: "modifiedTime desc",
      q: "trashed = false",
    });

    const files = response.data.files || [];
    await FileMetadata.cacheFiles(userId, files);

    logger.logDriveOp(userId, "LIST", `${files.length} files`);
    return files;
  } catch (error) {
    logger.error(`listFiles error for ${userId}: ${error.message}`);
    throw error;
  }
};

// ─── SEARCH FILES ─────────────────────────────────────────────────

/**
 * Search Drive files by name.
 * @param {string} userId
 * @param {string} query
 * @param {string} [accessToken]
 */
const searchFiles = async (userId, query, accessToken = null) => {
  try {
    const drive = await getDriveClient(userId, accessToken);

    const safeQuery = query.replace(/'/g, "\\'");
    const response = await drive.files.list({
      pageSize: 10,
      fields: "files(id, name, mimeType, size, webViewLink, modifiedTime)",
      q: `name contains '${safeQuery}' and trashed = false`,
      orderBy: "modifiedTime desc",
    });

    const files = response.data.files || [];
    await FileMetadata.cacheFiles(userId, files);

    logger.logDriveOp(userId, "SEARCH", `"${query}" → ${files.length} results`);
    return files;
  } catch (error) {
    logger.error(`searchFiles error for ${userId}: ${error.message}`);
    throw error;
  }
};

// ─── GET FILE INFO ────────────────────────────────────────────────

/**
 * Get file info by name — checks cache first, then Drive API.
 * @param {string} userId
 * @param {string} fileName
 * @param {string} [accessToken]
 */
const getFileInfo = async (userId, fileName, accessToken = null) => {
  // Check local cache first (avoids API call)
  const cached = await FileMetadata.findByName(userId, fileName);
  if (cached) {
    return {
      id: cached.driveFileId,
      name: cached.name,
      mimeType: cached.mimeType,
      size: cached.size,
      webViewLink: cached.webViewLink,
      modifiedTime: cached.modifiedTime,
    };
  }

  // Not in cache — search Drive API
  const results = await searchFiles(userId, fileName, accessToken);
  return results.length > 0 ? results[0] : null;
};

// ─── DELETE FILE ──────────────────────────────────────────────────

/**
 * Move a file to trash in Google Drive.
 * @param {string} userId
 * @param {string} fileId  - Google Drive file ID
 * @param {string} [accessToken]
 */
const deleteFile = async (userId, fileId, accessToken = null) => {
  try {
    const drive = await getDriveClient(userId, accessToken);

    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
    });

    // Remove from local cache
    await FileMetadata.deleteOne({ userId, driveFileId: fileId });

    logger.logDriveOp(userId, "DELETE", fileId);
  } catch (error) {
    logger.error(`deleteFile error for ${userId}: ${error.message}`);
    throw error;
  }
};

// ─── UPLOAD FILE ──────────────────────────────────────────────────

/**
 * Upload a file to Google Drive by downloading from Twilio URL.
 * @param {string} userId
 * @param {string} mediaUrl    - Twilio media URL (requires Basic auth to download)
 * @param {string} fileName
 * @param {string} mimeType
 * @param {string} [accessToken]
 */
const uploadFile = async (
  userId,
  mediaUrl,
  fileName,
  mimeType,
  accessToken = null,
) => {
  try {
    const drive = await getDriveClient(userId, accessToken);

    // Download from Twilio — requires Basic auth (SID + token)
    const mediaResponse = await axios.get(mediaUrl, {
      responseType: "stream",
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
    });

    // Stream directly to Drive — no temp files
    const driveResponse = await drive.files.create({
      requestBody: { name: fileName, mimeType },
      media: { mimeType, body: mediaResponse.data },
      fields: "id, name, mimeType, size, webViewLink",
    });

    const uploadedFile = driveResponse.data;
    await FileMetadata.cacheFiles(userId, [uploadedFile]);

    logger.logDriveOp(userId, "UPLOAD", uploadedFile.name);
    return uploadedFile;
  } catch (error) {
    logger.error(`uploadFile error for ${userId}: ${error.message}`);
    throw error;
  }
};

// ─── SHARE FILE ───────────────────────────────────────────────────

/**
 * Share a Drive file with a user by email.
 * @param {string} userId
 * @param {string} fileId
 * @param {string} email
 * @param {string} role   - "reader" | "writer" | "commenter"
 * @param {string} [accessToken]
 */
const shareFile = async (
  userId,
  fileId,
  email,
  role = "reader",
  accessToken = null,
) => {
  try {
    const drive = await getDriveClient(userId, accessToken);

    await drive.permissions.create({
      fileId,
      requestBody: { type: "user", role, emailAddress: email },
      sendNotificationEmail: true,
    });

    logger.logDriveOp(userId, "SHARE", `${fileId} → ${email}`);
  } catch (error) {
    logger.error(`shareFile error for ${userId}: ${error.message}`);
    throw error;
  }
};

// ─── DOWNLOAD FILE ────────────────────────────────────────────────
/**
 * Download a file from Google Drive (or export it if it is Google-native).
 * @param {string} userId
 * @param {string} fileId
 * @param {string} [accessToken]
 * @returns {Promise<{ stream: Stream, name: string, mimeType: string }>}
 */
const downloadFile = async (userId, fileId, accessToken = null) => {
  try {
    const drive = await getDriveClient(userId, accessToken);

    // 1. Get file metadata (name & mimeType)
    const fileMeta = await drive.files.get({
      fileId,
      fields: "name, mimeType",
    });

    const { name, mimeType } = fileMeta.data;
    let stream;
    let finalMimeType = mimeType;
    let finalName = name;

    // 2. Check if it's a Google-native document
    if (mimeType.startsWith("application/vnd.google-apps.")) {
      // Map Google-native to standard export mime types
      if (mimeType === "application/vnd.google-apps.document") {
        finalMimeType = "application/pdf";
        if (!finalName.toLowerCase().endsWith(".pdf")) {
          finalName += ".pdf";
        }
      } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
        finalMimeType = "application/pdf";
        if (!finalName.toLowerCase().endsWith(".pdf")) {
          finalName += ".pdf";
        }
      } else if (mimeType === "application/vnd.google-apps.presentation") {
        finalMimeType = "application/pdf";
        if (!finalName.toLowerCase().endsWith(".pdf")) {
          finalName += ".pdf";
        }
      } else {
        // Fallback for other Google Apps types (drawings, etc.)
        finalMimeType = "application/pdf";
        if (!finalName.toLowerCase().endsWith(".pdf")) {
          finalName += ".pdf";
        }
      }

      // Export the file
      const response = await drive.files.export(
        { fileId, mimeType: finalMimeType },
        { responseType: "stream" }
      );
      stream = response.data;
    } else {
      // Regular binary file (PDF, DOCX, XLSX, images, etc.)
      const response = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "stream" }
      );
      stream = response.data;
    }

    logger.logDriveOp(userId, "DOWNLOAD", `${fileId} (${finalName})`);
    return { stream, name: finalName, mimeType: finalMimeType };
  } catch (error) {
    logger.error(`downloadFile error for ${userId} on ${fileId}: ${error.message}`);
    throw error;
  }
};

module.exports = {
  listFiles,
  searchFiles,
  getFileInfo,
  deleteFile,
  uploadFile,
  shareFile,
  downloadFile,
};
