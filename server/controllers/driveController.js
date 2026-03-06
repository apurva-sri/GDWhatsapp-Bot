const driveService = require("../services/googleDriveService");
const {
  successResponse,
  errorResponse,
  notFoundResponse,
  badRequestResponse,
} = require("../utils/responseFormatter");
const {
  isValidEmail,
  isValidDriveFileId,
  sanitizeSearchQuery,
} = require("../utils/validate");
const asyncHandler = require("../utils/asyncHandler");
const logger = require("../utils/logger");

/**
 * Drive Controller
 *
 * Fix Issue 5: tokenError check now on ALL routes (was only on listFiles).
 * Fix Issue 5: req.accessToken passed to every driveService call
 *              so tokens are never fetched twice per request.
 *
 * All routes protected by: authMiddleware → tokenRefresher → controller
 * req.user        → set by authMiddleware
 * req.accessToken → set by tokenRefresher (valid, auto-refreshed token)
 * req.tokenError  → set by tokenRefresher if Google refresh failed
 */

// ─── Shared token guard ───────────────────────────────────────────
// DRY helper — used at top of every handler that calls Drive API
const guardToken = (req, res) => {
  if (req.tokenError === "TOKEN_REFRESH_FAILED") {
    errorResponse(
      res,
      "Your Google session has expired. Please re-login at " +
        process.env.CLIENT_URL,
      401,
    );
    return false;
  }
  return true;
};

// ─── List Files ───────────────────────────────────────────────────
const listFiles = asyncHandler(async (req, res) => {
  if (!guardToken(req, res)) return;

  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const files = await driveService.listFiles(
    req.user._id,
    limit,
    req.accessToken,
  );
  return successResponse(res, "Files retrieved", files);
});

// ─── Search Files ─────────────────────────────────────────────────
const searchFiles = asyncHandler(async (req, res) => {
  if (!guardToken(req, res)) return;

  const { q } = req.query;
  if (!q)
    return badRequestResponse(
      res,
      "Search query is required. Use: ?q=filename",
    );

  const safeQuery = sanitizeSearchQuery(q);
  const files = await driveService.searchFiles(
    req.user._id,
    safeQuery,
    req.accessToken,
  );
  return successResponse(res, "Search results", {
    query: safeQuery,
    count: files.length,
    files,
  });
});

// ─── Get File Info ────────────────────────────────────────────────
const getFileInfo = asyncHandler(async (req, res) => {
  if (!guardToken(req, res)) return;

  const { fileName } = req.params;
  if (!fileName) return badRequestResponse(res, "fileName param is required");

  const file = await driveService.getFileInfo(
    req.user._id,
    decodeURIComponent(fileName),
    req.accessToken,
  );
  if (!file) return notFoundResponse(res, `File "${fileName}" not found`);

  return successResponse(res, "File info", file);
});

// ─── Delete File ──────────────────────────────────────────────────
const deleteFile = asyncHandler(async (req, res) => {
  if (!guardToken(req, res)) return;

  const { fileId } = req.params;
  if (!fileId) return badRequestResponse(res, "fileId param is required");
  if (!isValidDriveFileId(fileId))
    return badRequestResponse(res, "Invalid fileId format");

  await driveService.deleteFile(req.user._id, fileId, req.accessToken);
  return successResponse(res, "File moved to trash");
});

// ─── Share File ───────────────────────────────────────────────────
const shareFile = asyncHandler(async (req, res) => {
  if (!guardToken(req, res)) return;

  const { fileId } = req.params;
  const { email, role = "reader" } = req.body;

  if (!fileId) return badRequestResponse(res, "fileId param is required");
  if (!email)
    return badRequestResponse(res, "email is required in request body");
  if (!isValidEmail(email))
    return badRequestResponse(res, "Invalid email address");
  if (!["reader", "writer", "commenter"].includes(role)) {
    return badRequestResponse(
      res,
      "role must be: reader, writer, or commenter",
    );
  }

  await driveService.shareFile(
    req.user._id,
    fileId,
    email,
    role,
    req.accessToken,
  );
  return successResponse(res, `File shared with ${email} as ${role}`);
});

module.exports = { listFiles, searchFiles, getFileInfo, deleteFile, shareFile };
