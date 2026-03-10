const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");
const {
  createConfig,
  updateConfig,
  getConfig,
} = require("../controllers/configController");

router.post("/", auth, requireAdmin, createConfig);
router.put("/:id", auth, requireAdmin, updateConfig);
router.get("/", auth, getConfig);

module.exports = router;

