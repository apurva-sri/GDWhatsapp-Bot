// RabbitMQ consumer for processing Drive jobs
const { getChannel } = require("../config/rabbitmq");

const startDriveWorker = async () => {
  const channel = getChannel();
  const queue = "drive-jobs";
  await channel.assertQueue(queue);

  channel.consume(queue, async (msg) => {
    if (msg) {
      const jobData = JSON.parse(msg.content.toString());
      // Process job
      channel.ack(msg);
    }
  });
};

module.exports = {
  startDriveWorker,
};
