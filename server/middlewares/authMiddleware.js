// Verify JWT / session
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { errorResponse } = require("../utils/responseFormatter");
const logger = require("../utils/logger");

/**
 * Auth Middleware
 *
 * HOW JWT AUTHENTICATION WORKS IN THIS APP:
 * ──────────────────────────────────────────
 * 1. User clicks "Sign in with Google" on frontend
 * 2. Google redirects to our /api/auth/google/callback with a code
 * 3. We exchange that code for Google tokens, save them encrypted in MongoDB
 * 4. We create OUR OWN JWT (has nothing to do with Google)
 *    JWT payload: { userId: "mongo_id", email: "user@gmail.com" }
 *    JWT is signed with JWT_SECRET from .env
 * 5. We send this JWT to the frontend (via URL redirect to /onboarding?token=...)
 * 6. Frontend stores JWT in localStorage
 * 7. Every API call from frontend includes: Authorization: Bearer <jwt>
 * 8. THIS MIDDLEWARE verifies that JWT on every protected route
 *
 * EXPORTS:
 * ─────────────────────────────────────────────────────────────
 * protect        → Full auth required. Blocks if no token or invalid.
 * optionalAuth   → Attaches user if token present, but doesn't block if missing.
 *                  Used for routes that work differently for logged-in vs guests.
 */

// ─────────────────────────────────────────────────────────────────
// Helper: extract JWT from request headers
// ─────────────────────────────────────────────────────────────────
const extractToken = (req) => {
  const authHeader = req.headers.authorization;

  // Standard format: "Authorization: Bearer eyJhbGci..."
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  // Fallback: token sent as query param (e.g., for webhook callbacks)
  // Not recommended for general use — only for specific flows
  if (req.query && req.query.token) {
    return req.query.token;
  }

  return null;
};

// ─────────────────────────────────────────────────────────────────
// PROTECT — Full authentication required
// Use this on all routes that need a logged-in user
// ─────────────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    // ── Step 1: Extract token ──────────────────────────────
    const token = extractToken(req);

    if (!token) {
      return errorResponse(
        res,
        "Access denied. Please log in to continue.",
        401,
      );
    }

    // ── Step 2: Verify JWT signature + expiry ──────────────
    // jwt.verify throws if:
    //   - Signature is invalid (token was tampered with)
    //   - Token is expired (past the expiresIn time)
    //   - JWT_SECRET doesn't match
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return errorResponse(res, "Session expired. Please log in again.", 401);
      }
      if (jwtError.name === "JsonWebTokenError") {
        return errorResponse(res, "Invalid token. Please log in again.", 401);
      }
      throw jwtError; // Unknown JWT error — let global handler deal with it
    }

    // ── Step 3: Fetch user from DB ─────────────────────────
    // WHY fetch from DB instead of just using decoded payload?
    // The JWT payload is static (set at login time).
    // User could have been: deactivated, re-auth flagged, deleted
    // since the JWT was issued. DB check catches all of those.
    const user = await User.findById(decoded.userId);
    // Note: NOT using .select("-tokens") here because:
    // - toJSON transform already strips tokens from any JSON response
    // - We may need user.tokens for tokenRefresher middleware later in the chain

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

    // ── Step 6: Attach user to request ────────────────────
    req.user = user;

    logger.info(
      `🔐 Authenticated: ${user.email} | Route: ${req.method} ${req.originalUrl}`,
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    req.user = user && user.isActive ? user : null;
    next();
  } catch (error) {
    // Invalid token — treat as guest, don't block
    req.user = null;
    next();
  }
};

module.exports = { protect, optionalAuth };
