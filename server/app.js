const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const errorHandler = require("./middlewares/errorHandler");
const { apiRateLimiter } = require("./middlewares/rateLimiter");
const logger = require("./utils/logger");

const app = express();

// ─── Security Middlewares ──────────────────────────────────────

/**
 * helmet: Sets secure HTTP headers automatically
 * Protects against: XSS, clickjacking, MIME sniffing, etc.
 * It's like a seatbelt — always wear it.
 */
app.use(helmet());

/**
 * cors: Cross-Origin Resource Sharing
 * Allows your React frontend (localhost:5173) to call this API (localhost:5000)
 * Without CORS, browsers block cross-origin requests by default
 */
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true, // Allow cookies
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ─── Request Parsing ───────────────────────────────────────────
app.use(express.json({ limit: "10mb" })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// urlencoded needed for Twilio webhooks (they POST form-encoded data)

// ─── Logging ───────────────────────────────────────────────────
// morgan logs every HTTP request: method, url, status, response time
app.use(morgan("dev", { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ─── Rate Limiting ─────────────────────────────────────────────
app.use("/api", apiRateLimiter);

// ─── Health Check ──────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Routes ────────────────────────────────────────────────────
// Each route file handles a specific domain of the app
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/drive", require("./routes/driveRoutes"));
app.use("/api/whatsapp", require("./routes/whatsappRoutes"));

// ─── 404 Handler ───────────────────────────────────────────────
app.use("*", (req, res) => {
  res
    .status(404)
    .json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Global Error Handler ──────────────────────────────────────
// MUST be last — Express identifies error handlers by 4 parameters
app.use(errorHandler);

module.exports = app;
