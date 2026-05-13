const express = require("express");
const { body, param, query } = require("express-validator");
const {
  protectB2B,
  authenticateApiKey,
  requireSubscription,
} = require("../../middleware/b2bAuth.middleware");
const { validate } = require("../../middleware/validation.middleware");
const {
  // Public routes
  submitRequest,
  verifyOTP,
  resendOTP,
  getDataCategories,
  getSubscriptionPlans,
  b2bLogin,
  // Protected routes
  getProfile,
  updateProfile,
  createSubscription,
  getMySubscription,
  cancelSubscription,
  getInvoice,
  getPaymentHistory,
  validateAccess,
  getMyRequests,
  getRequestById,
  getUserData,
  generateApiKey,
  getApiKeys,
  revokeApiKey,
  getDashboardStats,
  confirmPayment,
} = require("../../controllers/b2b.controller");

const router = express.Router();

// ==================== VALIDATION RULES ====================

const submitRequestValidation = [
  body("fullName").notEmpty().withMessage("Full name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("phoneNumber").notEmpty().withMessage("Phone number is required"),
  body("purpose").notEmpty().withMessage("Purpose is required"),
  body("selectedCategories")
    .isArray({ min: 1 })
    .withMessage("At least one category must be selected"),
  body("termsAgreed")
    .isBoolean()
    .custom((value) => value === true || value === "true")
    .withMessage("You must agree to Terms & Policy"),
  body("complianceAgreed")
    .isBoolean()
    .custom((value) => value === true || value === "true")
    .withMessage("You must agree to Data Usage Compliance"),
];

const verifyOTPValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("otp").isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
  body("requestId").isMongoId().withMessage("Invalid request ID"),
];

const createSubscriptionValidation = [
  body("tier")
    .isIn(["basic", "standard", "premium"])
    .withMessage("Invalid subscription tier"),
  body("paymentMethod")
    .isIn([
      "credit_card",
      "debit_card",
      "bank_transfer",
      "bkash",
      "nagad",
      "rocket",
      "paypal",
      "stripe",
    ])
    .withMessage("Invalid payment method"),
  body("autoRenew").optional().isBoolean(),
  body("cardDetails").optional().isObject(),
  body("billingAddress").optional().isObject(),
  body("couponCode").optional().isString(),
];

const generateApiKeyValidation = [
  body("name").notEmpty().withMessage("API key name is required"),
  body("permissions").optional().isArray(),
  body("allowedCategories").optional().isArray(),
];

const confirmPaymentValidation = [
  body("subscriptionId").isMongoId().withMessage("Invalid subscription ID"),
  body("transactionId").optional().notEmpty(),
];

// ==================== PUBLIC ROUTES (No Authentication Required) ====================

/**
 * @route   POST /api/v1/b2b/login
 * @desc    B2B user login
 * @access  Public
 */
router.post("/login", b2bLogin);

/**
 * @route   POST /api/v1/b2b/request
 * @desc    Submit data access request
 * @access  Public
 */
router.post("/request", validate(submitRequestValidation), submitRequest);

/**
 * @route   POST /api/v1/b2b/verify-otp
 * @desc    Verify OTP and complete account creation
 * @access  Public
 */
router.post("/verify-otp", validate(verifyOTPValidation), verifyOTP);

/**
 * @route   POST /api/v1/b2b/resend-otp
 * @desc    Resend OTP verification code
 * @access  Public
 */
router.post(
  "/resend-otp",
  validate([
    body("email").isEmail().withMessage("Valid email is required"),
    body("requestId").isMongoId().withMessage("Invalid request ID"),
  ]),
  resendOTP,
);

/**
 * @route   GET /api/v1/b2b/categories
 * @desc    Get available data categories
 * @access  Public
 */
router.get("/categories", getDataCategories);

/**
 * @route   GET /api/v1/b2b/plans
 * @desc    Get subscription plans
 * @access  Public
 */
router.get("/plans", getSubscriptionPlans);

// ==================== API KEY PROTECTED ROUTES (External API Access) ====================
// These routes use API Key authentication, not JWT
// They MUST be placed BEFORE router.use(protectB2B)

/**
 * @route   GET /api/v1/b2b/api/data
 * @desc    Access data via API key
 * @access  API Key
 */
router.get("/api/data", authenticateApiKey, requireSubscription, getUserData);

// ==================== JWT PROTECTED ROUTES (Authentication Required) ====================

// Apply JWT authentication middleware to all routes below
router.use(protectB2B);

/**
 * @route   POST /api/v1/b2b/confirm-payment
 * @desc    Confirm payment and activate subscription
 * @access  Private (B2B User)
 */
router.post(
  "/confirm-payment",
  validate(confirmPaymentValidation),
  confirmPayment,
);

/**
 * @route   GET /api/v1/b2b/profile
 * @desc    Get B2B user profile
 * @access  Private (B2B User)
 */
