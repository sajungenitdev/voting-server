const crypto = require("crypto");
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
} = require("../utils/generateToken");
const AppError = require("../utils/AppError");

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

// Register user - UPDATED with better error handling
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    console.log("=== REGISTER ATTEMPT ===");
    console.log("Email:", email);
    console.log("Name:", name);

    // Check if user exists and verified
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isVerified) {
      return next(new AppError(400, "Email already registered"));
    }

    // If user exists but not verified, update info
    let user;
    if (existingUser && !existingUser.isVerified) {
      user = existingUser;
      user.name = name;
      user.password = password;
      await user.save();
      console.log("Updated existing unverified user");
    } else {
      // Create new user
      user = await User.create({
        name,
        email,
        password,
        isVerified: false,
      });
      console.log("Created new user:", user._id);
    }

    // Generate and save OTP
    const otp = generateOTP();
    await OTP.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });
    console.log("OTP created:", otp);

    // Send OTP email - WITH ERROR HANDLING
    try {
      await sendOTPEmail(email, otp, name);
      console.log("OTP email sent successfully");
    } catch (emailError) {
      console.error("Email sending failed but continuing:", emailError.message);
      // Don't fail registration if email fails
      // You can still return success and let user know
    }

    // Log activity
    await logActivity(user._id, email, "REGISTER", "SUCCESS", req);

    res.status(201).json({
      success: true,
      message: "Registration successful! Please check your email for OTP",
      data: {
        email,
        requiresVerification: true,
      },
    });
  } catch (error) {
    console.error("REGISTRATION ERROR:", error);
    await logActivity(null, req.body.email, "REGISTER", "FAILED", req, {
      error: error.message,
    });

    // Send detailed error for debugging
    res.status(500).json({
      success: false,
      message: error.message || "Registration failed",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    // Find valid OTP
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

    // Check OTP attempts
    if (otpRecord.attempts >= 3) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return next(
        new AppError(400, "Too many failed attempts. Please request a new OTP"),
      );
    }

    // Find and verify user
    const user = await User.findOne({ email });
    if (!user) {
      return next(new AppError(404, "User not found"));
    }

    user.isVerified = true;
    await user.save();

    // Delete used OTP
    await OTP.deleteOne({ _id: otpRecord._id });

    // Send welcome email
    await sendWelcomeEmail(email, user.name);

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Set cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Log activity
    await logActivity(user._id, email, "VERIFY_OTP", "SUCCESS", req);

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        accessToken,
      },
    });
  } catch (error) {
    await logActivity(null, req.body.email, "VERIFY_OTP", "FAILED", req, {
      error: error.message,
    });
    next(error);
  }
};

// Resend OTP
exports.resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return next(new AppError(404, "User not found"));
    }

    if (user.isVerified) {
      return next(new AppError(400, "Email already verified"));
    }

    // Delete old OTPs
    await OTP.deleteMany({ email });

    // Generate new OTP
    const otp = generateOTP();
    await OTP.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // Send new OTP
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
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      await logActivity(null, email, "LOGIN", "FAILED", req, {
        reason: "User not found",
      });
      return next(new AppError(401, "Invalid email or password"));
    }

    // Check if account is locked
    if (user.isLocked && user.isLocked()) {
      return next(
        new AppError(401, "Account is locked. Please try again later"),
      );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Increment login attempts
      user.loginAttempts += 1;
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 30 * 60 * 1000; // Lock for 30 minutes
      }
      await user.save();

      await logActivity(user._id, email, "LOGIN", "FAILED", req, {
        reason: "Invalid password",
      });
      return next(new AppError(401, "Invalid email or password"));
    }

    // Check if email is verified
    if (!user.isVerified) {
      return next(new AppError(401, "Please verify your email first"));
    }

    // Reset login attempts
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Set cookies
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

    // Log activity
    await logActivity(user._id, email, "LOGIN", "SUCCESS", req);

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        accessToken,
      },
    });
  } catch (error) {
    await logActivity(null, req.body.email, "LOGIN", "FAILED", req, {
      error: error.message,
    });
    next(error);
  }
};

// Logout
exports.logout = async (req, res, next) => {
  try {
    // Clear refresh token from database
    if (req.user) {
      req.user.refreshToken = null;
      await req.user.save();
      await logActivity(req.user._id, req.user.email, "LOGOUT", "SUCCESS", req);
    }

    // Clear cookies
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
exports.refreshToken = async (req, res, next) => {
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

    // Generate new access token
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
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return next(new AppError(404, "User not found with this email"));
    }

    // ✅ Generate RAW token (32 characters) - THIS GOES IN EMAIL
    const rawResetToken = crypto.randomBytes(32).toString("hex");

    // ✅ Store HASHED version (64 characters) in database
    const hashedResetToken = crypto
      .createHash("sha256")
      .update(rawResetToken)
      .digest("hex");

    user.resetPasswordToken = hashedResetToken;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save();

    // ✅ IMPORTANT: Send RAW token (32 chars) in URL
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
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Hash the incoming RAW token to compare with stored HASH
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user by hashed token
    const user = await User.findOne({
      resetPasswordToken: hashedToken, // ← Compare with hashed version
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return next(new AppError(400, "Invalid or expired reset token"));
    }

    // Update password
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
exports.getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: { user: req.user },
    });
  } catch (error) {
    next(error);
  }
};

// Change password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password field
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return next(new AppError(404, "User not found"));
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return next(new AppError(401, "Current password is incorrect"));
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Log activity
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

exports.updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name },
      { new: true, runValidators: true },
    ).select(
      "-password -resetPasswordToken -resetPasswordExpire -refreshToken",
    );

    if (!user) {
      return next(new AppError(404, "User not found"));
    }

    await logActivity(user._id, user.email, "UPDATE_PROFILE", "SUCCESS", req);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};
