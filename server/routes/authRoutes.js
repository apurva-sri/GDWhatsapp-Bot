const router = require("express").Router();
const {
  googleLogin,
  googleCallback,
  getMe,
  logout,
} = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");

router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);

module.exports = router;
