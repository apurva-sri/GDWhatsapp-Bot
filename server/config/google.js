// Google OAuth2 client setup
const { google } = require("googleapis");
const logger = require("../utils/logger");

const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
};

/**
 * @param {string} state - CSRF state value generated in googleLogin.
 *                         Google echoes this back in the callback so we can
 *                         verify the request was initiated by our server.
 */
const getAuthUrl = (state) => {
  const oauth2Client = createOAuth2Client();

  const scopes = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  return oauth2Client.generateAuthUrl({
    access_type: "offline", // offline → we get a refresh_token (lasts forever)
    scope: scopes,
    prompt: "consent", // Force consent each time (ensures we get refresh token)
    state,             // Echo'd back by Google; verified in googleCallback
  });
};

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
 * @param {string} accessToken 
 * @param {string} refreshToken 
 */
const getAuthenticatedClient = (accessToken, refreshToken) => {
  const oauth2Client = createOAuth2Client();
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
