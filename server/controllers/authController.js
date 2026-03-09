const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client();

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

exports.googleConfig = async (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || "" });
};

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const trimmedName = (name || "").trim();
    const normalizedEmail = normalizeEmail(email || "");

    if (!trimmedName || !normalizedEmail || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
    });

    const token = createToken(user._id);

    res.json({ message: "Account created", token, name: user.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email || "");

    if (!normalizedEmail || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (!user.password) {
      return res.status(400).json({
        message: "This account uses Google Sign-In. Please use the Google button to log in.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = createToken(user._id);

    res.json({ token, name: user.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.googleAuth = async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res
        .status(500)
        .json({ message: "Google OAuth is not configured on the server" });
    }

    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "Google token is required" });
    }

    // Verify the token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = normalizeEmail(payload.email || "");
    const name = (payload.name || "Student").trim() || "Student";
    const emailVerified = payload.email_verified === true;

    if (!googleId || !email || !emailVerified) {
      return res
        .status(400)
        .json({ message: "Google account email is not verified" });
    }

    // Find existing user by googleId or email
    let user = await User.findOne({ googleId });

    if (!user) {
      // Check if email already exists (password signup) — link accounts
      user = await User.findOne({ email });
      if (user) {
        if (user.googleId && user.googleId !== googleId) {
          return res.status(409).json({
            message:
              "This email is already linked to a different Google account",
          });
        }

        user.googleId = googleId;
        if (!user.name) {
          user.name = name;
        }
        await user.save();
      } else {
        // New user — create account
        user = await User.create({
          name,
          email,
          googleId,
        });
      }
    }

    const token = createToken(user._id);

    res.json({ token, name: user.name });
  } catch (error) {
    res
      .status(401)
      .json({ message: "Google authentication failed", error: error.message });
  }
};
