// RabbitMQ consumer for processing Drive jobs
require("dotenv").config();

const { connectRabbitMQ, consumeQueue, QUEUES } = require("../config/rabbitmq");
const { connectRedis } = require("../config/redis");
const connectDB = require("../config/db");
const driveService = require("../services/googleDriveService");
const { sendMessage } = require("../services/twilioService");
const { resetSession } = require("../services/sessionService");
const CommandLog = require("../models/CommandLog");
const User = require("../models/User");
const logger = require("../utils/logger");

/**
 * Drive Worker — RabbitMQ Consumer
 *
 * This runs as a SEPARATE PROCESS from the main server.
 * Start it with: npm run worker
 *
 * WHY SEPARATE PROCESS?
 * ─────────────────────
 * The main server must respond to Twilio in < 5 seconds.
 * Uploading a 10MB file to Google Drive takes 10-30 seconds.
 *
 * Flow:
 * 1. Main server receives file from WhatsApp
 * 2. Main server immediately replies "⏳ Uploading..." to user (< 1s)
 * 3. Main server publishes job to RabbitMQ queue
 * 4. THIS WORKER picks up the job
 * 5. Worker uploads to Google Drive (takes as long as needed)
 * 6. Worker sends "✅ Uploaded!" WhatsApp message to user
 */

const startWorker = async () => {
  logger.info("🔧 Starting Drive Worker...");

  // Worker needs its own DB and Redis connections
  await connectDB();
  connectRedis();
  await connectRabbitMQ();

  // ── Process upload jobs ──────────────────────────────────
  await consumeQueue(QUEUES.DRIVE_UPLOAD, async (job) => {
    const { userId, whatsappFrom, mediaUrl, mediaMimeType, commandLogId } = job;
    const start = Date.now();

    logger.info(`📥 Processing upload job for user ${userId}`);

    let log = null;
    try {
      if (commandLogId) {
        log = await CommandLog.findById(commandLogId);
      }

      // Derive a filename from MIME type
      const ext = mediaMimeType ? mediaMimeType.split("/")[1] : "file";
      const fileName = `WhatsApp_Upload_${Date.now()}.${ext}`;

      // Upload to Google Drive
      const uploadedFile = await driveService.uploadFile(
        userId,
        mediaUrl,
        fileName,
        mediaMimeType,
      );

      const successMsg =
        `✅ *${uploadedFile.name}* uploaded to Drive!\n\n` +
        `🔗 ${uploadedFile.webViewLink || "Link not available"}`;

      // Send success message back to user on WhatsApp
      await sendMessage(whatsappFrom, successMsg);

      // Update command log
      if (log)
        await log.complete(successMsg, Date.now() - start, uploadedFile.id);

      // Update user stats
      await User.findByIdAndUpdate(userId, {
        $inc: { "stats.totalCommands": 1, "stats.totalUploads": 1 },
        "stats.lastCommandAt": new Date(),
      });

      // Reset session state
      await resetSession(whatsappFrom);

      logger.info(
        `✅ Upload job completed for user ${userId} | File: ${uploadedFile.name}`,
      );
    } catch (error) {
      logger.error(`Upload job failed for user ${userId}: ${error.message}`);

      // Notify user of failure
      await sendMessage(
        whatsappFrom,
        `❌ Upload failed. Please try again.\n\n_Error: ${error.message}_`,
      );

      if (log) await log.fail(error.message, Date.now() - start);
      await resetSession(whatsappFrom);
    }
  });

  // ── Process outbound WhatsApp messages ──────────────────
  await consumeQueue(QUEUES.WHATSAPP_OUTBOUND, async ({ to, body }) => {
    await sendMessage(to, body);
  });

  logger.info("✅ Drive Worker running. Waiting for jobs...");
};

startWorker().catch((err) => {
  logger.error(`Worker failed to start: ${err.message}`);
  process.exit(1);
});