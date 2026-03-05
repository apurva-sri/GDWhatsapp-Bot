// Express server entry point
require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const { connectRabbitMQ } = require("./config/rabbitmq");
const { startDriveWorker } = require("./queues/driveWorker");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Connect to RabbitMQ
    await connectRabbitMQ();

    // Start the Drive worker
    await startDriveWorker();

    // Start the server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
