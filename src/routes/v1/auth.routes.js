const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../../middleware/validation.middleware");
const { protect } = require("../../middleware/auth.middleware");
const { authLimiter } = require("../../middleware/rateLimit.middleware");
const {
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
} = require("../../controllers/auth.controller");

const router = express.Router();

// ==================== VALIDATION RULES ====================

// Register validation
const registerValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .matches(/\d/)
    .withMessage("Password must contain at least one number"),
];

// Login validation
const loginValidation = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

// OTP validation
const otpValidation = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
  body("otp")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must contain only numbers"),
];

// Resend OTP validation
const resendOTPValidation = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
];

// Forgot password validation
const forgotPasswordValidation = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
];

// Reset password validation
const resetPasswordValidation = [
  body("token").notEmpty().withMessage("Reset token is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .matches(/\d/)
    .withMessage("Password must contain at least one number"),
];

// Change password validation
const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters")
    .matches(/\d/)
    .withMessage("New password must contain at least one number"),
];

// Refresh token validation
const refreshTokenValidation = [
  body("refreshToken")
    .optional()
    .notEmpty()
    .withMessage("Refresh token is required"),
];

// ==================== PUBLIC ROUTES (No Authentication Required) ====================

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post("/register", authLimiter, validate(registerValidation), register);

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verify email with OTP
 * @access  Public
 */
router.post("/verify-otp", authLimiter, validate(otpValidation), verifyOTP);

/**
 * @route   POST /api/v1/auth/resend-otp
 * @desc    Resend OTP to email
 * @access  Public
 */
router.post(
  "/resend-otp",
  authLimiter,
  validate(resendOTPValidation),
  resendOTP,
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post("/login", authLimiter, validate(loginValidation), login);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post(
  "/forgot-password",
  authLimiter,
  validate(forgotPasswordValidation),
  forgotPassword,
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  "/reset-password",
  authLimiter,
  validate(resetPasswordValidation),
  resetPassword,
);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public (uses refresh token from cookie)
 */
router.post("/refresh-token", refreshToken);

// ==================== PROTECTED ROUTES (Authentication Required) ====================

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post("/logout", protect, logout);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current logged in user
 * @access  Private
 */
router.get("/me", protect, getMe);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  "/change-password",
  protect,
  validate(changePasswordValidation),
  changePassword,
);

module.exports = router;
