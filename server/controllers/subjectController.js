const Subject = require("../models/Subject");

exports.addSubject = async (req, res) => {
  try {
    const { name, type, days } = req.body;

    const subject = await Subject.create({
      name,
      type,
      days,
    });

    res.json({
      message: "Subject added",
      subject,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
