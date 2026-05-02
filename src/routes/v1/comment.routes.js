const express = require("express");
const { body, param, query } = require("express-validator");
const { protect, restrictTo } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");
const {
  addComment,
  getPollComments,
  getCommentReplies,
  getCommentById,
  updateComment,
  deleteComment,
  likeComment,
  getFlaggedComments,
  flagComment,
  moderateComment,
} = require("../../controllers/comment.controller");

const router = express.Router();

// Validation rules
const addCommentValidation = [
  body("pollId").isMongoId().withMessage("Invalid poll ID"),
  body("content")
    .notEmpty()
    .withMessage("Comment content is required")
    .isLength({ max: 1000 }),
  body("parentCommentId")
    .optional()
    .isMongoId()
    .withMessage("Invalid parent comment ID"),
];

const updateCommentValidation = [
  body("content")
    .notEmpty()
    .withMessage("Comment content is required")
    .isLength({ max: 1000 }),
];

// Public routes (with optional auth)
router.get("/poll/:pollId", getPollComments);
router.get("/replies/:commentId", getCommentReplies);
router.get("/:id", getCommentById);

// Protected routes (require authentication)
router.use(protect);

// User routes
router.post("/", validate(addCommentValidation), addComment);
router.put("/:id", validate(updateCommentValidation), updateComment);
router.delete("/:id", deleteComment);
router.post("/:id/like", likeComment);
router.post("/:id/flag", flagComment);

// Admin only routes
router.use(restrictTo("admin"));
router.get("/admin/flagged", getFlaggedComments);
router.post("/admin/:id/moderate", moderateComment);

module.exports = router;
