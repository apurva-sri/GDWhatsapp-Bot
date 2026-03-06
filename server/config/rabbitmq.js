// RabbitMQ connection setup
const amqp = require("amqplib");
const logger = require("../utils/logger");

/**
 * RabbitMQ — Distributed Message Queue
 *
 * Problem it solves:
 * ──────────────────
 * Twilio webhook has a 5-second timeout.
 * Uploading a file to Google Drive takes 10-30 seconds.
 * If we block waiting for the upload, the webhook times out and retries (sends duplicate messages).
 *
 * Solution:
 * ─────────
 * 1. Webhook handler immediately replies "⏳ Uploading..." (< 1s)
 * 2. Publishes job to message queue
 * 3. Separate worker process consumes job and performs upload
 * 4. Worker sends follow-up WhatsApp message when done
 *
 * This is called the "async job queue" pattern.
 * Used by every production system: Uber, Stripe, Discord, etc.
 */

let connection = null;
let channel = null;

// ── Queue Names (centralized constants) ────────────────────────
const QUEUES = {
  DRIVE_UPLOAD: "drive.upload", // File upload jobs
  WHATSAPP_MESSAGE: "whatsapp.message", // Messages to send to users
  DRIVE_COMMAND: "drive.command", // Commands to process
};

/**
 * Connect to RabbitMQ server
 * Called during server startup and by the worker process
 */
const connectRabbitMQ = async () => {
  try {
    const url = process.env.RABBITMQ_URI || "amqp://localhost";
    logger.info(`Connecting to RabbitMQ: ${url}`);

    connection = await amqp.connect(url);
    channel = await connection.createChannel();

    // Set prefetch count = 1
    // This means: don't send me another job until I finish this one
    // Prevents one worker from hogging all jobs
    await channel.prefetch(1);

    // Declare all queues with durable=true
    // Durable = survive RabbitMQ restarts (persist to disk)
    for (const queueName of Object.values(QUEUES)) {
      await channel.assertQueue(queueName, { durable: true });
    }

    logger.info("✅ RabbitMQ connected and ready");

    // Graceful shutdown on connection close
    connection.on("close", () => {
      logger.warn("RabbitMQ connection closed unexpectedly");
      // Reconnect after 5 seconds
      setTimeout(connectRabbitMQ, 5000);
    });

    return connection;
  } catch (error) {
    logger.error(`RabbitMQ connection error: ${error.message}`);
    // Retry every 5 seconds
    logger.info("Retrying RabbitMQ connection in 5s...");
    setTimeout(connectRabbitMQ, 5000);
  }
};

/**
 * Publish a job to a queue
 * @param {string} queue - Queue name (use QUEUES constant)
 * @param {object} data - Job data (auto-JSON-stringified)
 * @param {object} options - RabbitMQ options (persistent, priority, etc.)
 */
const publishToQueue = (queue, data, options = {}) => {
  if (!channel) {
    throw new Error("RabbitMQ channel not ready. Wait for server startup.");
  }

  try {
    const message = JSON.stringify(data);
    const defaultOptions = {
      persistent: true, // Survive RabbitMQ restart
      contentType: "application/json",
      ...options,
    };

    channel.sendToQueue(queue, Buffer.from(message), defaultOptions);
    logger.info(`📨 Published to queue "${queue}"`);
  } catch (error) {
    logger.error(`Failed to publish to queue "${queue}": ${error.message}`);
    throw error;
  }
};

/**
 * Consume (listen to) a queue
 * Calls the handler function for each message
 *
 * @param {string} queue - Queue name (use QUEUES constant)
 * @param {function} handler - Async function(jobData) to process each job
 *                              Throw error if job should be requeued
 */
const consumeQueue = async (queue, handler) => {
  if (!channel) {
    throw new Error("RabbitMQ channel not ready");
  }

  try {
    logger.info(`🔄 Starting to consume queue "${queue}"`);

    await channel.consume(queue, async (msg) => {
      if (!msg) return; // Empty message (shouldn't happen)

      try {
        const jobData = JSON.parse(msg.content.toString());
        logger.info(`Processing job from queue "${queue}"`);

        // Call the handler — it should be an async function
        await handler(jobData);

        // ✅ Acknowledge if successful (removes from queue)
        channel.ack(msg);
        logger.info(`✅ Job completed and acknowledged`);
      } catch (error) {
        logger.error(`Job handler error: ${error.message}`);

        // ❌ Nack with requeue=true (puts it back in queue for retry)
        // Requeue = true → message goes to back of queue
        // Requeue = false → message goes to dead-letter queue (if configured)
        const shouldRequeue = !error.message.includes("PERMANENT");
        channel.nack(msg, false, shouldRequeue);

        logger.warn(
          `Job nacked. Requeue: ${shouldRequeue ? "yes" : "no (dead letter queue)"}`,
        );
      }
    });
  } catch (error) {
    logger.error(`Failed to consume queue "${queue}": ${error.message}`);
    throw error;
  }
};

/**
 * Get the current channel (for direct use if needed)
 */
const getChannel = () => channel;

/**
 * Get the current connection (for direct use if needed)
 */
const getConnection = () => connection;

module.exports = {
  connectRabbitMQ,
  publishToQueue,
  consumeQueue,
  getChannel,
  getConnection,
  QUEUES,
};
