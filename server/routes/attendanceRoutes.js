const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");

const {
  markAttendance,
  getAttendanceByDate,
  getAttendanceStats,
  getDashboard,
  getLatestBunk,
} = require("../controllers/attendanceController");

router.post("/", auth, markAttendance);
router.get("/date/:date", auth, getAttendanceByDate);
router.get("/stats/:subjectId", auth, getAttendanceStats);
router.get("/dashboard", auth, getDashboard);
router.get("/latest-bunk", auth, getLatestBunk);

module.exports = router;
