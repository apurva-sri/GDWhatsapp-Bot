// Verify JWT / session
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { errorResponse } = require("../utils/responseFormatter");
const { getCache } = require("../config/redis");
const logger = require("../utils/logger");


const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return null;
};

const isTokenRevoked = async (jti) => {
  if (!jti) return false;
  try {
    const hit = await getCache(`blocklist:${jti}`);
    return hit !== null;
  } catch {
    logger.warn("JWT blocklist check: Redis unavailable — allowing token");
    return false;
  }
};

const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return errorResponse(
        res,
        "Access denied. Please log in to continue.",
        401,
      );
    }

    let decoded;
    try {
      // Verify signature AND expiry. Algorithm is pinned to HS256 to prevent
      // the "alg:none" / RS256-confusion attacks.
      decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return errorResponse(res, "Session expired. Please log in again.", 401);
      }
      if (jwtError.name === "JsonWebTokenError") {
        return errorResponse(res, "Invalid token. Please log in again.", 401);
      }
      throw jwtError;
    }

    // Check JWT blocklist (populated by the logout endpoint)
    if (await isTokenRevoked(decoded.jti)) {
      return errorResponse(res, "Token has been revoked. Please log in again.", 401);
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      return errorResponse(
        res,
        "Account not found. Please sign up again.",
        401,
      );
    }

    // ── Step 4: Check account is active ───────────────────
    if (!user.isActive) {
      return errorResponse(
        res,
        "Your account has been deactivated. Contact support.",
        403,
      );
    }

    // ── Step 5: Check if Google re-auth is needed ──────────
    // This flag is set by tokenService when Google refresh token fails
    // (user revoked access from Google account settings)
    // We attach this to req so controllers can decide how to respond
    if (user.requiresReAuth) {
      req.requiresReAuth = true;
      // Don't block — let the controller decide (some routes don't need Drive)
    }

    // ── Step 6: Attach user and decoded token to request ──
    req.user = user;
    req.tokenPayload = decoded; // controllers can read jti for logout

    // Log userId only — not the email — to minimise PII in log lines.
    logger.info(
      `🔐 Authenticated: userId=${user._id} | Route: ${req.method} ${req.path}`,
    );
    next();
  } catch (error) {
    logger.error(`authMiddleware error: ${error.message}`);
    next(error); // Passes to global errorHandler
  }
};

// ─────────────────────────────────────────────────────────────────
// OPTIONAL AUTH — Attach user if token present, don't block if not
// Use this on routes that serve both guests and logged-in users
// Example: a public file preview page that shows extra options if logged in
// ─────────────────────────────────────────────────────────────────
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      req.user = null;
      return next(); // No token — continue as guest
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });

    // Also honour the blocklist for optional routes
    if (await isTokenRevoked(decoded.jti)) {
      req.user = null;
      return next();
    }

    const user = await User.findById(decoded.userId);
    req.user = user && user.isActive ? user : null;
    req.tokenPayload = decoded;
    next();
  } catch (error) {
    // Invalid token — treat as guest, don't block
    req.user = null;
    next();
  }
};

module.exports = { protect, optionalAuth };
