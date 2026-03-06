const mongoose = require("mongoose");
const logger = require("../utils/logger");

/**
 * MongoDB Connection
 *
 * Fix: Removed useNewUrlParser and useUnifiedTopology.
 * These options were deprecated in Mongoose 6 and fully removed in Mongoose 7+.
 * Passing them now throws: "options usenewurlparser is not supported"
 *
 * Mongoose 7+ handles all of this automatically — no options needed.
 */
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI not set in .env");
    }

    logger.info("Connecting to MongoDB...");

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Fail fast if MongoDB is unreachable
    });

    const db = mongoose.connection;
    logger.info(`✅ MongoDB connected → ${db.db.databaseName}`);

    db.on("disconnected", () => logger.warn("MongoDB disconnected"));
    db.on("error", (err) => logger.error(`MongoDB error: ${err.message}`));

    return db;
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
