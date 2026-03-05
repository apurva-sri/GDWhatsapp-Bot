// RabbitMQ connection setup
const amqp = require("amqplib");

let connection;
let channel;

const connectRabbitMQ = async () => {
  try {
    connection = await amqp.connect(
      process.env.RABBITMQ_URL || "amqp://localhost",
    );
    channel = await connection.createChannel();
    console.log("RabbitMQ connected");
  } catch (error) {
    console.error("RabbitMQ connection error:", error);
    setTimeout(connectRabbitMQ, 5000);
  }
};

module.exports = {
  connectRabbitMQ,
  getChannel: () => channel,
  getConnection: () => connection,
};
