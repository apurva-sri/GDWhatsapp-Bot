// Parse WhatsApp commands
/**
 * Command Parser Service
 *
 * Takes raw WhatsApp message text and returns a structured command object.
 *
 * WHY A SEPARATE FILE?
 * ────────────────────
 * The webhook controller shouldn't care about string parsing.
 * Keeping parsing isolated means:
 * - Easy to add new commands without touching the controller
 * - Easy to unit test parsing logic independently
 * - Clean separation of concerns
 *
 * SUPPORTED COMMANDS:
 * ─────────────────────────────────────────────────────────────
 *  list                           → list recent Drive files
 *  search <query>                 → search files by name
 *  upload                         → bot asks user to send a file
 *  delete <filename>              → delete a file (asks confirmation)
 *  share <filename> <email>       → share a file with someone
 *  info <filename>                → get file details + link
 *  help                           → show all commands
 *
 * All commands are case-insensitive.
 * Extra spaces are trimmed.
 */

const COMMANDS = {
  LIST:   "list",
  SEARCH: "search",
  UPLOAD: "upload",
  DELETE: "delete",
  SHARE:  "share",
  INFO:   "info",
  HELP:   "help",
  UNKNOWN: "unknown",
};

/**
 * Parse a raw WhatsApp message into a command object.
 *
 * @param {string} rawText - The raw message text from WhatsApp
 * @returns {{ command: string, params: object, raw: string }}
 *
 * Examples:
 *   "list"                    → { command: "list",   params: {} }
 *   "search budget"           → { command: "search", params: { query: "budget" } }
 *   "delete Q3 Report.pdf"    → { command: "delete", params: { fileName: "Q3 Report.pdf" } }
 *   "share doc.pdf a@b.com"   → { command: "share",  params: { fileName: "doc.pdf", email: "a@b.com" } }
 *   "info notes.docx"         → { command: "info",   params: { fileName: "notes.docx" } }
 *   "hello"                   → { command: "unknown", params: {} }
 */
const parseCommand = (rawText) => {
  if (!rawText || typeof rawText !== "string") {
    return { command: COMMANDS.UNKNOWN, params: {}, raw: "" };
  }

  // Normalize: lowercase, collapse multiple spaces, trim
  const text = rawText.trim().replace(/\s+/g, " ");
  const lower = text.toLowerCase();

  // Split into [keyword, ...rest]
  const parts = text.split(" ");
  const keyword = parts[0].toLowerCase();
  const rest = parts.slice(1).join(" ").trim(); // everything after the first word

  // ── list ──────────────────────────────────────────────────────
  if (keyword === "list") {
    return { command: COMMANDS.LIST, params: {}, raw: text };
  }

  // ── help ──────────────────────────────────────────────────────
  if (keyword === "help" || lower === "hi" || lower === "hello" || lower === "start") {
    return { command: COMMANDS.HELP, params: {}, raw: text };
  }

  // ── upload ────────────────────────────────────────────────────
  if (keyword === "upload") {
    return { command: COMMANDS.UPLOAD, params: {}, raw: text };
  }

  // ── search <query> ────────────────────────────────────────────
  // "search quarterly report" → params.query = "quarterly report"
  if (keyword === "search") {
    if (!rest) {
      return {
        command: COMMANDS.SEARCH,
        params: {},
        raw: text,
        error: "Please provide a search term. Example: search budget 2024",
      };
    }
    return { command: COMMANDS.SEARCH, params: { query: rest }, raw: text };
  }

  // ── delete <filename> ─────────────────────────────────────────
  // "delete Q3 Report.pdf" → params.fileName = "Q3 Report.pdf"
  if (keyword === "delete" || keyword === "del" || keyword === "remove") {
    if (!rest) {
      return {
        command: COMMANDS.DELETE,
        params: {},
        raw: text,
        error: "Please provide a filename. Example: delete report.pdf",
      };
    }
    return { command: COMMANDS.DELETE, params: { fileName: rest }, raw: text };
  }

  // ── share <filename> <email> ──────────────────────────────────
  // "share report.pdf alice@gmail.com"
  // Strategy: last token that looks like an email = the email,
  //           everything before it = filename
  if (keyword === "share") {
    if (!rest) {
      return {
        command: COMMANDS.SHARE,
        params: {},
        raw: text,
        error: "Please provide a filename and email. Example: share report.pdf alice@gmail.com",
      };
    }

    const tokens = rest.split(" ");
    const lastToken = tokens[tokens.length - 1];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailRegex.test(lastToken)) {
      const fileName = tokens.slice(0, -1).join(" ");
      if (!fileName) {
        return {
          command: COMMANDS.SHARE,
          params: { email: lastToken },
          raw: text,
          error: "Please provide a filename. Example: share report.pdf alice@gmail.com",
        };
      }
      return {
        command: COMMANDS.SHARE,
        params: { fileName, email: lastToken },
        raw: text,
      };
    }

    // Email not found in message — we have the filename, will ask for email
    return {
      command: COMMANDS.SHARE,
      params: { fileName: rest },
      raw: text,
      error: "Please include an email address. Example: share report.pdf alice@gmail.com",
    };
  }

  // ── info <filename> ───────────────────────────────────────────
  // "info Q3 Report.pdf" → params.fileName = "Q3 Report.pdf"
  if (keyword === "info" || keyword === "details") {
    if (!rest) {
      return {
        command: COMMANDS.INFO,
        params: {},
        raw: text,
        error: "Please provide a filename. Example: info report.pdf",
      };
    }
    return { command: COMMANDS.INFO, params: { fileName: rest }, raw: text };
  }

  // ── Unknown command ───────────────────────────────────────────
  return { command: COMMANDS.UNKNOWN, params: {}, raw: text };
};

