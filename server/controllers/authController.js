const jwt = require("jsonwebtoken");
const crypto = require("crypto");
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
const { clearTokenCache } = require("../services/tokenService");
const { setCache } = require("../config/redis");

// ── JWT helper ───────────────────────────────────────────────
/**
 * Issue a JWT for the user with a unique jti (JWT ID).
 * The jti allows us to revoke individual tokens at logout via a Redis blocklist.
 * Algorithm is pinned to HS256 (same algo enforced in authMiddleware).
 */
const signJWT = (user) => {
  const jti = crypto.randomUUID(); // unique per token — used by blocklist
  const token = jwt.sign(
    { userId: user._id, email: user.email, jti },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );
  return { token, jti };
};

// Cookie security settings
const COOKIE_OPTIONS = {
  httpOnly: true,  // JS cannot read this cookie (blocks XSS token theft)
  secure: process.env.NODE_ENV === "production", // HTTPS only in prod
  sameSite: "strict",                          // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000,            // 7 days in ms
};
/**
 * STEP 1 — Redirect user to Google's consent screen
 *
 * When frontend hits GET /api/auth/google,
 * we generate the Google OAuth URL and redirect the user there.
 * Google will show: "DriveBot wants to access your Drive. Allow?"
 */
const googleLogin = (req, res) => {
  try {
    // Generate a cryptographically random state value to defend against CSRF.
    // An attacker cannot forge a valid login flow because they cannot predict
    // the state value that the server expects back from Google.
    const state = crypto.randomBytes(32).toString("hex");

    // Store the state in a short-lived, httpOnly cookie so the callback can
    // verify it. Do NOT store it in session / Redis to keep the server stateless.
    res.cookie("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // lax because the Google redirect will cross origins
      maxAge: 10 * 60 * 1000, // 10 minutes — OAuth must complete within this
    });

    const authUrl = getAuthUrl(state); // pass state into the OAuth URL
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
    const { code, error, state } = req.query;

    // ── CSRF state validation ────────────────────────────────────
    // Compare the state from Google's redirect with the one we set in the cookie.
    const savedState = req.cookies?.oauth_state;
    if (!savedState || !state || savedState !== state) {
      logger.warn("OAuth CSRF check failed — state mismatch");
      return res.redirect(`${process.env.CLIENT_URL}?error=state_mismatch`);
    }
    // Consume the cookie immediately so it cannot be replayed
    res.clearCookie("oauth_state");

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
    const { access_token, refresh_token, expiry_date, scope } = tokens;

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
          scopes: scope ? scope.split(" ") : [],
        },
        requiresReAuth: false, // Reset re-auth flag on every successful login
        lastActiveAt: new Date(),
      },
      {
        upsert: true, // Create if doesn't exist
        new: true, // Return the updated document
        setDefaultsOnInsert: true,
      },
    );

    // ── Assign WhatsApp number if new user ────────────────────
    if (!user.twilioNumber) {
  await User.findByIdAndUpdate(user._id, {
    twilioNumber: process.env.TWILIO_WHATSAPP_NUMBER,
    lastActiveAt: new Date(),
  });
  user.twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;
}

    // Clear stale Redis token cache so fresh tokens are used immediately
    await clearTokenCache(user._id.toString());

    // ── Issue app JWT ───────────────────────────────────────────
    // This is YOUR app's session token — not a Google token.
    const { token: jwtToken } = signJWT(user);

    logger.info(`✅ User authenticated: userId=${user._id}`);

    // ── Deliver JWT via httpOnly cookie (NOT in the URL) ───────────
    // Putting the token in a ?token=... query param is dangerous:
    //   • It appears in server access logs (nginx / Render / Railway)
    //   • It appears in the browser’s address bar and history
    //   • It leaks via HTTP Referer headers to analytics / CDN
    //
    // An httpOnly cookie is invisible to JS, so XSS cannot steal it.
    // SameSite=Strict prevents CSRF.
    res.cookie("token", jwtToken, COOKIE_OPTIONS);

    // Non-sensitive profile data is still fine in the query string
    const params = new URLSearchParams({
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
 *
 * Real token invalidation:
 * 1. Clears the token cookie so the browser won't send it again.
 * 2. Blocklists the JWT’s jti in Redis until the token’s natural expiry.
 *    The authMiddleware checks this blocklist on every protected request,
 *    so the token is truly dead — not just forgotten by the client.
 */
const logout = async (req, res) => {
  try {
    const { deleteCache } = require("../config/redis");

    // Clear Google token cache
    await deleteCache(`tokens:${req.user._id}`);

    // Blocklist the JWT jti so it cannot be reused even if someone kept a copy
    const { jti, exp } = req.tokenPayload || {};
    if (jti && exp) {
      const ttl = exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await setCache(`blocklist:${jti}`, "1", ttl);
      }
    }

    // Clear the cookie on the client
    res.clearCookie("token", COOKIE_OPTIONS);

    logger.info(`✅ User logged out: userId=${req.user._id}`);
    return successResponse(res, "Logged out successfully");
  } catch (error) {
    logger.error(`logout error: ${error.message}`);
    return errorResponse(res, "Logout failed", 500);
  }
};

module.exports = { googleLogin, googleCallback, getMe, logout };
