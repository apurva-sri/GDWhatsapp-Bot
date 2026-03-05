// User schema
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  googleId: { type: String, required: true },
  accessToken: String,
  refreshToken: String,
  twilioNumber: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
