// WhatsApp webhook routes
const router = require("express").Router();
const { handleIncoming } = require("../controllers/whatsappController");
const twilioValidator = require("../middlewares/twilioValidator");

// POST /api/whatsapp/webhook
// Twilio calls this on every incoming WhatsApp message
router.post("/webhook", twilioValidator, handleIncoming);

module.exports = router;