/**
 * Check if a message is a confirmation response (YES/NO).
 * Used for delete confirmation and other two-step flows.
 *
 * @param {string} text
 * @returns {"yes" | "no" | null}
 */
const parseConfirmation = (text) => {
  if (!text) return null;
  const lower = text.trim().toLowerCase();

  const YES_WORDS = ["yes", "y", "confirm", "ok", "sure", "yep", "yeah", "delete it", "do it"];
  const NO_WORDS  = ["no", "n", "cancel", "nope", "stop", "abort", "nevermind", "never mind"];

  if (YES_WORDS.includes(lower)) return "yes";
  if (NO_WORDS.includes(lower))  return "no";
  return null;
};

/**
 * Format file size from bytes to human-readable string.
 * Used in "info" command responses.
 */
const formatFileSize = (bytes) => {
  if (!bytes) return "Unknown size";
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Format a Drive file list into a WhatsApp-friendly string.
 * WhatsApp doesn't support markdown tables, so we use plain text.
 */
const formatFileList = (files) => {
  if (!files || files.length === 0) {
    return "📂 Your Drive is empty or no files found.";
  }

  const lines = files.map((f, i) => {
    const icon = getMimeIcon(f.mimeType);
    const size = f.size ? ` (${formatFileSize(parseInt(f.size))})` : "";
    return `${i + 1}. ${icon} ${f.name}${size}`;
  });

  return `📂 *Your Drive Files*\n\n${lines.join("\n")}\n\n_Reply with a command like: delete filename.pdf_`;
};

/**
 * Map MIME type to an emoji icon for WhatsApp messages.
 */
const getMimeIcon = (mimeType) => {
  if (!mimeType) return "📄";
  if (mimeType.includes("pdf"))            return "📕";
  if (mimeType.includes("image"))          return "🖼️";
  if (mimeType.includes("video"))          return "🎥";
  if (mimeType.includes("audio"))          return "🎵";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📊";
  if (mimeType.includes("document") || mimeType.includes("word")) return "📝";
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return "🗜️";
  if (mimeType.includes("folder"))         return "📁";
  return "📄";
};

module.exports = {
  parseCommand,
  parseConfirmation,
  formatFileList,
  formatFileSize,
  getMimeIcon,
  COMMANDS,
};
