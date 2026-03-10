const User = require("../models/User");
const ClassConfig = require("../models/ClassConfig");
const Subject = require("../models/Subject");
const Holiday = require("../models/Holiday");
const { applyConfigToUser } = require("./configController");

function normalizeProfile(body) {
  const college = (body.college || "").trim();
  const branch = (body.branch || "").trim();
  const semester = body.semester != null ? Number(body.semester) : null;
  const section = (body.section || "").trim();

  return { college, branch, semester, section };
}

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "name email role profile",
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      name: user.name,
      email: user.email,
      role: user.role,
      profile: user.profile || null,
    });
  } catch (error) {
    console.error("getProfile error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { college, branch, semester, section } = normalizeProfile(req.body);

    if (!college || !branch || !semester || !section) {
      return res.status(400).json({
        message: "College, branch, semester and section are required",
      });
    }

    user.profile = user.profile || {};
    user.profile.college = college;
    user.profile.branch = branch;
    user.profile.semester = semester;
    user.profile.section = section;
    user.profile.isConfigured = user.profile.isConfigured || false;

    await user.save();

    const config = await ClassConfig.findOne({
      college,
      branch,
      semester,
      section,
    });

    if (config) {
      await applyConfigToUser(user, config);
      const freshUser = await User.findById(req.userId).select(
        "profile name email role",
      );
      return res.json({
        profile: freshUser.profile,
        autoFilled: true,
      });
    }

    res.json({
      profile: user.profile,
      autoFilled: false,
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
};

