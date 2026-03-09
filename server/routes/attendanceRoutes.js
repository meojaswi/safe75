const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const {
  markAttendance,
  getAttendanceByDate,
  getAttendanceStats,
  getDashboard,
} = require("../controllers/attendanceController");

router.post("/", auth, markAttendance);
router.get("/date/:date", auth, getAttendanceByDate);
router.get("/stats/:subjectId", auth, getAttendanceStats);
router.get("/dashboard", auth, getDashboard);

module.exports = router;
