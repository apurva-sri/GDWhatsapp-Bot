// Twilio WhatsApp integration
const twilio = require("twilio");

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

const sendWhatsAppMessage = async (to, body) => {
  // Send WhatsApp message via Twilio
};

module.exports = {
  sendWhatsAppMessage,
};
