const mongoose = require("mongoose");
const User = require("../models/User");
const Subject = require("../models/Subject");
const Attendance = require("../models/Attendance");
const Holiday = require("../models/Holiday");

async function buildSemesterSnapshot(userId) {
  const [user, subjects, holidays] = await Promise.all([
    User.findById(userId).select(
      "name email semesterStart semesterEnd profile",
    ).lean(),
    Subject.find({ userId }).sort({ name: 1, _id: 1 }).lean(),
    Holiday.find({ userId }).sort({ date: 1, _id: 1 }).lean(),
  ]);

  if (!user) {
    return null;
  }

  const normalizedSubjects = subjects.map((subject) => ({
    subjectId: String(subject._id),
    name: subject.name,
    type: subject.type,
    days: Array.isArray(subject.days) ? subject.days : [],
  }));

  const subjectObjectIds = subjects.map((subject) => subject._id);
  const subjectNameById = new Map(
    normalizedSubjects.map((subject) => [subject.subjectId, subject.name]),
  );

  const attendanceRecords =
    subjectObjectIds.length > 0
      ? await Attendance.find({
          subjectId: { $in: subjectObjectIds },
        })
          .sort({ date: 1, _id: 1 })
          .lean()
      : [];

  const normalizedAttendance = attendanceRecords.map((record) => {
    const subjectId = String(record.subjectId);
    return {
      attendanceId: String(record._id),
      subjectId,
      subjectName: subjectNameById.get(subjectId) || "Unknown Subject",
      date: record.date,
      status: record.status,
    };
  });

  return {
    user: {
      name: user.name,
      email: user.email,
      profile: user.profile || null,
    },
    semester: {
      semesterStart: user.semesterStart || null,
      semesterEnd: user.semesterEnd || null,
    },
    subjects: normalizedSubjects,
    holidays: holidays.map((holiday) => holiday.date),
    attendance: normalizedAttendance,
  };
}

exports.getSemester = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "semesterStart semesterEnd",
    );

    res.json({
      semesterStart: user.semesterStart,
      semesterEnd: user.semesterEnd,
    });
  } catch (error) {
    console.error("Get semester error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.setSemester = async (req, res) => {
  try {
    const { semesterStart, semesterEnd } = req.body;

    if (!semesterStart || !semesterEnd) {
      return res
        .status(400)
        .json({ message: "Both start and end dates are required" });
    }

    if (semesterStart >= semesterEnd) {
      return res
        .status(400)
        .json({ message: "End date must be after start date" });
    }

    await User.findByIdAndUpdate(req.userId, { semesterStart, semesterEnd });

    res.json({ message: "Semester dates updated" });
  } catch (error) {
    console.error("Set semester error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.exportSemesterData = async (req, res) => {
  try {
    const snapshot = await buildSemesterSnapshot(req.userId);

    if (!snapshot) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      exportedAt: new Date().toISOString(),
      version: 1,
      ...snapshot,
    });
  } catch (error) {
    console.error("Export semester data error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.resetSemesterData = async (req, res) => {
  const confirmation = (req.body.confirmation || "").trim();

  if (confirmation !== "RESET") {
    return res.status(400).json({
      message: "TYPE RESET IN CAPS TO CONTINUE",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(req.userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: "User not found" });
    }

    const subjects = await Subject.find({ userId: req.userId })
      .select("_id")
      .session(session);
    const subjectIds = subjects.map((subject) => subject._id);

    let deletedAttendance = 0;
    if (subjectIds.length > 0) {
      const attendanceResult = await Attendance.deleteMany({
        subjectId: { $in: subjectIds },
      }).session(session);
      deletedAttendance = attendanceResult.deletedCount || 0;
    }

    const subjectResult = await Subject.deleteMany({ userId: req.userId }).session(
      session,
    );
    const holidayResult = await Holiday.deleteMany({ userId: req.userId }).session(
      session,
    );

    user.semesterStart = null;
    user.semesterEnd = null;
    user.profile = user.profile || {};
    user.profile.isConfigured = false;
    await user.save({ session });

    await session.commitTransaction();

    return res.json({
      message: "Semester data reset successfully",
      deleted: {
        subjects: subjectResult.deletedCount || 0,
        attendance: deletedAttendance,
        holidays: holidayResult.deletedCount || 0,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Reset semester data error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  } finally {
    session.endSession();
  }
};
