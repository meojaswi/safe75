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
