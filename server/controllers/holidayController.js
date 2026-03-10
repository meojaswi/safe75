const Holiday = require("../models/Holiday");

exports.getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find({ userId: req.userId }).sort({
      date: 1,
    });

    const dates = holidays.map((h) => h.date);

    res.json(dates);
  } catch (error) {
    console.error("Get holidays error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.addHoliday = async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ message: "Date must be in YYYY-MM-DD format" });
    }

    const existing = await Holiday.findOne({ date, userId: req.userId });
    if (existing) {
      return res.status(400).json({ message: "Date is already a holiday" });
    }

    await Holiday.create({ date, userId: req.userId });

    res.json({ message: "Holiday added" });
  } catch (error) {
    console.error("Add holiday error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.removeHoliday = async (req, res) => {
  try {
    const { date } = req.params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ message: "Date must be in YYYY-MM-DD format" });
    }

    await Holiday.deleteOne({ date, userId: req.userId });

    res.json({ message: "Holiday removed" });
  } catch (error) {
    console.error("Remove holiday error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.addMultipleHolidays = async (req, res) => {
  try {
    const { dates } = req.body;

    if (!dates || !Array.isArray(dates)) {
      return res.status(400).json({ message: "Dates array is required" });
    }

    const validDates = dates.filter(
      (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
    );

    if (validDates.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one valid date in YYYY-MM-DD format is required" });
    }

    const ops = validDates.map((date) => ({
      updateOne: {
        filter: { date, userId: req.userId },
        update: { date, userId: req.userId },
        upsert: true,
      },
    }));

    await Holiday.bulkWrite(ops);

    res.json({ message: `${validDates.length} holidays updated` });
  } catch (error) {
    console.error("Add multiple holidays error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};
