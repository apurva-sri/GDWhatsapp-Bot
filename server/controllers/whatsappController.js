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
      await User.findByIdAndUpdate(user._id, {
        whatsappNumber: from,
        whatsappLinkedAt: user.whatsappLinkedAt || new Date(),
      });
      user.whatsappNumber = from; // update in-memory too
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
    logger.info(
      `🔄 Command parsed: ${parsed.command} | User: ${user._id} | Params: ${JSON.stringify(parsed.params)}`,
    );
    const log = await CommandLog.startLog(
      user._id,
      from,
      rawText,
      parsed.command,
      parsed.params,
    );
    if (messageSid) log.twilioMessageSid = messageSid;
    await log.save();
    logger.info(`📝 CommandLog saved: ${log._id}`);

    const startTime = Date.now();

    try {
      logger.info(`⚙️ Executing command: ${parsed.command}`);
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
      logger.info(
        `✅ Command completed successfully: ${parsed.command} | Duration: ${Date.now() - startTime}ms`,
      );
      await user.incrementStat();
    } catch (cmdError) {
      logger.error(
        `❌ Command error: ${parsed.command} | Error: ${cmdError.message} | Duration: ${Date.now() - startTime}ms`,
      );
      if (cmdError.message === "TOKEN_REFRESH_FAILED") {
        logger.warn(`🔐 TOKEN_REFRESH_FAILED for user: ${user._id}`);
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
      logger.debug(`📚 HELP command requested by: ${user._id}`);
      const msg = MESSAGES.HELP();
      await sendMessage(from, msg);
      log.responseMessage = msg;
      break;
    }

    case COMMANDS.LIST: {
      logger.debug(`📄 LIST command requested by: ${user._id}`);
      await sendMessage(from, "⏳ Fetching your Drive files...");
      const files = await driveService.listFiles(user._id);
      const msg = formatFileList(files);
      await sendMessage(from, msg);
      log.responseMessage = msg;
      break;
    }

    case COMMANDS.SEARCH: {
      logger.debug(
        `🔍 SEARCH command requested by: ${user._id} | Query: ${params.query}`,
      );
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
      logger.debug(
        `📤 UPLOAD command requested by: ${user._id} | Media: ${numMedia}`,
      );
      if (numMedia && parseInt(numMedia) > 0 && mediaUrl) {
        // File already attached — queue it via RabbitMQ (Fix Issue 6)
        logger.info(
          `📎 File attached to upload | User: ${user._id} | MimeType: ${mediaMimeType}`,
        );
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
      logger.debug(
        `🗑️ DELETE command requested by: ${user._id} | FileName: ${params.fileName}`,
      );
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
      logger.debug(
        `📧 SHARE command requested by: ${user._id} | FileName: ${params.fileName} | Email: ${params.email || "pending"}`,
      );
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
      logger.debug(
        `ℹ️ INFO command requested by: ${user._id} | FileName: ${params.fileName}`,
      );
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
      logger.warn(
        `⚠️ UNKNOWN_COMMAND received from: ${user._id} | Raw: ${parsed.raw}`,
      );
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
  logger.info(
    `📍 Session continuation: State=${session.state} | User=${user._id} | Message="${rawText}"`,
  );
  if (rawText.toLowerCase() === "cancel") {
    logger.info(
      `❌ User cancelled session: ${session.state} | User: ${user._id}`,
    );
    await resetSession(from);
    await sendMessage(from, MESSAGES.CANCEL());
    return;
  }

  switch (session.state) {
    case SESSION_STATES.AWAITING_FILE: {
      logger.debug(`📎 Awaiting file: User=${user._id} | Media=${numMedia}`);
      if (numMedia && parseInt(numMedia) > 0 && mediaUrl) {
        logger.info(
          `📥 File received in session continuation | User: ${user._id} | MimeType: ${mediaMimeType}`,
        );
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
      logger.debug(
        `🗑️ Awaiting delete confirmation: User=${user._id} | FileName=${session.context.fileName}`,
      );
      const answer = parseConfirmation(rawText);
      const { fileId, fileName } = session.context;

      if (answer === "yes") {
        logger.info(
          `✅ Delete confirmed: User=${user._id} | FileId=${fileId} | FileName=${fileName}`,
        );
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
          logger.info(
            `🗑️ File deleted successfully: User=${user._id} | FileId=${fileId}`,
          );
          await resetSession(from);
          const msg = `✅ *${fileName}* has been moved to trash.`;
          await sendMessage(from, msg);
          await log.complete(msg, Date.now() - start, fileId);
          await user.incrementStat("totalDeletes");
        } catch (e) {
          logger.error(
            `❌ Delete failed: User=${user._id} | FileId=${fileId} | Error=${e.message}`,
          );
          await log.fail(e.message, Date.now() - start);
          await resetSession(from);
          await sendMessage(from, MESSAGES.ERROR());
        }
      } else if (answer === "no") {
        logger.info(
          `❌ Delete cancelled by user: User=${user._id} | FileName=${fileName}`,
        );
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
      logger.debug(
        `📧 Awaiting share email: User=${user._id} | FileName=${session.context.fileName}`,
      );
      const { fileId, fileName } = session.context;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (emailRegex.test(rawText.trim())) {
        const email = rawText.trim();
        logger.info(
          `📧 Valid email received for share: User=${user._id} | Email=${email} | FileName=${fileName}`,
        );
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
          logger.info(
            `✅ File shared successfully: User=${user._id} | FileId=${fileId} | SharedWith=${email}`,
          );
          await resetSession(from);
          const msg = `✅ *${fileName}* shared with *${email}*.`;
          await sendMessage(from, msg);
          await log.complete(msg, Date.now() - start, fileId);
          await user.incrementStat();
        } catch (e) {
          logger.error(
            `❌ Share failed: User=${user._id} | FileId=${fileId} | Email=${email} | Error=${e.message}`,
          );
          await log.fail(e.message, Date.now() - start);
          await resetSession(from);
          await sendMessage(from, MESSAGES.ERROR());
        }
      } else {
        logger.warn(
          `⚠️ Invalid email format received: User=${user._id} | Input=${rawText}`,
        );
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
    logger.info(
      `📤 Queuing file upload via RabbitMQ: User=${user._id} | MimeType=${mediaMimeType} | CommandLogId=${log._id}`,
    );
    queueFileUpload({
      userId: user._id.toString(),
      whatsappFrom: from,
      mediaUrl,
      mediaMimeType,
      commandLogId: log._id.toString(),
    });

    log.responseMessage = "Upload queued";
    logger.info(`✅ Upload job queued successfully for user ${user._id}`);
  } catch (error) {
    logger.error(`❌ Failed to queue upload for ${user._id}: ${error.message}`);
    logger.warn(`⚠️ Falling back to direct upload for user ${user._id}`);
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
  logger.warn(
    `⚠️ Direct upload in progress (RabbitMQ unavailable): User=${user._id}`,
  );
  await sendMessage(from, "⏳ Uploading your file to Google Drive...");
  const ext = mediaMimeType ? mediaMimeType.split("/")[1] : "file";
  const fileName = `WhatsApp_Upload_${Date.now()}.${ext}`;
  logger.info(
    `📤 Starting direct file upload: User=${user._id} | FileName=${fileName} | MimeType=${mediaMimeType}`,
  );
  const uploadedFile = await driveService.uploadFile(
    user._id,
    mediaUrl,
    fileName,
    mediaMimeType,
  );
  logger.info(
    `✅ File uploaded successfully (direct): User=${user._id} | FileId=${uploadedFile.id} | FileName=${uploadedFile.name}`,
  );
  const msg = `✅ *${uploadedFile.name}* uploaded!\n\n🔗 ${uploadedFile.webViewLink || "Link unavailable"}`;
  await sendMessage(from, msg);
  log.responseMessage = msg;
  log.driveFileId = uploadedFile.id;
};

module.exports = { handleIncoming };
