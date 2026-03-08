const Holiday = require("../models/Holiday");

exports.getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find({ userId: req.userId }).sort({
      date: 1,
    });

    const dates = holidays.map((h) => h.date);

    res.json(dates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addHoliday = async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const existing = await Holiday.findOne({ date, userId: req.userId });
    if (existing) {
      return res.status(400).json({ message: "Date is already a holiday" });
    }

    await Holiday.create({ date, userId: req.userId });

    res.json({ message: "Holiday added" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.removeHoliday = async (req, res) => {
  try {
    const { date } = req.params;

    await Holiday.deleteOne({ date, userId: req.userId });

    res.json({ message: "Holiday removed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addMultipleHolidays = async (req, res) => {
  try {
    const { dates } = req.body;

    if (!dates || !Array.isArray(dates)) {
      return res.status(400).json({ message: "Dates array is required" });
    }

    const ops = dates.map((date) => ({
      updateOne: {
        filter: { date, userId: req.userId },
        update: { date, userId: req.userId },
        upsert: true,
      },
    }));

    if (ops.length > 0) {
      await Holiday.bulkWrite(ops);
    }

    res.json({ message: `${dates.length} holidays updated` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
