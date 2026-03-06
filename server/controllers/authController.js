const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  getAuthUrl,
  getTokensFromCode,
  getAuthenticatedClient,
} = require("../config/google");
const { google } = require("googleapis");
const { encrypt } = require("../utils/encrypt");
const {
  successResponse,
  errorResponse,
} = require("../utils/responseFormatter");
const logger = require("../utils/logger");

/**
 * STEP 1 — Redirect user to Google's consent screen
 *
 * When frontend hits GET /api/auth/google,
 * we generate the Google OAuth URL and redirect the user there.
 * Google will show: "DriveBot wants to access your Drive. Allow?"
 */
const googleLogin = (req, res) => {
  try {
    const authUrl = getAuthUrl();
    // 302 redirect — browser goes to Google
    res.redirect(authUrl);
  } catch (error) {
    logger.error(`googleLogin error: ${error.message}`);
    res.redirect(`${process.env.CLIENT_URL}?error=auth_failed`);
  }
};

/**
 * STEP 2 — Google redirects back here after user approves
 *
 * URL will look like:
 * GET /api/auth/google/callback?code=4/0AX4XfWh...&scope=...
 *
 * We take that "code", exchange it with Google for real tokens,
 * save the user + tokens in MongoDB, then redirect to frontend.
 */
const googleCallback = async (req, res) => {
  try {
    const { code, error } = req.query;

    // User clicked "Deny" on Google's consent screen
    if (error || !code) {
      logger.warn(`Google OAuth denied: ${error}`);
      return res.redirect(`${process.env.CLIENT_URL}?error=access_denied`);
    }

    // ── Exchange code for tokens ───────────────────────────────
    // This is the key step — Google gives us:
    // access_token  → valid for 1 hour, used to call Drive API
    // refresh_token → valid forever (until revoked), used to get new access tokens
    // expiry_date   → timestamp when access_token expires
    const tokens = await getTokensFromCode(code);
    const { access_token, refresh_token, expiry_date } = tokens;

    if (!refresh_token) {
      // This happens if the user already authorized before and we didn't force consent
      // The google.js config has prompt: "consent" to prevent this, but just in case:
      logger.error("No refresh token received from Google");
      return res.redirect(`${process.env.CLIENT_URL}?error=no_refresh_token`);
    }

    // ── Get user profile from Google ───────────────────────────
    const oauth2Client = getAuthenticatedClient(access_token, refresh_token);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();
    // profile = { id, email, name, picture, ... }

    // ── Encrypt tokens before saving ──────────────────────────
    // Never store plain text tokens in DB
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = encrypt(refresh_token);

    // ── Upsert user in MongoDB ────────────────────────────────
    // "Upsert" = Update if exists, Insert if new
    // So if same Google account logs in again, we just update their tokens
    const user = await User.findOneAndUpdate(
      { googleId: profile.id }, // Find by Google ID
      {
        googleId: profile.id,
        email: profile.email,
        name: profile.name,
        profilePicture: profile.picture,
        tokens: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiry: new Date(expiry_date),
        },
        lastActiveAt: new Date(),
      },
      {
        upsert: true, // Create if doesn't exist
        new: true, // Return the updated document
        setDefaultsOnInsert: true,
      },
    );

    // ── Assign WhatsApp number if new user ────────────────────
    // For now we use the Twilio sandbox number
    // Later when you buy more Twilio numbers, assign unique ones per user
    if (!user.whatsappNumber) {
      // Store the USER's WhatsApp number (their personal number)
      // They'll message YOUR Twilio number, and we identify them by their number
      user.whatsappNumber = `whatsapp:${profile.email}`; // placeholder, updated when they first message
      user.twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;
      await user.save();
    }

    // ── Create JWT for your app ────────────────────────────────
    // This JWT is what the React frontend uses to authenticate API calls
    // It is NOT a Google token — it's your own app's session token
    const jwtToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );

    logger.info(`✅ User authenticated: ${user.email}`);

    // ── Redirect to frontend with JWT + user info ─────────────
    // We pass data as URL params so React can read them
    const params = new URLSearchParams({
      token: jwtToken,
      name: user.name,
      email: user.email,
      picture: user.profilePicture || "",
      whatsapp: user.twilioNumber || process.env.TWILIO_WHATSAPP_NUMBER,
    });

    res.redirect(`${process.env.CLIENT_URL}/onboarding?${params.toString()}`);
  } catch (error) {
    logger.error(`googleCallback error: ${error.message}`, {
      stack: error.stack,
    });
    res.redirect(`${process.env.CLIENT_URL}?error=server_error`);
  }
};

/**
 * GET /api/auth/me
 * Returns the currently logged-in user's profile
 * Protected route — requires JWT in Authorization header
 */
const getMe = async (req, res) => {
  try {
    // req.user is set by authMiddleware
    const user = await User.findById(req.user._id).select("-tokens");
    if (!user) return errorResponse(res, "User not found", 404);
    return successResponse(res, "User profile", user);
  } catch (error) {
    logger.error(`getMe error: ${error.message}`);
    return errorResponse(res, "Server error", 500);
  }
};

/**
 * POST /api/auth/logout
 * Clears any cached tokens from Redis
 * JWT is stateless so we can't truly invalidate it,
 * but we clear server-side cache
 */
const logout = async (req, res) => {
  try {
    const { deleteCache } = require("../config/redis");
    await deleteCache(`tokens:${req.user._id}`);
    return successResponse(res, "Logged out successfully");
  } catch (error) {
    return errorResponse(res, "Logout failed", 500);
  }
};

module.exports = { googleLogin, googleCallback, getMe, logout };
