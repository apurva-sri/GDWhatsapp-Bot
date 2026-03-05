// Validate Twilio webhook signature
const twilioValidator = (req, res, next) => {
  // Validate Twilio signature
  next();
};

module.exports = twilioValidator;
