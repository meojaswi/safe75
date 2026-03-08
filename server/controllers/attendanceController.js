const Attendance = require("../models/Attendance");

exports.markAttendance = async (req, res) => {
  try {
    const { subjectId, status } = req.body;

    const attendance = await Attendance.create({
      subjectId,
      status,
    });

    res.json({
      message: "Attendance marked successfully",
      attendance,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAttendanceStats = async (req, res) => {
  try {
    const { subjectId } = req.params;

    const total = await Attendance.countDocuments({ subjectId });

    const present = await Attendance.countDocuments({
      subjectId,
      status: "present",
    });

    const percentage = total === 0 ? 0 : (present / total) * 100;

    res.json({
      totalClasses: total,
      presentClasses: present,
      attendancePercentage: percentage.toFixed(2),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};