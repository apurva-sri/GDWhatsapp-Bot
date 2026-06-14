const logger = require("../utils/logger");
const { errorResponse } = require("../utils/responseFormatter");

// Global error handler
const errorHandler = (err, req, res, next) => {
  // Log the complete stack trace for server-side debugging
  logger.error(`${err.message}\nStack: ${err.stack}`);

  // In production, mask internal server error details (status >= 500)
  const isProduction = process.env.NODE_ENV === "production";
  const statusCode = err.status || err.statusCode || 500;
  
  let clientMessage = err.message || "Internal Server Error";
  if (isProduction && statusCode >= 500) {
    clientMessage = "An unexpected error occurred on the server. Please try again later.";
  }

  return errorResponse(res, clientMessage, statusCode);
};

module.exports = errorHandler;
