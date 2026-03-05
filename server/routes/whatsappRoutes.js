// WhatsApp webhook routes
const express = require("express");
const whatsappController = require("../controllers/whatsappController");
const twilioValidator = require("../middlewares/twilioValidator");

const router = express.Router();

router.post(
  "/webhook",
  twilioValidator,
  whatsappController.handleIncomingMessage,
);
router.post("/send", whatsappController.sendMessage);

module.exports = router;
