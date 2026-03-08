const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const {
  markAttendance,
  getAttendanceStats,
  getDashboard,
} = require("../controllers/attendanceController");

router.post("/", auth, markAttendance);
router.get("/stats/:subjectId", auth, getAttendanceStats);
router.get("/dashboard", auth, getDashboard);

module.exports = router;
