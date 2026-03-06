// Validate Twilio webhook signature
const twilio = require("twilio");
const logger = require("../utils/logger");

/**
 * Twilio Webhook Signature Validator
 *
 * WHY THIS EXISTS:
 * ────────────────
 * Your POST /api/whatsapp/webhook URL is PUBLIC — Twilio needs to reach it.
 * Without this middleware, ANYONE on the internet could POST fake WhatsApp
 * messages to your server and pretend to be any user. Very dangerous.
 *
 * HOW TWILIO SIGNING WORKS:
 * ─────────────────────────
 * When Twilio sends a webhook to your server, it:
 * 1. Takes your full webhook URL
 * 2. Sorts all POST params alphabetically and appends them to the URL
 * 3. Signs the result with your TWILIO_AUTH_TOKEN using HMAC-SHA1
 * 4. Sends the signature in the "X-Twilio-Signature" HTTP header
 *
 * Your server does the same calculation and compares the signatures.
 * If they match → request is genuinely from Twilio.
 * If they don't → someone is trying to spoof Twilio. Block them.
 *
 * IMPORTANT — URL MUST MATCH EXACTLY:
 * ─────────────────────────────────────
 * The URL used for signing must be the EXACT public URL Twilio sees.
 * e.g., https://abc123.ngrok.io/api/whatsapp/webhook
 *
 * This is why SERVER_URL must be set in your .env file.
 * A mismatch causes all valid requests to fail validation.
 *
 * DEVELOPMENT MODE:
 * ─────────────────
 * When NODE_ENV=development, signature validation is SKIPPED.
 * This lets you test locally with tools like Postman or ngrok
 * without needing to perfectly match the signature.
 * NEVER skip validation in production.
 */

const twilioValidator = (req, res, next) => {
  // ── Development bypass ──────────────────────────────────────
  if (process.env.NODE_ENV === "development") {
    logger.warn("⚠️  [DEV] Twilio signature validation skipped");
    return next();
  }

  // ── Guard: Check required env vars are configured ───────────
  // If these aren't set, validation will always fail or crash.
  // Better to catch it early with a clear error.
  if (!process.env.TWILIO_AUTH_TOKEN) {
    logger.error(
      "TWILIO_AUTH_TOKEN is not set in .env — cannot validate webhook",
    );
    return res.status(500).json({
      success: false,
      message: "Webhook validation misconfigured",
    });
  }

  if (!process.env.SERVER_URL) {
    logger.error(
      "SERVER_URL is not set in .env — cannot validate Twilio webhook URL",
    );
    return res.status(500).json({
      success: false,
      message: "SERVER_URL not configured",
    });
  }

  // ── Extract Twilio signature from request header ────────────
  const twilioSignature = req.headers["x-twilio-signature"];

  if (!twilioSignature) {
    // Header is missing entirely — definitely not from Twilio
    logger.warn(
      `Webhook request missing X-Twilio-Signature header | IP: ${req.ip}`,
    );
    return res.status(403).json({
      success: false,
      message: "Forbidden: Missing Twilio signature",
    });
  }

  // ── Build the exact URL Twilio signed ──────────────────────
  // Must match EXACTLY what you configured in Twilio console.
  // e.g., "https://yourdomain.com/api/whatsapp/webhook"
  const webhookUrl = `${process.env.SERVER_URL}/api/whatsapp/webhook`;

  // ── Validate the signature ──────────────────────────────────
  // twilio.validateRequest() replicates Twilio's signing algorithm
  // and returns true/false
  let isValid;
  try {
    isValid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      twilioSignature,
      webhookUrl,
      req.body, // The form-encoded POST params Twilio sent
    );
  } catch (validationError) {
    logger.error(
      `Twilio validation threw an error: ${validationError.message}`,
    );
    return res.status(403).json({
      success: false,
      message: "Webhook validation failed",
    });
  }

  if (!isValid) {
    logger.warn(
      `❌ Invalid Twilio signature | IP: ${req.ip} | URL used: ${webhookUrl}`,
    );
    return res.status(403).json({
      success: false,
      message: "Forbidden: Invalid Twilio signature",
    });
  }

  // ── Valid request — proceed ─────────────────────────────────
  logger.info(`✅ Twilio signature valid | From: ${req.body?.From}`);
  next();
};

module.exports = twilioValidator;
