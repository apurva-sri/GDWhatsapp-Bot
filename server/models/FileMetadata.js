// Cached Drive file metadata schema
const mongoose = require("mongoose");

const fileMetadataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  fileId: String,
  fileName: String,
  fileSize: Number,
  mimeType: String,
  modifiedTime: Date,
  cachedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("FileMetadata", fileMetadataSchema);
