const amqp = require("amqplib");
const logger = require("../utils/logger");

let connection = null;
let channel = null;

const QUEUES = {
  DRIVE_UPLOAD: "drive.upload",
  WHATSAPP_MESSAGE: "whatsapp.message",
  DRIVE_COMMAND: "drive.command",
};

const connectRabbitMQ = async () => {
  try {
    // ── Supports both local and cloud (CloudAMQP) ─────────────
    // Local:  amqp://admin:rabbit123@localhost:5672
    // Cloud:  amqps://user:pass@fish.rmq.cloudamqp.com/user
    // The only difference is amqp vs amqps (TLS) — amqplib handles both
    const url = process.env.RABBITMQ_URI || "amqp://localhost";
    logger.info(`Connecting to RabbitMQ: ${url}`);

    connection = await amqp.connect(url);
    channel = await connection.createChannel();

    await channel.prefetch(1);

    for (const queueName of Object.values(QUEUES)) {
      await channel.assertQueue(queueName, { durable: true });
    }

    logger.info("✅ RabbitMQ connected and ready");

    connection.on("close", () => {
      logger.warn("RabbitMQ connection closed — retrying in 5s...");
      connection = null;
      channel = null;
      setTimeout(connectRabbitMQ, 5000);
    });

    connection.on("error", (err) => {
      logger.error(`RabbitMQ connection error: ${err.message}`);
    });

    return connection;
  } catch (error) {
    logger.error(`RabbitMQ connection error: ${error.message}`);
    logger.info("Retrying RabbitMQ connection in 5s...");
    connection = null;
    channel = null;
    setTimeout(connectRabbitMQ, 5000);
  }
};

const publishToQueue = (queue, data, options = {}) => {
  if (!channel) {
    throw new Error("RabbitMQ channel not ready. Wait for server startup.");
  }
  const message = JSON.stringify(data);
  const defaultOptions = {
    persistent: true,
    contentType: "application/json",
    ...options,
  };
  channel.sendToQueue(queue, Buffer.from(message), defaultOptions);
  logger.info(`📨 Published to queue "${queue}"`);
};

const consumeQueue = async (queue, handler) => {
  if (!channel) throw new Error("RabbitMQ channel not ready");

  logger.info(`🔄 Starting to consume queue "${queue}"`);

  await channel.consume(queue, async (msg) => {
    if (!msg) return;
    try {
      const jobData = JSON.parse(msg.content.toString());
      await handler(jobData);
      channel.ack(msg);
      logger.info(`✅ Job completed and acknowledged`);
    } catch (error) {
      logger.error(`Job handler error: ${error.message}`);
      const shouldRequeue = !error.message.includes("PERMANENT");
      channel.nack(msg, false, shouldRequeue);
    }
  });
};

const getChannel = () => channel;
const getConnection = () => connection;

module.exports = {
  connectRabbitMQ,
  publishToQueue,
  consumeQueue,
  getChannel,
  getConnection,
  QUEUES,
};
