const express = require("express");
const path = require("path");
const fs = require("fs");
const authRoutes = require("./auth.routes");
const adminRoutes = require("./admin.routes");
const pollRoutes = require("./poll.routes");
const voteRoutes = require("./vote.routes");
const categoryRoutes = require("./category.routes");
const commentRoutes = require("./comment.routes");
const b2bRoutes = require("./b2b.routes");

const router = express.Router();

// ==================== DEBUG ROUTES (Remove after fixing) ====================

// Debug: Check file system paths
router.get("/debug/paths", (req, res) => {
  const basePath = path.join(__dirname, "../..");

  const checkFile = (filePath) => {
    try {
      const fullPath = path.join(basePath, filePath);
      return {
        path: fullPath,
        exists: fs.existsSync(fullPath),
      };
    } catch (e) {
      return {
        path: filePath,
        exists: false,
        error: e.message,
      };
    }
  };

  res.json({
    success: true,
    message: "Debug path information",
    data: {
      currentDirectory: __dirname,
      projectRoot: basePath,
      files: {
        authController: checkFile("controllers/auth.controller.js"),
        authMiddleware: checkFile("middleware/auth.middleware.js"),
        validationMiddleware: checkFile("middleware/validation.middleware.js"),
        rateLimitMiddleware: checkFile("middleware/rateLimit.middleware.js"),
        userModel: checkFile("models/User.model.js"),
      },
      nodeEnv: process.env.NODE_ENV,
      platform: process.platform,
    },
  });
});

// Debug: Check if auth routes are mounted
router.get("/debug/auth-status", (req, res) => {
  res.json({
    success: true,
    message: "Auth routes check",
    authRoutesLoaded: !!authRoutes,
    authRoutesType: typeof authRoutes,
    availableEndpoints: [
      "POST /api/v1/auth/register",
      "POST /api/v1/auth/login",
      "POST /api/v1/auth/verify-otp",
      "POST /api/v1/auth/resend-otp",
      "GET /api/v1/auth/test",
      "POST /api/v1/auth/forgot-password",
      "POST /api/v1/auth/reset-password",
      "GET /api/v1/auth/me",
      "POST /api/v1/auth/change-password",
      "PUT /api/v1/auth/update-profile",
      "POST /api/v1/auth/logout",
    ],
  });
});

// Simple ping test
router.get("/ping", (req, res) => {
  res.json({
    success: true,
    message: "pong",
    timestamp: new Date().toISOString(),
  });
});

// ==================== MAIN ROUTES ====================

// Root route handler
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
      debug: {
        paths: "/api/v1/debug/paths",
        authStatus: "/api/v1/debug/auth-status",
        ping: "/api/v1/ping",
      },
    },
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Mount routes with error handling
try {
  console.log("✅ Mounting auth routes at /auth");
  router.use("/auth", authRoutes);
} catch (error) {
  console.error("❌ Failed to mount auth routes:", error.message);
  router.use("/auth", (req, res) => {
    res.status(500).json({
      success: false,
      message: "Auth routes failed to load",
      error: error.message,
    });
  });
}

// Mount other routes
try {
  router.use("/admin", adminRoutes);
  console.log("✅ Admin routes mounted");
} catch (error) {
  console.error("❌ Failed to mount admin routes:", error.message);
}

try {
  router.use("/polls", pollRoutes);
  console.log("✅ Poll routes mounted");
} catch (error) {
  console.error("❌ Failed to mount poll routes:", error.message);
}

try {
  router.use("/votes", voteRoutes);
  console.log("✅ Vote routes mounted");
} catch (error) {
  console.error("❌ Failed to mount vote routes:", error.message);
}

try {
  router.use("/categories", categoryRoutes);
  console.log("✅ Category routes mounted");
} catch (error) {
  console.error("❌ Failed to mount category routes:", error.message);
}

try {
  router.use("/comments", commentRoutes);
  console.log("✅ Comment routes mounted");
} catch (error) {
  console.error("❌ Failed to mount comment routes:", error.message);
}

try {
  router.use("/b2b", b2bRoutes);
  console.log("✅ B2B routes mounted");
} catch (error) {
  console.error("❌ Failed to mount b2b routes:", error.message);
}

// Test route
router.get("/status", (req, res) => {
  res.json({
    success: true,
    message: "API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Health check for API
router.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
