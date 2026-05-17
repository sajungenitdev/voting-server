const express = require("express");
const router = express.Router();
const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");
const User = require("../models/User.model");
const jwt = require("jsonwebtoken");

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

// Test endpoint
router.get("/test", (req, res) => {
  res.json({ success: true, message: "Google API working" });
});

// One-Tap token endpoint - NO next parameter anywhere
router.post("/token", async (req, res) => {
  console.log("=== GOOGLE ONE-TAP ===");

  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Credential is required",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    console.log("User:", email);

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        name: name || email.split("@")[0],
        email,
        googleId,
        isVerified: true,
        avatar: picture,
        password: crypto.randomBytes(32).toString("hex"),
      });
      await user.save();
      console.log("User created");
    } else if (!user.googleId) {
      user.googleId = googleId;
      user.isVerified = true;
      if (picture) user.avatar = picture;
      await user.save();
      console.log("User updated");
    }

    user.lastLogin = new Date();
    await user.save();

    const accessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    // Send response - NO res.status() with next
    return res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
        accessToken,
      },
    });
  } catch (error) {
    console.error("Error:", error.message);
    // Return error response - NO next(error)
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
