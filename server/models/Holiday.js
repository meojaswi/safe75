const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

holidaySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Holiday", holidaySchema);
