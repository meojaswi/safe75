const User = require("../models/User");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client();
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const RESET_EMAIL_RESPONSE_MESSAGE =
  "If that email is registered, a password reset link has been sent.";
let mailTransporter = null;

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function createPasswordResetToken() {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  return {
    rawToken,
    hashedToken,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  };
}

function getClientBaseUrl(req) {
  const configuredBaseUrl = (process.env.CLIENT_BASE_URL || "").trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  return `${req.protocol}://${req.get("host")}`;
}

function getMailTransporter() {
  if (mailTransporter) {
    return mailTransporter;
  }

  const gmailUser = (process.env.GMAIL_USER || process.env.EMAIL_USER || "").trim();
  const gmailAppPassword = (
    process.env.GMAIL_APP_PASSWORD ||
    process.env.EMAIL_PASS ||
    ""
  ).trim();

  if (!gmailUser || !gmailAppPassword) {
    throw new Error("Gmail mailer is not configured");
  }

  mailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  return mailTransporter;
}

async function sendPasswordResetEmail(user, resetUrl) {
  const transporter = getMailTransporter();
  const gmailUser = (process.env.GMAIL_USER || process.env.EMAIL_USER || "").trim();
  const mailFrom = (process.env.MAIL_FROM || "").trim();
  const fromAddress = mailFrom || `Safe75 Support <${gmailUser}>`;

  await transporter.sendMail({
    from: fromAddress,
    to: user.email,
    subject: "Reset your Safe75 password",
    text:
      "Hi,\n\n" +
      "We received a request to reset your Safe75 password.\n" +
      `Use this link to set a new password (valid for 15 minutes):\n${resetUrl}\n\n` +
      "If you did not request this, you can safely ignore this email.",
    html:
      "<p>Hi,</p>" +
      "<p>We received a request to reset your Safe75 password.</p>" +
      `<p><a href="${resetUrl}">Click here to set a new password</a> (valid for 15 minutes).</p>` +
      "<p>If you did not request this, you can safely ignore this email.</p>",
  });
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

exports.forgotPassword = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail((req.body.email || ""));

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    try {
      getMailTransporter();
    } catch (mailConfigError) {
      return res.status(500).json({
        message: "Password reset email is not configured on the server.",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.json({ message: RESET_EMAIL_RESPONSE_MESSAGE });
    }

    const { rawToken, hashedToken, expiresAt } = createPasswordResetToken();

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = expiresAt;
    await user.save();

    try {
      const baseUrl = getClientBaseUrl(req);
      const resetUrl = `${baseUrl}/reset-password.html?token=${rawToken}`;

      await sendPasswordResetEmail(user, resetUrl);
    } catch (emailError) {
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save();

      console.error("Failed to send password reset email:", emailError);
      return res.json({ message: RESET_EMAIL_RESPONSE_MESSAGE });
    }

    return res.json({ message: RESET_EMAIL_RESPONSE_MESSAGE });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const token = (req.body.token || "").trim();
    const password = req.body.password || "";

    if (!token || !password) {
      return res.status(400).json({
        message: "Reset token and new password are required",
      });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Reset link is invalid or has expired" });
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    return res.json({
      message: "Password reset successful. Please log in with your new password.",
    });
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
