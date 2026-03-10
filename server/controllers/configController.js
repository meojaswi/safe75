const ClassConfig = require("../models/ClassConfig");
const Subject = require("../models/Subject");
const Holiday = require("../models/Holiday");
const User = require("../models/User");

function normalizeKeyFields(body) {
  const college = (body.college || "").trim();
  const branch = (body.branch || "").trim();
  const semester = Number(body.semester);
  const section = (body.section || "").trim();

  return { college, branch, semester, section };
}

exports.createConfig = async (req, res) => {
  try {
    const { college, branch, semester, section } = normalizeKeyFields(req.body);
    const { semesterStart, semesterEnd, subjects = [], holidays = [] } = req.body;

    if (!college || !branch || !semester || !section) {
      return res
        .status(400)
        .json({ message: "College, branch, semester and section are required" });
    }

    if (!semesterStart || !semesterEnd) {
      return res
        .status(400)
        .json({ message: "Semester start and end dates are required" });
    }

    const cleanSubjects = Array.isArray(subjects)
      ? subjects
          .map((s) => ({
            name: (s.name || "").trim(),
            schedule: Array.isArray(s.schedule) ? s.schedule : [],
          }))
          .filter((s) => s.name)
      : [];

    const cleanHolidays = Array.isArray(holidays)
      ? holidays.filter(
          (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
        )
      : [];

    const doc = await ClassConfig.create({
      college,
      branch,
      semester,
      section,
      semesterStart,
      semesterEnd,
      subjects: cleanSubjects,
      holidays: cleanHolidays,
      createdBy: req.userId,
      updatedAt: new Date(),
    });

    res.json(doc);
  } catch (error) {
    console.error("createConfig error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { college, branch, semester, section } = normalizeKeyFields(req.body);
    const { semesterStart, semesterEnd, subjects = [], holidays = [] } = req.body;

    const config = await ClassConfig.findById(id);
    if (!config) {
      return res.status(404).json({ message: "Config not found" });
    }

    if (college) config.college = college;
    if (branch) config.branch = branch;
    if (semester) config.semester = semester;
    if (section) config.section = section;
    if (semesterStart) config.semesterStart = semesterStart;
    if (semesterEnd) config.semesterEnd = semesterEnd;

    if (Array.isArray(subjects)) {
      config.subjects = subjects
        .map((s) => ({
          name: (s.name || "").trim(),
          schedule: Array.isArray(s.schedule) ? s.schedule : [],
        }))
        .filter((s) => s.name);
    }

    if (Array.isArray(holidays)) {
      config.holidays = holidays.filter(
        (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
      );
    }

    config.updatedAt = new Date();
    await config.save();

    res.json(config);
  } catch (error) {
    console.error("updateConfig error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.getConfig = async (req, res) => {
  try {
    const { college, branch, semester, section } = normalizeKeyFields(req.query);

    if (!college || !branch || !semester || !section) {
      return res.json(null);
    }

    const config = await ClassConfig.findOne({
      college,
      branch,
      semester,
      section,
    }).lean();

    if (!config) {
      return res.json(null);
    }

    res.json(config);
  } catch (error) {
    console.error("getConfig error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.applyConfigToUser = async (user, config) => {
  const session = await ClassConfig.startSession();
  session.startTransaction();

  try {
    await Subject.deleteMany({ userId: user._id }).session(session);
    await Holiday.deleteMany({ userId: user._id }).session(session);

    if (Array.isArray(config.subjects) && config.subjects.length > 0) {
      const subjectDocs = config.subjects.map((s) => ({
        name: s.name,
        type: "theory",
        days: Array.isArray(s.schedule) ? s.schedule : [],
        userId: user._id,
      }));
      await Subject.insertMany(subjectDocs, { session });
    }

    if (Array.isArray(config.holidays) && config.holidays.length > 0) {
      const holidayDocs = config.holidays.map((date) => ({
        date,
        userId: user._id,
      }));
      await Holiday.insertMany(holidayDocs, { session });
    }

    user.semesterStart = config.semesterStart;
    user.semesterEnd = config.semesterEnd;
    user.profile = user.profile || {};
    user.profile.isConfigured = true;
    await user.save({ session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

