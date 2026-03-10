const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: false, // optional for OAuth users
      default: null,
    },
    googleId: {
      type: String,
      default: null,
      unique: true,
      sparse: true, // allows multiple null values
    },
    passwordResetToken: {
      type: String,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
    semesterStart: {
      type: String,
      default: null,
    },
    semesterEnd: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    profile: {
      college: {
        type: String,
        default: "",
        trim: true,
      },
      branch: {
        type: String,
        default: "",
        trim: true,
      },
      semester: {
        type: Number,
        default: null,
        min: 1,
        max: 8,
      },
      section: {
        type: String,
        default: "",
        trim: true,
      },
      isConfigured: {
        type: Boolean,
        default: false,
      },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
