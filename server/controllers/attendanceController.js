const Attendance = require("../models/Attendance");
const Subject = require("../models/Subject");
const Holiday = require("../models/Holiday");
const User = require("../models/User");

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function countScheduledDays(startStr, endStr, subjectDays, holidaySet) {
  if (!startStr || !endStr || !subjectDays || subjectDays.length === 0) {
    return 0;
  }

  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  let count = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayName = DAY_NAMES[d.getDay()];
    if (subjectDays.includes(dayName)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!holidaySet.has(dateStr)) {
        count++;
      }
    }
  }

  return count;
}

exports.markAttendance = async (req, res) => {
  try {
    const { subjectId, status, date } = req.body;
    const attendanceDate = date || getTodayStr();

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

    const existing = await Attendance.findOne({
      subjectId,
      date: attendanceDate,
    });

    if (existing) {
      existing.status = status;
      await existing.save();
      return res.json({
        message: "Attendance updated",
        attendance: existing,
      });
    }

    const attendance = await Attendance.create({
      subjectId,
      status,
      date: attendanceDate,
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
      status: { $ne: "no_class" },
    });

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

exports.getDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "semesterStart semesterEnd",
    );
    const subjects = await Subject.find({ userId: req.userId });
    const holidays = await Holiday.find({ userId: req.userId });
    const holidaySet = new Set(holidays.map((h) => h.date));

    const todayStr = getTodayStr();
    const todayDayName = DAY_NAMES[new Date().getDay()];

    const dashboard = [];

    for (const subject of subjects) {
      const total = await Attendance.countDocuments({
        subjectId: subject._id,
        status: { $ne: "no_class" },
      });

      const present = await Attendance.countDocuments({
        subjectId: subject._id,
        status: "present",
      });

      const noClassCount = await Attendance.countDocuments({
        subjectId: subject._id,
        status: "no_class",
      });

      const percentage = total === 0 ? 0 : (present / total) * 100;

      const expectedTotal = countScheduledDays(
        user.semesterStart,
        user.semesterEnd,
        subject.days,
        holidaySet,
      );

      const effectiveTotal = expectedTotal > 0 ? expectedTotal - noClassCount : total;

      let canBunk = 0;
      let needToAttend = 0;

      if (total > 0) {
        if (percentage >= 75) {
          canBunk = Math.floor((present - 0.75 * total) / 0.75);
          if (canBunk < 0) canBunk = 0;
        } else {
          needToAttend = Math.ceil((0.75 * total - present) / 0.25);
          if (needToAttend < 0) needToAttend = 0;
        }
      }

      const scheduledToday =
        subject.days && subject.days.includes(todayDayName);

      const todayAttendance = await Attendance.findOne({
        subjectId: subject._id,
        date: todayStr,
      });

      dashboard.push({
        subjectId: subject._id,
        subject: subject.name,
        type: subject.type,
        days: subject.days || [],
        totalClasses: total,
        presentClasses: present,
        noClassCount,
        expectedTotal,
        percentage: parseFloat(percentage.toFixed(2)),
        isLow: percentage < 75 && total > 0,
        canBunk,
        needToAttend,
        scheduledToday: !!scheduledToday,
        todayStatus: todayAttendance ? todayAttendance.status : null,
      });
    }

    res.json({
      semesterStart: user.semesterStart,
      semesterEnd: user.semesterEnd,
      today: todayStr,
      todayDay: todayDayName,
      subjects: dashboard,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
