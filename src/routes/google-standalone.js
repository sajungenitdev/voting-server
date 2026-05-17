// backend/src/routes/google-standalone.js

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
  res.json({ success: true, message: "Google standalone route working" });
});

// One-Tap token endpoint
router.post("/token", async (req, res) => {
  console.log("=== GOOGLE STANDALONE ONE-TAP ===");

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
    const {
      email,
      name,
      given_name,
      family_name,
      picture,
      sub: googleId,
      locale,
    } = payload;

    console.log("Google user data:", {
      email,
      name,
      given_name,
      family_name,
      picture: picture ? "Received" : "Not received",
      locale,
    });

    // Fix: Ensure picture URL uses high resolution and is properly formatted
    let avatarUrl = null;
    if (picture) {
      // Convert to high resolution (remove s96-c and replace with s400-c)
      avatarUrl = picture.replace(/=s\d+-c/, "=s400-c");
      console.log("Avatar URL generated:", avatarUrl);
    }

    // Find or create user
    let user = await User.findOne({ email });

    if (!user) {
      console.log("Creating new user from Google data...");
      user = new User({
        name: name || given_name || email.split("@")[0],
        fullName: name || `${given_name} ${family_name}`.trim(),
        email,
        googleId,
        isVerified: true,
        avatar: avatarUrl, // Store the high-res URL
        password: crypto.randomBytes(32).toString("hex"),
        role: "user",
        preferences: {
          theme: "dark",
          language: locale || "en",
          notifications: {
            email: true,
            push: true,
            voteUpdates: true,
            pollEnding: true,
          },
        },
        statistics: {
          totalVotes: 0,
          totalPollsCreated: 0,
          totalComments: 0,
          joinDate: new Date(),
          lastActive: new Date(),
        },
      });
      await user.save();
      console.log("User created from Google data with avatar");
    } else if (!user.googleId) {
      console.log("Linking Google account to existing user...");
      user.googleId = googleId;
      user.isVerified = true;
      if (!user.role || user.role === "admin") user.role = "user";
      if (!user.avatar && avatarUrl) user.avatar = avatarUrl;
      if (!user.fullName && name) user.fullName = name;
      if (locale && !user.preferences?.language) {
        if (!user.preferences) user.preferences = {};
        user.preferences.language = locale;
      }
      await user.save();
      console.log("Google account linked with avatar");
    } else {
      console.log("Existing user logged in");
      user.lastLogin = new Date();
      if (avatarUrl && !user.avatar) user.avatar = avatarUrl;
      await user.save();
    }

    user.lastLogin = new Date();
    if (user.statistics) user.statistics.lastActive = new Date();
    await user.save();

    // Generate JWT
    const jwtSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    const accessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: process.env.JWT_ACCESS_EXPIRE || "7d" },
    );

    // Return FULL user data with avatar
    const userData = {
      _id: user._id,
      id: user._id,
      name: user.name,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      avatar: user.avatar,
      phoneNumber: user.phoneNumber || "",
      companyName: user.companyName || "",
      bio: user.bio || "",
      location: user.location || { country: "", city: "", timezone: "UTC" },
      socialLinks: user.socialLinks || {
        website: "",
        twitter: "",
        linkedin: "",
        github: "",
      },
      preferences: user.preferences || {
        theme: "dark",
        notifications: {
          email: true,
          push: true,
          voteUpdates: true,
          pollEnding: true,
        },
        language: "en",
      },
      statistics: user.statistics || {
        totalVotes: 0,
        totalPollsCreated: 0,
        totalComments: 0,
        joinDate: user.createdAt,
        lastActive: user.lastLogin,
      },
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      googleId: user.googleId,
    };

    console.log("User data sent to frontend:", {
      name: userData.name,
      role: userData.role,
      hasAvatar: !!userData.avatar,
      avatarUrl: userData.avatar,
    });

    return res.json({
      success: true,
      data: {
        user: userData,
        accessToken,
      },
    });
  } catch (error) {
    console.error("Error in Google auth:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Google authentication failed",
    });
  }
});

module.exports = router;
