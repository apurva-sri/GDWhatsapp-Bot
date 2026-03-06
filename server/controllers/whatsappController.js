const User = require("../models/User");
const CommandLog = require("../models/CommandLog");
const {
  parseCommand,
  parseConfirmation,
  formatFileList,
  formatFileSize,
  getMimeIcon,
  COMMANDS,
} = require("../services/commandParser");
const {
  getOrCreateSession,
  updateSession,
  resetSession,
  SESSION_STATES,
} = require("../services/sessionService");
const { sendMessage, MESSAGES } = require("../services/twilioService");
const { whatsappRateLimiter } = require("../middlewares/rateLimiter");
const driveService = require("../services/googleDriveService");
// Fix Issue 6: import queue producer so uploads go through RabbitMQ
const { queueFileUpload } = require("../queues/driveQueue");
const logger = require("../utils/logger");

const handleIncoming = async (req, res) => {
  // Respond 200 immediately — Twilio times out after 5s
  res.status(200).send("OK");

  const {
    From: from,
    Body: body = "",
    NumMedia: numMedia,
    MediaUrl0: mediaUrl,
    MediaContentType0: mediaMimeType,
    MessageSid: messageSid,
  } = req.body;

  const rawText = body.trim();
  logger.info(
    `📩 WA Incoming | From: ${from} | Body: "${rawText}" | Media: ${numMedia}`,
  );

  try {
    // ── Rate limit ──────────────────────────────────────────
    const rateLimit = await whatsappRateLimiter(from);
    if (!rateLimit.allowed) {
      await sendMessage(from, rateLimit.message);
      return;
    }

    // ── Find user ───────────────────────────────────────────
    let user = await User.findByWhatsApp(from);

    if (!user) {
      await sendMessage(
        from,
        `👋 Hi! To use DriveBot, please sign in first:\n\n${process.env.CLIENT_URL}\n\n_It only takes 30 seconds._`,
      );
      return;
    }

    // ── Re-auth check ───────────────────────────────────────
    if (user.requiresReAuth) {
      await sendMessage(
        from,
        MESSAGES.RE_AUTH_REQUIRED(process.env.CLIENT_URL),
      );
      return;
    }

    // ── Link WhatsApp number on first message ───────────────
    if (!user.whatsappNumber || user.whatsappNumber !== from) {
      user.whatsappNumber = from;
      user.whatsappLinkedAt = user.whatsappLinkedAt || new Date();
      await user.save();
    }

    // ── Load session ─────────────────────────────────────────
    const session = await getOrCreateSession(from, user._id);

    // ── Multi-step continuation ──────────────────────────────
    if (session.state !== SESSION_STATES.IDLE) {
      await handleSessionContinuation(
        user,
        session,
        rawText,
        numMedia,
        mediaUrl,
        mediaMimeType,
        messageSid,
        from,
      );
      return;
    }

    // ── Parse and execute new command ───────────────────────
    const parsed = parseCommand(rawText);
    const log = await CommandLog.startLog(
      user._id,
      from,
      rawText,
      parsed.command,
      parsed.params,
    );
    if (messageSid) log.twilioMessageSid = messageSid;
    await log.save();

    const startTime = Date.now();

    try {
      await executeCommand(
        user,
        session,
        parsed,
        numMedia,
        mediaUrl,
        mediaMimeType,
        from,
        log,
      );
      await log.complete(
        log.responseMessage,
        Date.now() - startTime,
        log.driveFileId,
      );
      await user.incrementStat();
    } catch (cmdError) {
      logger.error(`Command error: ${cmdError.message}`);
      if (cmdError.message === "TOKEN_REFRESH_FAILED") {
        await user.flagReAuth();
        await sendMessage(
          from,
          MESSAGES.RE_AUTH_REQUIRED(process.env.CLIENT_URL),
        );
      } else {
        await sendMessage(from, MESSAGES.ERROR());
      }
      await log.fail(cmdError.message, Date.now() - startTime);
    }
  } catch (error) {
    logger.error(`handleIncoming fatal: ${error.message}`, {
      stack: error.stack,
    });
    try {
      await sendMessage(from, MESSAGES.ERROR());
    } catch (_) {}
  }
};

