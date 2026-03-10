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

function buildEmptySubjectStatsMap(subjects) {
  const map = {};
  for (const subject of subjects) {
    map[String(subject._id)] = {
      total: 0,
      present: 0,
      noClass: 0,
      todayStatus: null,
    };
  }
  return map;
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

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ message: "Date must be in YYYY-MM-DD format" });
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
    console.error("Mark attendance error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.getAttendanceStats = async (req, res) => {
  try {
    const { subjectId } = req.params;

    const subject = await Subject.findOne({ _id: subjectId, userId: req.userId });
    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

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
    console.error("Get attendance stats error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "Date must be in YYYY-MM-DD format" });
    }

    const subjects = await Subject.find({ userId: req.userId }).select("_id");
    const subjectIds = subjects.map((s) => s._id);

    if (subjectIds.length === 0) {
      return res.json({ date, statuses: {} });
    }

    const records = await Attendance.find({
      subjectId: { $in: subjectIds },
      date,
    }).select("subjectId status");

    const statuses = {};
    for (const rec of records) {
      statuses[String(rec.subjectId)] = rec.status;
    }

    res.json({ date, statuses });
  } catch (error) {
    console.error("Get attendance by date error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const [user, subjects, holidays] = await Promise.all([
      User.findById(req.userId).select("semesterStart semesterEnd"),
      Subject.find({ userId: req.userId }),
      Holiday.find({ userId: req.userId }),
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const holidaySet = new Set(holidays.map((h) => h.date));

    const todayStr = getTodayStr();
    const todayDayName = DAY_NAMES[new Date().getDay()];
    const subjectIds = subjects.map((s) => s._id);

    const allRecords = await Attendance.find({
      subjectId: { $in: subjectIds },
    }).select("subjectId date status");

    const subjectStatsMap = buildEmptySubjectStatsMap(subjects);

    // Create a date → status map (if any subject was attended that day, it's "present")
    const dateMap = {};
    for (const rec of allRecords) {
      const subjectKey = String(rec.subjectId);
      const stats = subjectStatsMap[subjectKey];
      if (!stats) continue;

      if (rec.status === "present") {
        stats.present += 1;
        stats.total += 1;
      } else if (rec.status === "absent") {
        stats.total += 1;
      } else if (rec.status === "no_class") {
        stats.noClass += 1;
      }

      if (rec.date === todayStr) {
        stats.todayStatus = rec.status;
      }

      if (rec.status === "no_class") {
        continue;
      }

      if (!dateMap[rec.date] || rec.status === "present") {
        dateMap[rec.date] = rec.status;
      }
    }

    const dashboard = [];
    for (const subject of subjects) {
      const stats = subjectStatsMap[String(subject._id)] || {
        total: 0,
        present: 0,
        noClass: 0,
        todayStatus: null,
      };

      const percentage = stats.total === 0 ? 0 : (stats.present / stats.total) * 100;

      const rawExpectedTotal = countScheduledDays(
        user.semesterStart,
        user.semesterEnd,
        subject.days,
        holidaySet,
      );
      const expectedTotal =
        rawExpectedTotal > 0
          ? Math.max(0, rawExpectedTotal - stats.noClass)
          : 0;

      let canBunk = 0;
      let needToAttend = 0;

      if (stats.total > 0) {
        if (percentage >= 75) {
          canBunk = Math.floor((stats.present - 0.75 * stats.total) / 0.75);
          if (canBunk < 0) canBunk = 0;
        } else {
          needToAttend = Math.ceil((0.75 * stats.total - stats.present) / 0.25);
          if (needToAttend < 0) needToAttend = 0;
        }
      }

      const scheduledToday = subject.days && subject.days.includes(todayDayName);

      dashboard.push({
        subjectId: subject._id,
        subject: subject.name,
        type: subject.type,
        days: subject.days || [],
        totalClasses: stats.total,
        presentClasses: stats.present,
        noClassCount: stats.noClass,
        expectedTotal,
        percentage: parseFloat(percentage.toFixed(2)),
        isLow: percentage < 75 && stats.total > 0,
        canBunk,
        needToAttend,
        scheduledToday: !!scheduledToday,
        todayStatus: stats.todayStatus,
      });
    }

    // Calculate semester day counts
    let totalDays = 0;
    let daysPassed = 0;
    let daysLeft = 0;

    if (user.semesterStart && user.semesterEnd) {
      const start = new Date(user.semesterStart + "T00:00:00");
      const end = new Date(user.semesterEnd + "T00:00:00");
      const today = new Date(todayStr + "T00:00:00");
      totalDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
      daysPassed = Math.max(0, Math.round((today - start) / (1000 * 60 * 60 * 24)));
      daysLeft = Math.max(0, totalDays - daysPassed);
    }

    res.json({
      semesterStart: user.semesterStart,
      semesterEnd: user.semesterEnd,
      today: todayStr,
      todayDay: todayDayName,
      totalDays,
      daysPassed,
      daysLeft,
      heatmap: dateMap,
      holidays: Array.from(holidaySet),
      subjects: dashboard,
    });
  } catch (error) {
    console.error("Get dashboard error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.getLatestBunk = async (req, res) => {
  try {
    const [user, subjects] = await Promise.all([
      User.findById(req.userId).select("semesterStart semesterEnd"),
      Subject.find({ userId: req.userId }).select("_id name"),
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (subjects.length === 0) {
      return res.json({ latestBunk: null });
    }

    const subjectMap = new Map(
      subjects.map((subject) => [String(subject._id), subject.name]),
    );

    const attendanceQuery = {
      subjectId: { $in: subjects.map((subject) => subject._id) },
      status: "absent",
    };

    if (user.semesterStart && user.semesterEnd && user.semesterStart <= user.semesterEnd) {
      const todayStr = getTodayStr();
      const currentSemesterEnd =
        user.semesterEnd < todayStr ? user.semesterEnd : todayStr;

      if (user.semesterStart > currentSemesterEnd) {
        return res.json({ latestBunk: null });
      }

      attendanceQuery.date = {
        $gte: user.semesterStart,
        $lte: currentSemesterEnd,
      };
    }

    const latestAbsent = await Attendance.findOne(attendanceQuery)
      .sort({ date: -1, _id: -1 })
      .select("subjectId date");

    if (!latestAbsent) {
      return res.json({ latestBunk: null });
    }

    if (
      typeof latestAbsent.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(latestAbsent.date)
    ) {
      return res.json({ latestBunk: null });
    }

    res.json({
      latestBunk: {
        subject: subjectMap.get(String(latestAbsent.subjectId)) || "Unknown Subject",
        date: latestAbsent.date,
      },
    });
  } catch (error) {
    console.error("Get latest bunk error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};
