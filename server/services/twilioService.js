// Twilio WhatsApp integration
const twilio = require("twilio");
const logger = require("../utils/logger");

/**
 * Twilio Service
 *
 * Handles all OUTBOUND WhatsApp messages (bot → user).
 *
 * Inbound messages come via webhook (Twilio → your server).
 * Outbound messages go via Twilio REST API (your server → Twilio → user).
 *
 * Rate limits to know:
 * - Twilio WhatsApp sandbox: ~1 message/second
 * - Twilio WhatsApp Business: higher limits based on tier
 * - Messages over 1600 chars are auto-split by WhatsApp
 */

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

/**
 * Send a WhatsApp text message to a user.
 *
 * @param {string} to   - Recipient number, e.g., "whatsapp:+919876543210"
 * @param {string} body - Message text (max ~1600 chars before WhatsApp splits it)
 * @returns {Promise<object>} Twilio message object
 */
const sendMessage = async (to, body) => {
  try {
    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER, // e.g., "whatsapp:+14155238886"
      to,
      body,
    });

    logger.info(`📤 WhatsApp sent to ${to} | SID: ${message.sid}`);
    return message;
  } catch (error) {
    logger.error(`Failed to send WhatsApp to ${to}: ${error.message}`);
    throw error;
  }
};

/**
 * Send a message with a media attachment (e.g., file download link).
 * Note: WhatsApp via Twilio supports media URLs, not direct file bytes.
 * The URL must be publicly accessible.
 *
 * @param {string} to       - Recipient number
 * @param {string} body     - Caption text
 * @param {string} mediaUrl - Public URL of the media file
 */
const sendMediaMessage = async (to, body, mediaUrl) => {
  try {
    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to,
      body,
      mediaUrl: [mediaUrl],
    });

    logger.info(`📤 WhatsApp media sent to ${to} | SID: ${message.sid}`);
    return message;
  } catch (error) {
    logger.error(`Failed to send WhatsApp media to ${to}: ${error.message}`);
    throw error;
  }
};

/**
 * Pre-built message templates used throughout the app.
 * Centralizing them here means we change wording in one place.
 */
const MESSAGES = {
  WELCOME: (name) =>
    `👋 Welcome to DriveBot, *${name}*!\n\nYou can now manage your Google Drive from WhatsApp.\n\nType *help* to see all available commands.`,

  HELP: () =>
    `📋 *DriveBot Commands*\n\n` +
    `📂 *list* — Show recent files\n` +
    `🔍 *search <name>* — Search files\n` +
    `⬆️ *upload* — Upload a file\n` +
    `🗑️ *delete <filename>* — Delete a file\n` +
    `🔗 *share <filename> <email>* — Share a file\n` +
    `ℹ️ *info <filename>* — File details & link\n\n` +
    `_Commands are case-insensitive_`,

  UPLOAD_PROMPT: () =>
    `📎 Please send the file you want to upload to Google Drive.\n\n_Send any file — PDF, image, document, etc._\n\nType *cancel* to abort.`,

  DELETE_CONFIRM: (fileName) =>
    `⚠️ Are you sure you want to delete *${fileName}*?\n\nReply *YES* to confirm or *NO* to cancel.\n\n_This cannot be undone._`,

  FILE_NOT_FOUND: (fileName) =>
    `❌ File not found: *${fileName}*\n\nTry *search ${fileName}* to look for it, or *list* to see all files.`,

  CANCEL: () => `✅ Cancelled. Type *help* to see available commands.`,

  RATE_LIMITED: (seconds) =>
    `⚠️ Too many commands. Please wait ${seconds} seconds.`,

  RE_AUTH_REQUIRED: (loginUrl) =>
    `🔐 Your Google session has expired. Please re-login:\n\n${loginUrl}\n\n_After logging in, try your command again._`,

  ERROR: () =>
    `❌ Something went wrong. Please try again in a moment.\n\nIf the issue persists, type *help*.`,

  UNKNOWN_COMMAND: (raw) =>
    `🤔 I don't understand "*${raw}*".\n\nType *help* to see all available commands.`,
};

module.exports = { sendMessage, sendMediaMessage, MESSAGES };