// Drive API routes
const router = require("express").Router();
const {
  listFiles,
  searchFiles,
  deleteFile,
  shareFile,
  getFileInfo,
} = require("../controllers/driveController");
const { protect } = require("../middlewares/authMiddleware");
const tokenRefresher = require("../middlewares/tokenRefresher");

router.use(protect, tokenRefresher);

router.get("/files", listFiles);
router.get("/search", searchFiles);
router.get("/files/:fileName/info", getFileInfo);
router.delete("/files/:fileId", deleteFile);
router.post("/files/:fileId/share", shareFile);

module.exports = router;