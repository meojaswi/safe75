const Attendance = require("../models/Attendance");
const Subject = require("../models/Subject");

exports.markAttendance = async (req, res) => {
  try {
    const { subjectId, status } = req.body;

    if (!subjectId || !status) {
      return res
        .status(400)
        .json({ message: "Subject ID and status are required" });
    }

    const subject = await Subject.findOne({
      _id: subjectId,
      userId: req.userId,
    });

    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

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

    const total = await Attendance.countDocuments({
      subjectId,
      status: { $ne: "holiday" },
    });

    const present = await Attendance.countDocuments({
      subjectId,
      status: "present",
    });

    const holidays = await Attendance.countDocuments({
      subjectId,
      status: "holiday",
    });

    const percentage = total === 0 ? 0 : (present / total) * 100;

    res.json({
      totalClasses: total,
      presentClasses: present,
      holidays,
      attendancePercentage: percentage.toFixed(2),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const subjects = await Subject.find({ userId: req.userId });

    const dashboard = [];

    for (const subject of subjects) {
      const total = await Attendance.countDocuments({
        subjectId: subject._id,
        status: { $ne: "holiday" },
      });

      const present = await Attendance.countDocuments({
        subjectId: subject._id,
        status: "present",
      });

      const holidays = await Attendance.countDocuments({
        subjectId: subject._id,
        status: "holiday",
      });

      const percentage = total === 0 ? 0 : (present / total) * 100;

      let canBunk = 0;
      let needToAttend = 0;

      if (total > 0) {
        if (percentage >= 75) {
          canBunk = Math.floor((present - 0.75 * total) / 0.75);
        } else {
          needToAttend = Math.ceil((0.75 * total - present) / 0.25);
        }
      }

      dashboard.push({
        subjectId: subject._id,
        subject: subject.name,
        type: subject.type,
        totalClasses: total,
        presentClasses: present,
        holidays,
        percentage: parseFloat(percentage.toFixed(2)),
        isLow: percentage < 75 && total > 0,
        canBunk,
        needToAttend,
      });
    }

    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