// ─── Command Executor ─────────────────────────────────────────────
const executeCommand = async (
  user,
  session,
  parsed,
  numMedia,
  mediaUrl,
  mediaMimeType,
  from,
  log,
) => {
  const { command, params, error: parseError } = parsed;

  if (parseError) {
    const msg = `⚠️ ${parseError}`;
    await sendMessage(from, msg);
    log.responseMessage = msg;
    return;
  }

  switch (command) {
    case COMMANDS.HELP: {
      const msg = MESSAGES.HELP();
      await sendMessage(from, msg);
      log.responseMessage = msg;
      break;
    }

    case COMMANDS.LIST: {
      await sendMessage(from, "⏳ Fetching your Drive files...");
      const files = await driveService.listFiles(user._id);
      const msg = formatFileList(files);
      await sendMessage(from, msg);
      log.responseMessage = msg;
      break;
    }

    case COMMANDS.SEARCH: {
      await sendMessage(from, `🔍 Searching for "*${params.query}*"...`);
      const files = await driveService.searchFiles(user._id, params.query);
      const msg =
        files.length > 0
          ? formatFileList(files)
          : `❌ No files found matching "*${params.query}*".\n\nTry *list* to see all files.`;
      await sendMessage(from, msg);
      log.responseMessage = msg;
      break;
    }

    case COMMANDS.UPLOAD: {
      if (numMedia && parseInt(numMedia) > 0 && mediaUrl) {
        // File already attached — queue it via RabbitMQ (Fix Issue 6)
        await handleFileUploadQueued(
          user,
          mediaUrl,
          mediaMimeType,
          messageSid,
          from,
          log,
        );
      } else {
        await updateSession(from, SESSION_STATES.AWAITING_FILE, {});
        const msg = MESSAGES.UPLOAD_PROMPT();
        await sendMessage(from, msg);
        log.responseMessage = msg;
      }
      break;
    }

    case COMMANDS.DELETE: {
      const file = await driveService.getFileInfo(user._id, params.fileName);
      if (!file) {
        const msg = MESSAGES.FILE_NOT_FOUND(params.fileName);
        await sendMessage(from, msg);
        log.responseMessage = msg;
        break;
      }
      await updateSession(from, SESSION_STATES.AWAITING_DELETE_CONFIRM, {
        fileId: file.id,
        fileName: file.name,
      });
      const msg = MESSAGES.DELETE_CONFIRM(file.name);
      await sendMessage(from, msg);
      log.responseMessage = msg;
      break;
    }

    case COMMANDS.SHARE: {
      const file = await driveService.getFileInfo(user._id, params.fileName);
      if (!file) {
        const msg = MESSAGES.FILE_NOT_FOUND(params.fileName);
        await sendMessage(from, msg);
        log.responseMessage = msg;
        break;
      }
      if (!params.email) {
        await updateSession(from, SESSION_STATES.AWAITING_SHARE_EMAIL, {
          fileId: file.id,
          fileName: file.name,
        });
        const msg = `📧 Who do you want to share *${file.name}* with?\n\nReply with their email address.`;
        await sendMessage(from, msg);
        log.responseMessage = msg;
        break;
      }
      await driveService.shareFile(user._id, file.id, params.email);
      const msg = `✅ *${file.name}* shared with ${params.email}.`;
      await sendMessage(from, msg);
      log.responseMessage = msg;
      log.driveFileId = file.id;
      break;
    }

    case COMMANDS.INFO: {
      const file = await driveService.getFileInfo(user._id, params.fileName);
      if (!file) {
        const msg = MESSAGES.FILE_NOT_FOUND(params.fileName);
        await sendMessage(from, msg);
        log.responseMessage = msg;
        break;
      }
      const icon = getMimeIcon(file.mimeType);
      const size = file.size
        ? formatFileSize(parseInt(file.size))
        : "N/A (Google Doc)";
      const modified = file.modifiedTime
        ? new Date(file.modifiedTime).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "Unknown";
      const msg =
        `${icon} *${file.name}*\n\n` +
        `📦 Size: ${size}\n` +
        `📅 Modified: ${modified}\n` +
        `🔗 Link: ${file.webViewLink || "Not available"}`;
      await sendMessage(from, msg);
      log.responseMessage = msg;
      log.driveFileId = file.id;
      break;
    }

    default: {
      const msg = MESSAGES.UNKNOWN_COMMAND(parsed.raw);
      await sendMessage(from, msg);
      log.responseMessage = msg;
      break;
    }
  }
};

