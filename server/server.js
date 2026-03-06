require("dotenv").config(); // Load .env FIRST before anything else

const app = require("./app");
const connectDB = require("./config/db");
const { connectRedis } = require("./config/redis");
const { connectRabbitMQ } = require("./config/rabbitmq");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 5000;

/**
 * Server Startup Sequence
 *
 * Order matters:
 * 1. Connect to all services first
 * 2. Only then start listening for requests
 *
 * If DB/Redis aren't ready and we start accepting requests,
 * the first few requests would fail — bad UX.
 */
const startServer = async () => {
  try {
    logger.info("🚀 Starting DriveBot server...");

    // Connect to all services concurrently (faster startup)
    await Promise.all([connectDB(), connectRedis()]);

    // RabbitMQ has its own retry logic, connect separately
    await connectRabbitMQ();

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`✅ Server running on http://localhost:${PORT}`);
      logger.info(`📋 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Handle unhandled promise rejections (safety net)
process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

// Graceful shutdown on SIGTERM (Docker stop signal)
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully...");
  process.exit(0);
});

startServer();
