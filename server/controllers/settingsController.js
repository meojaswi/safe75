const User = require("../models/User");

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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
};
