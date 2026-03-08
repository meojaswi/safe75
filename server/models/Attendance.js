const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  },
  status: {
    type: String,
    enum: ["present", "absent", "no_class"],
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
});

attendanceSchema.index({ subjectId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
