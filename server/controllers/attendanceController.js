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

const Subject = require("../models/Subject");

exports.getDashboard = async (req, res) => {
  try {
    const subjects = await Subject.find();

    const dashboard = [];

    for (const subject of subjects) {
      const total = await Attendance.countDocuments({
        subjectId: subject._id,
      });

      const present = await Attendance.countDocuments({
        subjectId: subject._id,
        status: "present",
      });

      const percentage = total === 0 ? 0 : (present / total) * 100;

      dashboard.push({
        subject: subject.name,
        attendance: percentage.toFixed(2) + "%",
      });
    }

    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
