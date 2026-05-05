const express = require("express");
const { body, param, query } = require("express-validator");
const { protect, restrictTo } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");
const {
  // Dashboard & Analytics
  getDashboardStats,
  getAnalytics,
  getVoterTurnout,

  // User Management
  getAllUsers,
  getUserById,
  createUser,
  updateUserRole,
  toggleUserStatus,
  deleteUser,
  getActivityLogs,

  // Poll Management
  getAllPolls,
  getPollById,
  createPoll,
  updatePoll,
  deletePoll,
  publishPoll,
  unpublishPoll,

  // Vote Management
  getAllVotes,
  getPollResults,
  exportPollResults,

  // Comment Moderation
  getAllComments,
  deleteComment,
  moderateComment,

  // System Management
  getSystemLogs,
  clearCache,
  getBackup,

  // Category Management
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryById,

  // B2B Management
  getB2BRequests,
  getB2BSubscriptions,
  getB2BPayments,
  getB2BUsers,
  approveB2BRequest,
  rejectB2BRequest,

  // B2B Category Management (ADD THESE)
  getB2BCategories,
  createB2BCategory,
  updateB2BCategory,
  deleteB2BCategory,
} = require("../../controllers/admin.controller");

const router = express.Router();

// All admin routes require authentication AND admin role
router.use(protect);
router.use(restrictTo("admin"));

// ==================== DASHBOARD & ANALYTICS ====================
router.get("/dashboard", getDashboardStats);
router.get("/analytics", getAnalytics);
router.get("/turnout", getVoterTurnout);

// ==================== USER MANAGEMENT ====================
router.get("/users", getAllUsers);
router.post(
  "/users",
  validate([
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").optional().isLength({ min: 6 }),
    body("role").optional().isIn(["user", "admin", "moderator"]),
  ]),
  createUser,
);

router.get("/users/:id", validate([param("id").isMongoId()]), getUserById);
router.put(
  "/users/:id/role",
  validate([
    param("id").isMongoId(),
    body("role").isIn(["user", "admin", "moderator"]),
  ]),
  updateUserRole,
);
router.put(
  "/users/:id/status",
  validate([param("id").isMongoId(), body("isActive").isBoolean()]),
  toggleUserStatus,
);
router.delete("/users/:id", validate([param("id").isMongoId()]), deleteUser);
router.get("/logs/activity", getActivityLogs);

// ==================== POLL MANAGEMENT ====================
router.get("/polls", getAllPolls);
router.get("/polls/:id", validate([param("id").isMongoId()]), getPollById);
router.post(
  "/polls",
  validate([
    body("title").notEmpty().isLength({ max: 200 }),
    body("description").notEmpty().isLength({ max: 2000 }),
    body("category").isIn([
      "politics",
      "entertainment",
      "sports",
      "technology",
      "business",
      "education",
      "health",
      "gaming",
      "other",
    ]),
    body("candidates").isArray({ min: 2 }),
    body("endDate").isISO8601(),
    body("startDate").optional().isISO8601(),
  ]),
  createPoll,
);
router.put(
  "/polls/:id",
  validate([
    param("id").isMongoId(),
    body("title").optional().isLength({ max: 200 }),
    body("description").optional().isLength({ max: 2000 }),
  ]),
  updatePoll,
);
router.delete("/polls/:id", validate([param("id").isMongoId()]), deletePoll);
router.post(
  "/polls/:id/publish",
  validate([param("id").isMongoId()]),
  publishPoll,
);
router.post(
  "/polls/:id/unpublish",
  validate([param("id").isMongoId()]),
  unpublishPoll,
);

// ==================== VOTE MANAGEMENT ====================
router.get("/votes", getAllVotes);
router.get(
  "/polls/:id/results",
  validate([param("id").isMongoId()]),
  getPollResults,
);
router.get(
  "/polls/:id/export",
  validate([param("id").isMongoId()]),
  exportPollResults,
);

// ==================== COMMENT MODERATION ====================
router.get("/comments", getAllComments);
router.delete(
  "/comments/:id",
  validate([param("id").isMongoId()]),
  deleteComment,
);
router.put(
  "/comments/:id/moderate",
  validate([
    param("id").isMongoId(),
    body("status").isIn(["approved", "rejected", "flagged"]),
  ]),
  moderateComment,
);

// ==================== CATEGORY MANAGEMENT ====================
router.get("/categories", getAllCategories);
router.get(
  "/categories/:id",
  validate([param("id").isMongoId()]),
  getCategoryById,
);
router.post(
  "/categories",
  validate([
    body("name").notEmpty(),
    body("displayName").notEmpty(),
    body("icon").optional(),
    body("color").optional(),
    body("order").optional().isInt(),
  ]),
  createCategory,
);
router.put(
  "/categories/:id",
  validate([
    param("id").isMongoId(),
    body("displayName").optional(),
    body("description").optional(),
    body("icon").optional(),
    body("color").optional(),
    body("order").optional().isInt(),
    body("isActive").optional().isBoolean(),
  ]),
  updateCategory,
);
router.delete(
  "/categories/:id",
  validate([param("id").isMongoId()]),
  deleteCategory,
);

// ==================== B2B MANAGEMENT ====================
// B2B Requests
router.get("/b2b/requests", getB2BRequests);
router.put("/b2b/requests/:id/approve", approveB2BRequest);
router.post("/b2b/requests/:id/reject", rejectB2BRequest);

// B2B Subscriptions & Payments
router.get("/b2b/subscriptions", getB2BSubscriptions);
router.get("/b2b/payments", getB2BPayments);

// B2B Users
router.get("/b2b/users", getB2BUsers);

// B2B Categories (CRUD)
router.get("/b2b/categories", getB2BCategories);
router.post("/b2b/categories", createB2BCategory);
router.put("/b2b/categories/:id", updateB2BCategory);
router.delete("/b2b/categories/:id", deleteB2BCategory);

// ==================== SYSTEM MANAGEMENT ====================
router.get("/system/logs", getSystemLogs);
router.post("/system/cache/clear", clearCache);
router.get("/system/backup", getBackup);

module.exports = router;
