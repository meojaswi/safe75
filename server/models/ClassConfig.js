const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    schedule: {
      type: [String],
      default: [],
    },
  },
  { _id: false },
);

const classConfigSchema = new mongoose.Schema(
  {
    college: {
      type: String,
      required: true,
      trim: true,
    },
    branch: {
      type: String,
      required: true,
      trim: true,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },
    section: {
      type: String,
      required: true,
      trim: true,
    },
    semesterStart: {
      type: String,
      required: true,
    },
    semesterEnd: {
      type: String,
      required: true,
    },
    subjects: {
      type: [subjectSchema],
      default: [],
    },
    holidays: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false },
);

classConfigSchema.index(
  { college: 1, branch: 1, semester: 1, section: 1 },
  { unique: true },
);

module.exports = mongoose.model("ClassConfig", classConfigSchema);

