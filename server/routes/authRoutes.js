const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  googleAuth,
  googleConfig,
} = require("../controllers/authController");

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleAuth);
router.get("/google-config", googleConfig);

module.exports = router;
