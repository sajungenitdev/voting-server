const express = require("express");
const authRoutes = require("./auth.routes");  // ← ADD THIS
const adminRoutes = require("./admin.routes");  // ← ADD THIS (if exists)

const router = express.Router();

// Mount routes
router.use("/auth", authRoutes);
router.use("/admin", adminRoutes); // Admin routes are protected internally

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