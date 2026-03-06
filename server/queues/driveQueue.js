// RabbitMQ producer for Drive jobs
const { publishToQueue, QUEUES } = require("../config/rabbitmq");
const logger = require("../utils/logger");

/**
 * Drive Queue — Job Producer
 *
 * Publishes heavy Drive operations to RabbitMQ so they run
 * in the background without blocking the WhatsApp webhook response.
 *
 * The driveWorker.js consumes these jobs and processes them.
 *
 * Currently used for:
 * - File uploads (can take 10-30s for large files)
 *
 * Future use:
 * - Bulk downloads, folder operations, large list operations
 */

/**
 * Queue a file upload job.
 * Called by whatsappController when a user sends a file.
 *
 * @param {object} jobData
 * @param {string} jobData.userId        - MongoDB User._id
 * @param {string} jobData.whatsappFrom  - User's WhatsApp number (to reply to)
 * @param {string} jobData.mediaUrl      - Twilio URL of the file
 * @param {string} jobData.mediaMimeType - MIME type of the file
 * @param {string} jobData.commandLogId  - MongoDB CommandLog._id (to update on completion)
 */
const queueFileUpload = (jobData) => {
  try {
    publishToQueue(QUEUES.DRIVE_UPLOAD, {
      type: "UPLOAD",
      ...jobData,
      queuedAt: new Date().toISOString(),
    });
    logger.info(`📨 Upload job queued for user ${jobData.userId}`);
  } catch (error) {
    logger.error(`Failed to queue upload job: ${error.message}`);
    throw error;
  }
};

/**
 * Queue an outbound WhatsApp message.
 * Used by the worker to send replies after processing a job.
 *
 * @param {string} to   - WhatsApp number to send to
 * @param {string} body - Message text
 */
const queueWhatsAppMessage = (to, body) => {
  try {
    publishToQueue(QUEUES.WHATSAPP_OUTBOUND, { to, body });
  } catch (error) {
    logger.error(`Failed to queue WhatsApp message: ${error.message}`);
  }
};

module.exports = { queueFileUpload, queueWhatsAppMessage };