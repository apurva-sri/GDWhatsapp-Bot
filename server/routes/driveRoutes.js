// Drive API routes
const express = require("express");
const driveController = require("../controllers/driveController");

const router = express.Router();

router.get("/files", driveController.listFiles);
router.post("/upload", driveController.uploadFile);
router.delete("/:fileId", driveController.deleteFile);
router.get("/download/:fileId", driveController.downloadFile);

module.exports = router;
