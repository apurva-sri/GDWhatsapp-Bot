// Drive API routes
const router = require("express").Router();
const {
  listFiles,
  searchFiles,
  deleteFile,
  shareFile,
  getFileInfo,
  downloadFilePublic,
} = require("../controllers/driveController");
const { protect } = require("../middlewares/authMiddleware");
const tokenRefresher = require("../middlewares/tokenRefresher");
const verifyOwnership = require("../middlewares/ownershipMiddleware");

// Public routes for Twilio/WhatsApp file downloads (handles requests with and without filename suffix)
router.get("/download/:userId/:fileId", downloadFilePublic);
router.get("/download/:userId/:fileId/:fileName", downloadFilePublic);

router.use(protect, tokenRefresher);

router.get("/files", listFiles);
router.get("/search", searchFiles);
router.get("/files/:fileName/info", getFileInfo);
router.delete("/files/:fileId", verifyOwnership, deleteFile);
router.post("/files/:fileId/share", verifyOwnership, shareFile);

module.exports = router;