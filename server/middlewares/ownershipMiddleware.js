const FileMetadata = require("../models/FileMetadata");
const { forbiddenResponse } = require("../utils/responseFormatter");

/**
 * Middleware to verify resource ownership.
 * Checks two things:
 * 1. If req.params.userId exists, it must match the authenticated user (req.user._id)
 * 2. If req.params.fileId exists, it checks if there is a cached metadata entry for this file,
 *    verifying that the file belongs to the user.
 */
const verifyOwnership = async (req, res, next) => {
  try {
    // 1. Check userId parameter ownership
    if (req.params.userId) {
      if (req.params.userId !== req.user._id.toString()) {
        return forbiddenResponse(res, "Access denied: You do not own this resource");
      }
    }

    // 2. Check fileId ownership via FileMetadata cache
    if (req.params.fileId) {
      const fileId = req.params.fileId;
      const metadata = await FileMetadata.findOne({ driveFileId: fileId });
      
      if (metadata) {
        if (metadata.userId.toString() !== req.user._id.toString()) {
          return forbiddenResponse(res, "Access denied: You do not own this file");
        }
      }
      // Note: If the file is not in our metadata cache, we let Google Drive API handle 
      // the authorization check (defense-in-depth). If the user does not have permission 
      // in Google Drive, the API call in the controller will fail naturally.
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = verifyOwnership;
