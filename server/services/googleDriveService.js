// All Google Drive API calls
const { google } = require("googleapis");

const listFiles = async (auth) => {
  // List files from Drive
};

const uploadFile = async (auth, fileData) => {
  // Upload file to Drive
};

const deleteFile = async (auth, fileId) => {
  // Delete file from Drive
};

const downloadFile = async (auth, fileId) => {
  // Download file from Drive
};

module.exports = {
  listFiles,
  uploadFile,
  deleteFile,
  downloadFile,
};
