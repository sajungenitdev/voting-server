const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User.model");
const OTP = require("../models/OTP.model");
const ActivityLog = require("../models/ActivityLog.model");
const {
  sendOTPEmail,
  sendResetPasswordEmail,
  sendWelcomeEmail,
} = require("../services/email.service");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../utils/generateToken");
const AppError = require("../utils/AppError");

// Initialize Google OAuth client
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Get client IP
const getClientIP = (req) => {
  return (
    req.ip ||
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.connection.remoteAddress
  );
};

// Log activity
const logActivity = async (
  userId,
  email,
  action,
  status,
  req,
  details = {},
) => {
  try {
    await ActivityLog.create({
      user: userId,
      email,
      action,
      status,
      ipAddress: getClientIP(req),
      userAgent: req.headers["user-agent"],
      details,
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
};

// Normalize user data for response
const normalizeUser = (user) => {
  if (!user) return null;

  return {
    _id: user._id,
    id: user._id,
    name: user.name || "",
    fullName: user.fullName || "",
    displayName:
      user.fullName ||
      user.name ||
      user.companyName ||
      user.email?.split("@")[0],
    email: user.email || "",
    phoneNumber: user.phoneNumber || "",
    companyName: user.companyName || "",
    role: user.role || "user",
    isVerified: user.isVerified || false,
    isActive: user.isActive !== false,
    avatar: user.avatar || null,
    statistics: user.statistics || {
      totalVotes: 0,
      totalPollsCreated: 0,
      totalComments: 0,
      joinDate: user.createdAt,
      lastActive: user.lastLogin || user.createdAt,
    },
    subscription: user.subscription || null,
    b2bRequest: user.b2bRequest || null,
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
    location: user.location || null,
    bio: user.bio || "",
    socialLinks: user.socialLinks || null,
    apiKeys:
      user.apiKeys?.map((key) => ({
        name: key.name,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        isActive: key.isActive,
      })) || [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLogin: user.lastLogin,
    isB2BUser: user.role === "b2b_buyer" || !!user.companyName,
    hasActiveSubscription:
      user.subscription?.status === "active" &&
      user.subscription?.endDate &&
      new Date(user.subscription.endDate) > new Date(),
  };
};

// ==================== AUTH CONTROLLER FUNCTIONS ====================

// Register user
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    console.log("=== REGISTER ATTEMPT ===");
    console.log("Email:", email);
    console.log("Name:", name);

    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isVerified) {
      return next(new AppError(400, "Email already registered"));
    }

    let user;
    if (existingUser && !existingUser.isVerified) {
      user = existingUser;
      user.name = name;
      user.password = password;
      await user.save();
      console.log("Updated existing unverified user");
    } else {
      user = await User.create({
        name,
        email,
        password,
        isVerified: false,
        statistics: { joinDate: new Date() },
      });
      console.log("Created new user:", user._id);
    }

    const otp = generateOTP();
    await OTP.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    console.log("OTP created:", otp);

    try {
      await sendOTPEmail(email, otp, name);
      console.log("OTP email sent successfully");
    } catch (emailError) {
      console.error("Email sending failed but continuing:", emailError.message);
    }

    await logActivity(user._id, email, "REGISTER", "SUCCESS", req);

    res.status(201).json({
      success: true,
      message: "Registration successful! Please check your email for OTP",
      data: { email, requiresVerification: true },
    });
  } catch (error) {
    console.error("REGISTRATION ERROR:", error);
    await logActivity(null, req.body.email, "REGISTER", "FAILED", req, {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      message: error.message || "Registration failed",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// Verify OTP
const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const otpRecord = await OTP.findOne({
      email,
      otp,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      await logActivity(null, email, "VERIFY_OTP", "FAILED", req, {
        reason: "Invalid or expired OTP",
      });
      return next(new AppError(400, "Invalid or expired OTP"));
    }

    if (otpRecord.attempts >= 3) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return next(
        new AppError(400, "Too many failed attempts. Please request a new OTP"),
      );
    }

    const user = await User.findOne({ email });
    if (!user) {
      return next(new AppError(404, "User not found"));
    }

    user.isVerified = true;
    await user.save();
    await OTP.deleteOne({ _id: otpRecord._id });
    await sendWelcomeEmail(email, user.name);

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    if (user.statistics) user.statistics.lastActive = new Date();
    await user.save();

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await logActivity(user._id, email, "VERIFY_OTP", "SUCCESS", req);

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: { user: normalizeUser(user), accessToken },
    });
  } catch (error) {
    await logActivity(null, req.body.email, "VERIFY_OTP", "FAILED", req, {
      error: error.message,
    });
    next(error);
  }
};

// Resend OTP
const resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return next(new AppError(404, "User not found"));
    if (user.isVerified)
      return next(new AppError(400, "Email already verified"));

    await OTP.deleteMany({ email });

    const otp = generateOTP();
    await OTP.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    await sendOTPEmail(email, otp, user.name);

    res.status(200).json({
      success: true,
      message: "New OTP sent to your email",
    });
  } catch (error) {
    next(error);
  }
};

