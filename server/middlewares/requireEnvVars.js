const logger = require("../utils/logger");

const REQUIRED_ENV_VARS = [
  "PORT",
  "MONGODB_URI",
  "REDIS_URL",
  "RABBITMQ_URI",
  "JWT_SECRET",
  "ENCRYPTION_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_NUMBER",
  "CLIENT_URL",
  "SERVER_URL",
];

const checkEnvVars = () => {
  const missing = [];
  
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    logger.error(`❌ CRITICAL STARTUP ERROR: Missing environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  // Entropy checks
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    logger.error("❌ CRITICAL STARTUP ERROR: JWT_SECRET must be at least 32 characters long to prevent brute-force attacks.");
    process.exit(1);
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length < 32) {
    logger.error("❌ CRITICAL STARTUP ERROR: ENCRYPTION_KEY must be at least 32 characters (256 bits) for AES-256 encryption.");
    process.exit(1);
  }

  logger.info("🛡️ Environment variable security and existence checks passed.");
};

module.exports = { checkEnvVars };
