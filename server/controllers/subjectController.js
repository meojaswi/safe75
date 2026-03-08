const Subject = require("../models/Subject");
const Attendance = require("../models/Attendance");

exports.addSubject = async (req, res) => {
  try {
    const { name, type, days } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Subject name is required" });
    }

    const subject = await Subject.create({
      name,
      type,
      days,
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
};