router.get("/profile", getProfile);

/**
 * @route   PUT /api/v1/b2b/profile
 * @desc    Update B2B user profile
 * @access  Private (B2B User)
 */
router.put(
  "/profile",
  validate([
    body("companyName").optional().notEmpty(),
    body("phoneNumber").optional().notEmpty(),
    body("billingAddress").optional().isObject(),
  ]),
  updateProfile,
);

/**
 * @route   GET /api/v1/b2b/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private (B2B User)
 */
router.get("/dashboard/stats", getDashboardStats);

// ==================== SUBSCRIPTION ROUTES ====================

/**
 * @route   POST /api/v1/b2b/subscribe
 * @desc    Create/activate subscription
 * @access  Private (B2B User)
 */
router.post(
  "/subscribe",
  validate(createSubscriptionValidation),
  createSubscription,
);

/**
 * @route   GET /api/v1/b2b/my-subscription
 * @desc    Get current subscription details
 * @access  Private (B2B User)
 */
router.get("/my-subscription", getMySubscription);

/**
 * @route   POST /api/v1/b2b/cancel-subscription
 * @desc    Cancel current subscription
 * @access  Private (B2B User)
 */
router.post("/cancel-subscription", cancelSubscription);

/**
 * @route   GET /api/v1/b2b/invoice/:invoiceNumber
 * @desc    Get invoice by invoice number
 * @access  Private (B2B User)
 */
router.get(
  "/invoice/:invoiceNumber",
  validate([
    param("invoiceNumber").notEmpty().withMessage("Invoice number is required"),
  ]),
  getInvoice,
);

/**
 * @route   GET /api/v1/b2b/payment-history
 * @desc    Get payment history
 * @access  Private (B2B User)
 */
router.get("/payment-history", getPaymentHistory);

// ==================== ACCESS & VALIDATION ROUTES ====================

/**
 * @route   POST /api/v1/b2b/validate-access
 * @desc    Validate subscription access
 * @access  Private (B2B User)
 */
router.post("/validate-access", validateAccess);

/**
 * @route   GET /api/v1/b2b/data
 * @desc    Get user data based on subscription (JWT version)
 * @access  Private (B2B User with active subscription)
 */
router.get("/data", requireSubscription, getUserData);

// ==================== REQUEST MANAGEMENT ROUTES ====================

/**
 * @route   GET /api/v1/b2b/my-requests
 * @desc    Get user's request history
 * @access  Private (B2B User)
 */
router.get("/my-requests", getMyRequests);

/**
 * @route   GET /api/v1/b2b/requests/:id
 * @desc    Get specific request details
 * @access  Private (B2B User)
 */
router.get(
  "/requests/:id",
  validate([param("id").isMongoId().withMessage("Invalid request ID")]),
  getRequestById,
);

// ==================== API KEY MANAGEMENT ROUTES ====================

/**
 * @route   POST /api/v1/b2b/api-keys
 * @desc    Generate new API key
 * @access  Private (B2B User with active subscription)
 */
router.post(
  "/api-keys",
  requireSubscription,
  validate(generateApiKeyValidation),
  generateApiKey,
);

/**
 * @route   GET /api/v1/b2b/api-keys
 * @desc    Get all API keys
 * @access  Private (B2B User)
 */
router.get("/api-keys", getApiKeys);

/**
 * @route   DELETE /api/v1/b2b/api-keys/:id
 * @desc    Revoke API key
 * @access  Private (B2B User)
 */
router.delete(
  "/api-keys/:id",
  validate([param("id").isMongoId().withMessage("Invalid API key ID")]),
  revokeApiKey,
);

// ==================== ROOT ROUTE HANDLER (Optional) ====================

/**
 * @route   GET /api/v1/b2b
 * @desc    B2B API root endpoint
 * @access  Public
 */
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "B2B API v1",
    version: "1.0.0",
    endpoints: {
      public: [
        "POST /b2b/login",
        "POST /b2b/request",
        "POST /b2b/verify-otp",
        "POST /b2b/resend-otp",
        "GET /b2b/categories",
        "GET /b2b/plans",
      ],
      protected: [
        "GET /b2b/profile",
        "PUT /b2b/profile",
        "GET /b2b/dashboard/stats",
        "POST /b2b/subscribe",
        "GET /b2b/my-subscription",
        "POST /b2b/cancel-subscription",
        "GET /b2b/invoice/:invoiceNumber",
        "GET /b2b/payment-history",
        "POST /b2b/validate-access",
        "GET /b2b/data",
        "GET /b2b/my-requests",
        "GET /b2b/requests/:id",
        "POST /b2b/api-keys",
        "GET /b2b/api-keys",
        "DELETE /b2b/api-keys/:id",
        "POST /b2b/confirm-payment",
      ],
      apiKey: ["GET /b2b/api/data"],
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
