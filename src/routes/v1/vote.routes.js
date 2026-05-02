const express = require("express");
const { body, param, query } = require("express-validator");
const { protect, restrictTo } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");
const { voteLimiter } = require("../../middleware/rateLimit.middleware");
const {
  castVote,
  getMyVotes,
  getVoteReceipt,
  hasVoted,
  getPollVoteResults,
  getPollVotes,
  getVoteStatistics,
} = require("../../controllers/vote.controller");

const router = express.Router();

// Validation rules
const castVoteValidation = [
  body("pollId").isMongoId().withMessage("Invalid poll ID"),
  body("candidateId").isMongoId().withMessage("Invalid candidate ID"),
];

// Protected routes (require authentication)
router.use(protect);

// User routes
router.post("/", voteLimiter, validate(castVoteValidation), castVote);
router.get("/my-votes", getMyVotes);
router.get(
  "/receipt/:id",
  validate([param("id").isMongoId().withMessage("Invalid vote ID")]),
  getVoteReceipt,
);
router.get(
  "/check/:pollId",
  validate([param("pollId").isMongoId().withMessage("Invalid poll ID")]),
  hasVoted,
);

// Public results (no auth required, but we'll keep in protected for consistency)
router.get(
  "/results/:pollId",
  validate([param("pollId").isMongoId().withMessage("Invalid poll ID")]),
  getPollVoteResults,
);

// Admin only routes
router.use(restrictTo("admin"));
router.get(
  "/poll/:pollId",
  validate([param("pollId").isMongoId().withMessage("Invalid poll ID")]),
  getPollVotes,
);
router.get("/statistics", getVoteStatistics);

module.exports = router;
