const express = require("express");
const router = express.Router();

const { markAttendance } = require("../controllers/attendanceController");

router.post("/", markAttendance);

module.exports = router;
const {
  markAttendance,
  getAttendanceStats,
} = require("../controllers/attendanceController");

router.post("/", markAttendance);
router.get("/stats/:subjectId", getAttendanceStats);