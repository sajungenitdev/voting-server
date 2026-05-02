const express = require("express");
const { protect, restrictTo } = require("../../middleware/auth.middleware");
const {
  getAllCategories,
  getCategoryByName,
  createCategory,
} = require("../../controllers/category.controller");

const router = express.Router();

// Public routes
router.get("/", getAllCategories);
router.get("/:name", getCategoryByName);

// Admin only routes
router.post("/", protect, restrictTo("admin"), createCategory);

module.exports = router;
