// Google OAuth2 client setup
const { google } = require("googleapis");
const logger = require("../utils/logger");

/**
 * Google OAuth2 Client
 *
 * OAuth2 is the standard protocol for:
 * 1. User authentication (login with Google)
 * 2. Delegated access to Google Drive
 *
 * Flow:
 * User clicks "Sign in with Google" → Redirected to getAuthUrl() → User approves scope
 * → Google redirects back with auth code → We exchange code for tokens via getTokensFromCode()
 */

const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL,
  );
};

/**
 * Build the URL where we send user to approve scopes.
 * User sees: "DriveBot wants access to your Google Drive"
 *
 * Scopes requested:
 * - drive.file: Can only access files created by this app
 * - userinfo.email: Get user's email
 * - userinfo.profile: Get user's name/picture
 */
const getAuthUrl = () => {
  const oauth2Client = createOAuth2Client();

  const scopes = [
    "https://www.googleapis.com/auth/drive.file", // Access Drive
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  return oauth2Client.generateAuthUrl({
    access_type: "offline", // CRITICAL: offline → we get a refresh_token (lasts forever)
    scope: scopes,
    prompt: "consent", // Force the consent screen each time (ensures we get refresh token)
  });
};

/**
 * Exchange the auth code for actual tokens.
 * Called after user approves on Google consent screen.
 *
 * Returns:
 * {  access_token: "ya29.xxx..."   (valid 1 hour),
 *    refresh_token: "1//xxx..."    (valid forever, can refresh access token),
 *    token_type: "Bearer",
 *    expiry_date: 1234567890000   (milliseconds)
 * }
 */
const getTokensFromCode = async (code) => {
  try {
    const oauth2Client = createOAuth2Client();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    logger.info("✅ Successfully exchanged auth code for tokens");
    return tokens;
  } catch (error) {
    logger.error(`Failed to exchange auth code: ${error.message}`);
    throw new Error("Failed to obtain tokens from Google: " + error.message);
  }
};

/**
 * Get an OAuth2 client with credentials already set.
 * Used to make authenticated Drive API calls.
 *
 * @param {string} accessToken - The access token (valid 1 hour)
 * @param {string} refreshToken - The refresh token (valid forever)
 * @returns {OAuth2Client} - Configured client ready to use
 */
const getAuthenticatedClient = (accessToken, refreshToken) => {
  const oauth2Client = createOAuth2Client();

  // Set the credentials on the client
  // Now all Google API calls through this client will include the auth header
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
  });

  return oauth2Client;
};

module.exports = {
  createOAuth2Client,
  getAuthUrl,
  getTokensFromCode,
  getAuthenticatedClient,
};
