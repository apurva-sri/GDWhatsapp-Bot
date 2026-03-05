// Command audit log schema
const mongoose = require("mongoose");

const commandLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  command: String,
  status: String,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CommandLog", commandLogSchema);
