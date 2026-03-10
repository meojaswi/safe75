const Subject = require("../models/Subject");
const Attendance = require("../models/Attendance");

const ALLOWED_SUBJECT_TYPES = ["theory", "lab"];
const ALLOWED_SCHEDULE_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function normalizeDays(days) {
  if (!Array.isArray(days)) {
    return [];
  }

  const unique = new Set();
  for (const day of days) {
    if (typeof day !== "string") continue;

    const normalizedDay = day.trim();
    if (ALLOWED_SCHEDULE_DAYS.includes(normalizedDay)) {
      unique.add(normalizedDay);
    }
  }

  return Array.from(unique);
}

exports.addSubject = async (req, res) => {
  try {
    const { name, type, days } = req.body;

    const trimmedName = (name || "").trim();
    const normalizedType = (type || "").trim().toLowerCase();
    const normalizedDays = normalizeDays(days);

    if (!trimmedName) {
      return res.status(400).json({ message: "Subject name is required" });
    }

    if (!ALLOWED_SUBJECT_TYPES.includes(normalizedType)) {
      return res
        .status(400)
        .json({ message: "Type must be either theory or lab" });
    }

    const subject = await Subject.create({
      name: trimmedName,
      type: normalizedType,
      days: normalizedDays,
      userId: req.userId,
    });

    res.json({
      message: "Subject added",
      subject,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ userId: req.userId });

    res.json(subjects);
  } catch (error) {
    console.error("Get subjects error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findOne({ _id: id, userId: req.userId });

    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    const name = (req.body.name || "").trim();
    const nextType = (req.body.type || "").trim().toLowerCase();

    if (!name) {
      return res.status(400).json({ message: "Subject name is required" });
    }

    if (!ALLOWED_SUBJECT_TYPES.includes(nextType)) {
      return res
        .status(400)
        .json({ message: "Type must be either theory or lab" });
    }

    subject.name = name;
    subject.type = nextType;
    subject.days = normalizeDays(req.body.days);
    await subject.save();

    return res.json({
      message: "Subject updated",
      subject,
    });
  } catch (error) {
    console.error("Update subject error:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await Subject.findOne({ _id: id, userId: req.userId });

    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    await Attendance.deleteMany({ subjectId: id });
    await Subject.deleteOne({ _id: id });

    res.json({ message: "Subject deleted" });
  } catch (error) {
    console.error("Delete subject error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};
