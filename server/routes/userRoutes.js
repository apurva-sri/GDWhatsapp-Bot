// User routes
const router = require("express").Router();
const {
  getProfile,
  getStats,
  getHistory,
  deactivateAccount,
} = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");

router.use(protect);

router.get("/profile", getProfile);
router.get("/stats", getStats);
router.get("/history", getHistory);
router.delete("/account", deactivateAccount);

module.exports = router;