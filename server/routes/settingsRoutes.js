const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const { getSemester, setSemester } = require("../controllers/settingsController");

router.get("/semester", auth, getSemester);
router.put("/semester", auth, setSemester);

module.exports = router;