// Login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      await logActivity(null, email, "LOGIN", "FAILED", req, {
        reason: "User not found",
      });
      return next(new AppError(401, "Invalid email or password"));
    }

    if (user.isLocked && user.isLocked()) {
      return next(
        new AppError(401, "Account is locked. Please try again later"),
      );
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 30 * 60 * 1000;
      }
      await user.save();

      await logActivity(user._id, email, "LOGIN", "FAILED", req, {
        reason: "Invalid password",
      });
      return next(new AppError(401, "Invalid email or password"));
    }

    if (!user.isVerified) {
      return next(new AppError(401, "Please verify your email first"));
    }

    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    if (user.statistics) user.statistics.lastActive = new Date();
    await user.save();

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await logActivity(user._id, email, "LOGIN", "SUCCESS", req);

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      data: { user: normalizeUser(user), accessToken },
    });
  } catch (error) {
    await logActivity(null, req.body.email, "LOGIN", "FAILED", req, {
      error: error.message,
    });
    next(error);
  }
};

// Google Auth - Redirect
const googleAuth = (req, res) => {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile&access_type=offline&prompt=consent`;

  console.log("Redirecting to Google OAuth");
  res.redirect(googleAuthUrl);
};

// Google Auth - Callback
const googleCallback = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
  }

  try {
    console.log("=== GOOGLE CALLBACK RECEIVED ===");

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error("Token error:", tokens.error);
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=${tokens.error}`,
      );
    }

    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );

    const userInfo = await userInfoResponse.json();
    const { email, name, picture, id: googleId } = userInfo;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name: name || email.split("@")[0],
        email,
        googleId,
        isVerified: true,
        avatar: picture,
        password: crypto.randomBytes(32).toString("hex"),
        statistics: { joinDate: new Date() },
      });
      await sendWelcomeEmail(email, user.name).catch((err) =>
        console.error("Welcome email failed:", err.message),
      );
    } else if (!user.googleId) {
      user.googleId = googleId;
      user.isVerified = true;
      if (!user.avatar && picture) user.avatar = picture;
      await user.save();
    }

    user.lastLogin = new Date();
    if (user.statistics) user.statistics.lastActive = new Date();
    await user.save();

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    await logActivity(user._id, email, "GOOGLE_LOGIN", "SUCCESS", req);

    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}&refreshToken=${refreshToken}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Google callback error:", error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
  }
};

// Google Token Auth (One-Tap)
const googleTokenAuth = async (req, res) => {
  console.log("=== GOOGLE TOKEN AUTH ===");

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Google token is required",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    console.log("Google user:", email);

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name: name || email.split("@")[0],
        email,
        googleId,
        isVerified: true,
        avatar: picture,
        password: crypto.randomBytes(32).toString("hex"),
        statistics: { joinDate: new Date() },
      });
      console.log("User created");
    } else if (!user.googleId) {
      user.googleId = googleId;
      user.isVerified = true;
      if (picture) user.avatar = picture;
      await user.save();
      console.log("User updated");
    }

    user.lastLogin = new Date();
    if (user.statistics) user.statistics.lastActive = new Date();
    await user.save();

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.json({
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
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Google token error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Google authentication failed",
    });
  }
};

// Logout
const logout = async (req, res, next) => {
  try {
    if (req.user) {
      req.user.refreshToken = null;
      await req.user.save();
      await logActivity(req.user._id, req.user.email, "LOGOUT", "SUCCESS", req);
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Refresh token
const refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return next(new AppError(401, "Refresh token not found"));
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id).select("+refreshToken");

    if (!user || user.refreshToken !== refreshToken) {
      return next(new AppError(401, "Invalid refresh token"));
    }

    const newAccessToken = generateAccessToken(user._id);

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Token refreshed",
      data: { accessToken: newAccessToken },
    });
  } catch (error) {
    next(new AppError(401, "Invalid refresh token"));
  }
};

// Forgot password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return next(new AppError(404, "User not found with this email"));
    }

    const rawResetToken = crypto.randomBytes(32).toString("hex");
    const hashedResetToken = crypto
      .createHash("sha256")
      .update(rawResetToken)
      .digest("hex");

    user.resetPasswordToken = hashedResetToken;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${rawResetToken}`;
    await sendResetPasswordEmail(email, resetUrl, user.name);

    res.status(200).json({
      success: true,
      message: "Password reset email sent. Please check your inbox.",
    });
  } catch (error) {
    next(error);
  }
};

// Reset password
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return next(new AppError(400, "Invalid or expired reset token"));
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    await logActivity(user._id, user.email, "RESET_PASSWORD", "SUCCESS", req);

    res.status(200).json({
      success: true,
      message:
        "Password reset successful! Please login with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

// Get current user
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: { user: normalizeUser(req.user) },
    });
  } catch (error) {
    next(error);
  }
};

// Change password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return next(new AppError(404, "User not found"));
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return next(new AppError(401, "Current password is incorrect"));
    }

    user.password = newPassword;
    await user.save();

    await logActivity(user._id, user.email, "CHANGE_PASSWORD", "SUCCESS", req);

    res.status(200).json({
      success: true,
      message:
        "Password changed successfully. Please login with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

// Update profile
const updateProfile = async (req, res, next) => {
  try {
    const updateFields = {};

    const allowedFields = [
      "name",
      "fullName",
      "phoneNumber",
      "bio",
      "companyName",
      "location",
      "preferences",
      "socialLinks",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, updateFields, {
      new: true,
      runValidators: true,
    }).select(
      "-password -resetPasswordToken -resetPasswordExpire -refreshToken",
    );

    if (!user) {
      return next(new AppError(404, "User not found"));
    }

    await logActivity(user._id, user.email, "UPDATE_PROFILE", "SUCCESS", req);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: { user: normalizeUser(user) },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== EXPORTS ====================
module.exports = {
  register,
  verifyOTP,
  resendOTP,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  getMe,
  changePassword,
  updateProfile,
  googleAuth,
  googleCallback,
  googleTokenAuth,
};
