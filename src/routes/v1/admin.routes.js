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

  // Category Management (ADD THESE)
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryById,
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
router.get(
  "/users/:id",
  validate([param("id").isMongoId().withMessage("Invalid user ID")]),
  getUserById,
);

router.put(
  "/users/:id/role",
  validate([
    param("id").isMongoId().withMessage("Invalid user ID"),
    body("role")
      .isIn(["user", "admin", "moderator"])
      .withMessage("Invalid role"),
  ]),
  updateUserRole,
);

router.put(
  "/users/:id/status",
  validate([
    param("id").isMongoId().withMessage("Invalid user ID"),
    body("isActive").isBoolean().withMessage("isActive must be boolean"),
  ]),
  toggleUserStatus,
);

router.delete(
  "/users/:id",
  validate([param("id").isMongoId().withMessage("Invalid user ID")]),
  deleteUser,
);

router.get("/logs/activity", getActivityLogs);

// ==================== POLL MANAGEMENT ====================
router.get("/polls", getAllPolls);
router.get(
  "/polls/:id",
  validate([param("id").isMongoId().withMessage("Invalid poll ID")]),
  getPollById,
);

router.post(
  "/polls",
  validate([
    body("title")
      .notEmpty()
      .withMessage("Title is required")
      .isLength({ max: 200 }),
    body("description")
      .notEmpty()
      .withMessage("Description is required")
      .isLength({ max: 2000 }),
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
    body("candidates")
      .isArray({ min: 2 })
      .withMessage("At least 2 candidates required"),
    body("endDate").isISO8601().withMessage("Invalid end date"),
    body("startDate").optional().isISO8601(),
  ]),
  createPoll,
);

router.put(
  "/polls/:id",
  validate([
    param("id").isMongoId().withMessage("Invalid poll ID"),
    body("title").optional().isLength({ max: 200 }),
    body("description").optional().isLength({ max: 2000 }),
  ]),
  updatePoll,
);

router.delete(
  "/polls/:id",
  validate([param("id").isMongoId().withMessage("Invalid poll ID")]),
  deletePoll,
);

router.post(
  "/polls/:id/publish",
  validate([param("id").isMongoId().withMessage("Invalid poll ID")]),
  publishPoll,
);

router.post(
  "/polls/:id/unpublish",
  validate([param("id").isMongoId().withMessage("Invalid poll ID")]),
  unpublishPoll,
);

// ==================== VOTE MANAGEMENT ====================
router.get("/votes", getAllVotes);
router.get(
  "/polls/:id/results",
  validate([param("id").isMongoId().withMessage("Invalid poll ID")]),
  getPollResults,
);

router.get(
  "/polls/:id/export",
  validate([param("id").isMongoId().withMessage("Invalid poll ID")]),
  exportPollResults,
);

// ==================== COMMENT MODERATION ====================
router.get("/comments", getAllComments);
router.delete(
  "/comments/:id",
  validate([param("id").isMongoId().withMessage("Invalid comment ID")]),
  deleteComment,
);

router.put(
  "/comments/:id/moderate",
  validate([
    param("id").isMongoId().withMessage("Invalid comment ID"),
    body("status")
      .isIn(["approved", "rejected", "flagged"])
      .withMessage("Invalid status"),
  ]),
  moderateComment,
);

// ==================== CATEGORY MANAGEMENT ====================
// Get all categories
router.get("/categories", getAllCategories);

// Get single category
router.get(
  "/categories/:id",
  validate([param("id").isMongoId().withMessage("Invalid category ID")]),
  getCategoryById,
);

// Create new category
router.post(
  "/categories",
  validate([
    body("name").notEmpty().withMessage("Category name is required"),
    body("displayName").notEmpty().withMessage("Display name is required"),
    body("icon").optional(),
    body("color").optional(),
    body("order").optional().isInt(),
  ]),
  createCategory,
);

// Update category
router.put(
  "/categories/:id",
  validate([
    param("id").isMongoId().withMessage("Invalid category ID"),
    body("displayName").optional(),
    body("description").optional(),
    body("icon").optional(),
    body("color").optional(),
    body("order").optional().isInt(),
    body("isActive").optional().isBoolean(),
  ]),
  updateCategory,
);

// Delete category
router.delete(
  "/categories/:id",
  validate([param("id").isMongoId().withMessage("Invalid category ID")]),
  deleteCategory,
);

// ==================== SYSTEM MANAGEMENT ====================
router.get("/system/logs", getSystemLogs);
router.post("/system/cache/clear", clearCache);
router.get("/system/backup", getBackup);

module.exports = router;
