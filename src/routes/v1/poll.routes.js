const express = require("express");
const { body, param, query } = require("express-validator");
const { protect, restrictTo } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");
const {
  getAllPolls,
  getPollById,
  createPoll,
  updatePoll,
  deletePoll,
  publishPoll,
  unpublishPoll,
  getPollResults,
  getPollsByCategory,
  getMyPolls,
} = require("../../controllers/poll.controller");

const router = express.Router();

// Validation rules
const createPollValidation = [
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
    "other",
  ]),
  body("candidates")
    .isArray({ min: 2 })
    .withMessage("At least 2 candidates required"),
  body("candidates.*.name")
    .notEmpty()
    .withMessage("Candidate name is required"),
  body("endDate").isISO8601().withMessage("Invalid end date"),
  body("startDate").optional().isISO8601(),
];

const updatePollValidation = [
  body("title").optional().isLength({ max: 200 }),
  body("description").optional().isLength({ max: 2000 }),
  body("category")
    .optional()
    .isIn([
      "politics",
      "entertainment",
      "sports",
      "technology",
      "business",
      "education",
      "health",
      "other",
    ]),
];

// Public routes
router.get("/", getAllPolls);
router.get("/category/:category", getPollsByCategory);
router.get("/:id", validate([param("id").isMongoId()]), getPollById);
router.get("/:id/results", validate([param("id").isMongoId()]), getPollResults);

// Protected routes
router.use(protect);
router.get("/my/polls", getMyPolls);
router.post("/", validate(createPollValidation), createPoll);
router.put(
  "/:id",
  validate([param("id").isMongoId()], updatePollValidation),
  updatePoll,
);
router.delete("/:id", validate([param("id").isMongoId()]), deletePoll);
router.post("/:id/publish", validate([param("id").isMongoId()]), publishPoll);
router.post(
  "/:id/unpublish",
  validate([param("id").isMongoId()]),
  restrictTo("admin"),
  unpublishPoll,
);

module.exports = router;
