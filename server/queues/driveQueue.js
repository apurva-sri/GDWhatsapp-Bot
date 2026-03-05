// RabbitMQ producer for Drive jobs
const { getChannel } = require("../config/rabbitmq");

const enqueueDriveJob = async (jobData) => {
  const channel = getChannel();
  const queue = "drive-jobs";
  await channel.assertQueue(queue);
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(jobData)));
};

module.exports = {
  enqueueDriveJob,
};
