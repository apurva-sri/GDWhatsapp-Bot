// Verify JWT / session
const authMiddleware = (req, res, next) => {
  // Verify authentication
  next();
};

module.exports = authMiddleware;
