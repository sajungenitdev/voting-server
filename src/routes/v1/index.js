const express = require("express");
const authRoutes = require("./auth.routes");
const adminRoutes = require("./admin.routes");
const pollRoutes = require("./poll.routes");
const voteRoutes = require("./vote.routes");
const categoryRoutes = require("./category.routes");
const commentRoutes = require("./comment.routes");
const b2bRoutes = require("./b2b.routes");

const router = express.Router();

// Add root route handler - THIS PREVENTS THE "/" 404 ERROR
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Voting Platform API v1",
    version: "1.0.0",
    endpoints: {
      auth: "/api/v1/auth",
      admin: "/api/v1/admin",
      polls: "/api/v1/polls",
      votes: "/api/v1/votes",
      categories: "/api/v1/categories",
      comments: "/api/v1/comments",
      b2b: "/api/v1/b2b",
      status: "/api/v1/status",
      health: "/api/v1/health",
    },
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/polls", pollRoutes);
router.use("/votes", voteRoutes);
router.use("/categories", categoryRoutes);
router.use("/comments", commentRoutes);
router.use("/b2b", b2bRoutes);

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

// NO CATCH-ALL ROUTE - Let the main app.js handle 404s

module.exports = router;
