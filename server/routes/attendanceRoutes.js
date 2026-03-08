const express = require("express");
const router = express.Router();

const {
  markAttendance,
  getAttendanceStats,
} = require("../controllers/attendanceController");

router.post("/", markAttendance);
router.get("/stats/:subjectId", getAttendanceStats);

module.exports = router;
