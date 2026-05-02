const express = require("express");
const authRoutes = require("./auth.routes");
const adminRoutes = require("./admin.routes");
const pollRoutes = require("./poll.routes");
const voteRoutes = require("./vote.routes");
const categoryRoutes = require("./category.routes");
const commentRoutes = require("./comment.routes");

const router = express.Router();

// Mount routes
router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/polls", pollRoutes);
router.use("/votes", voteRoutes);
router.use("/categories", categoryRoutes);
router.use("/votes", voteRoutes);
router.use("/comments", commentRoutes);

// Test route
router.get("/status", (req, res) => {
  res.json({
    success: true,
    message: "API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Health check for API
router.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    uptime: process.uptime(),
  });
});

module.exports = router;