// ─── Session Continuation ─────────────────────────────────────────
const handleSessionContinuation = async (
  user,
  session,
  rawText,
  numMedia,
  mediaUrl,
  mediaMimeType,
  messageSid,
  from,
) => {
  if (rawText.toLowerCase() === "cancel") {
    await resetSession(from);
    await sendMessage(from, MESSAGES.CANCEL());
    return;
  }

  switch (session.state) {
    case SESSION_STATES.AWAITING_FILE: {
      if (numMedia && parseInt(numMedia) > 0 && mediaUrl) {
        await resetSession(from);
        const log = await CommandLog.startLog(
          user._id,
          from,
          "[file attachment]",
          COMMANDS.UPLOAD,
          {},
        );
        await log.save();
        await handleFileUploadQueued(
          user,
          mediaUrl,
          mediaMimeType,
          messageSid,
          from,
          log,
        );
      } else {
        await sendMessage(
          from,
          `📎 I'm waiting for a file.\n\nPlease send a file, or type *cancel* to abort.`,
        );
      }
      break;
    }

    case SESSION_STATES.AWAITING_DELETE_CONFIRM: {
      const answer = parseConfirmation(rawText);
      const { fileId, fileName } = session.context;

      if (answer === "yes") {
        await sendMessage(from, `⏳ Deleting *${fileName}*...`);
        const log = await CommandLog.startLog(
          user._id,
          from,
          rawText,
          COMMANDS.DELETE,
          { fileName },
        );
        await log.save();
        const start = Date.now();
        try {
          await driveService.deleteFile(user._id, fileId);
          await resetSession(from);
          const msg = `✅ *${fileName}* has been moved to trash.`;
          await sendMessage(from, msg);
          await log.complete(msg, Date.now() - start, fileId);
          await user.incrementStat("totalDeletes");
        } catch (e) {
          await log.fail(e.message, Date.now() - start);
          await resetSession(from);
          await sendMessage(from, MESSAGES.ERROR());
        }
      } else if (answer === "no") {
        await resetSession(from);
        await sendMessage(from, `✅ Delete cancelled. *${fileName}* is safe.`);
      } else {
        await sendMessage(
          from,
          `Please reply *YES* to confirm or *NO* to cancel.\n\nDeleting: *${fileName}*`,
        );
      }
      break;
    }

    case SESSION_STATES.AWAITING_SHARE_EMAIL: {
      const { fileId, fileName } = session.context;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (emailRegex.test(rawText.trim())) {
        const email = rawText.trim();
        const log = await CommandLog.startLog(
          user._id,
          from,
          rawText,
          COMMANDS.SHARE,
          { fileName, email },
        );
        await log.save();
        const start = Date.now();
        try {
          await driveService.shareFile(user._id, fileId, email);
          await resetSession(from);
          const msg = `✅ *${fileName}* shared with *${email}*.`;
          await sendMessage(from, msg);
          await log.complete(msg, Date.now() - start, fileId);
          await user.incrementStat();
        } catch (e) {
          await log.fail(e.message, Date.now() - start);
          await resetSession(from);
          await sendMessage(from, MESSAGES.ERROR());
        }
      } else {
        await sendMessage(
          from,
          `❌ Invalid email address.\n\nPlease send a valid email to share *${fileName}*, or type *cancel*.`,
        );
      }
      break;
    }

    default: {
      await resetSession(from);
      await sendMessage(from, MESSAGES.ERROR());
      break;
    }
  }
};

// ─── File Upload via RabbitMQ Queue ──────────────────────────────
// Fix Issue 6: uploads now go through RabbitMQ instead of inline
// Worker (driveWorker.js) picks up the job and does the actual upload
const handleFileUploadQueued = async (
  user,
  mediaUrl,
  mediaMimeType,
  messageSid,
  from,
  log,
) => {
  try {
    // Acknowledge immediately to user
    await sendMessage(
      from,
      "⏳ Your file is being uploaded to Google Drive...\n\n_You'll get a confirmation when it's done._",
    );

    // Push job to RabbitMQ — worker handles the actual upload
    queueFileUpload({
      userId: user._id.toString(),
      whatsappFrom: from,
      mediaUrl,
      mediaMimeType,
      commandLogId: log._id.toString(),
    });

    log.responseMessage = "Upload queued";
    logger.info(`Upload job queued for user ${user._id}`);
  } catch (error) {
    logger.error(`Failed to queue upload for ${user._id}: ${error.message}`);
    // Fallback: try direct upload if queue fails
    await handleFileUploadDirect(user, mediaUrl, mediaMimeType, from, log);
  }
};

// ─── Direct Upload Fallback ───────────────────────────────────────
// Used when RabbitMQ is unavailable (startup, connection loss)
const handleFileUploadDirect = async (
  user,
  mediaUrl,
  mediaMimeType,
  from,
  log,
) => {
  await sendMessage(from, "⏳ Uploading your file to Google Drive...");
  const ext = mediaMimeType ? mediaMimeType.split("/")[1] : "file";
  const fileName = `WhatsApp_Upload_${Date.now()}.${ext}`;
  const uploadedFile = await driveService.uploadFile(
    user._id,
    mediaUrl,
    fileName,
    mediaMimeType,
  );
  const msg = `✅ *${uploadedFile.name}* uploaded!\n\n🔗 ${uploadedFile.webViewLink || "Link unavailable"}`;
  await sendMessage(from, msg);
  log.responseMessage = msg;
  log.driveFileId = uploadedFile.id;
};

module.exports = { handleIncoming };
