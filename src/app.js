const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const hpp = require("hpp");

const routes = require("./routes/v1/index");
const errorHandler = require("./middleware/error.middleware");
const { apiLimiter } = require("./middleware/rateLimit.middleware");
const AppError = require("./utils/AppError");

const app = express();

console.log("=== 🔧 CONFIGURING APP ===");

// ==================== CORS ====================
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-Requested-With",
    ],
  }),
);

// ==================== STANDARD MIDDLEWARE ====================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(compression());
app.use(hpp());

// Security headers (relaxed for development)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ==================== GOOGLE STANDALONE ROUTE ====================
// This MUST be before any other routes that might interfere
const googleStandalone = require("./routes/google-standalone");
app.use("/api/v1/auth/google", googleStandalone);
console.log("✅ Google standalone route mounted at /api/v1/auth/google");

// ==================== HEALTH CHECKS ====================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Voting Platform API",
    version: "1.0.0",
    endpoints: {
      google: "/api/v1/auth/google",
      api: "/api/v1",
      health: "/health",
    },
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ==================== API ROUTES ====================
app.use("/api", apiLimiter);
app.use("/api/v1", routes);
console.log("✅ API routes mounted");

// ==================== 404 HANDLER ====================
app.use((req, res, next) => {
  next(new AppError(404, `Cannot find ${req.originalUrl} on this server`));
});

// ==================== GLOBAL ERROR HANDLER ====================
app.use(errorHandler);

console.log("✅ App configuration complete");

module.exports = app;
