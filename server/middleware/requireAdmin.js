const User = require("../models/User");

async function requireAdmin(req, res, next) {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await User.findById(req.userId).select("role");
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("requireAdmin error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong on the server. Please try again." });
  }
}

module.exports = requireAdmin;

