const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const hpp = require("hpp");
const xss = require("xss");
const fs = require("fs");

const routes = require("./routes/v1/index");
const errorHandler = require("./middleware/error.middleware");
const { apiLimiter } = require("./middleware/rateLimit.middleware");
const AppError = require("./utils/AppError");

const app = express();

console.log("=== 🔧 CONFIGURING APP ===");

// ==================== SECURITY MIDDLEWARE ====================

// Custom NoSQL Injection Prevention
const preventNoSQLInjection = (req, res, next) => {
  const dangerousKeys = [
    "$",
    "^",
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
    "|",
    "&",
    "*",
    "?",
    "+",
    "-",
    "=",
    "~",
    "`",
    "!",
    "@",
    "#",
    "%",
    ";",
    ":",
    '"',
    "'",
    "<",
    ">",
    ",",
    ".",
  ];

  const sanitize = (obj) => {
    if (!obj) return obj;
    for (let key in obj) {
      if (typeof obj[key] === "string") {
        for (let dKey of dangerousKeys) {
          if (obj[key].includes(dKey)) {
            obj[key] = obj[key].replace(new RegExp("\\" + dKey, "g"), "");
          }
        }
      } else if (typeof obj[key] === "object") {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);
  next();
};

// XSS Protection
const xssProtection = (req, res, next) => {
  if (req.body) {
    const sanitizeObject = (obj) => {
      for (let key in obj) {
        if (typeof obj[key] === "string") {
          obj[key] = xss(obj[key]);
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };
    sanitizeObject(req.body);
  }
  next();
};

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }),
);

app.use(xssProtection);
app.use(preventNoSQLInjection);

// ==================== CORS CONFIGURATION ====================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "https://voting-admin-dashboard-ecru.vercel.app",
  "https://voting-frontend-two-nu.vercel.app",
  "https://plus-vote.onrender.com",
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl)
      if (!origin) return callback(null, true);

      // Allow all in production (temporary for debugging)
      if (process.env.NODE_ENV === "production") {
        return callback(null, true);
      }

      // Check against allowed origins
      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        process.env.NODE_ENV !== "production"
      ) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked: ${origin}`);
        callback(null, true); // Still allow for debugging
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Cookie",
    ],
    exposedHeaders: ["Authorization"],
  }),
);

// ==================== STANDARD MIDDLEWARE ====================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(hpp());
app.use(compression());

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Favicon handler
app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

// ==================== HEALTH AND ROOT ROUTES ====================

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Voting Platform API",
    version: "1.0.0",
    status: "active",
    endpoints: {
      auth: "/api/v1/auth",
      polls: "/api/v1/polls",
      votes: "/api/v1/votes",
      b2b: "/api/v1/b2b",
      categories: "/api/v1/categories",
      comments: "/api/v1/comments",
      admin: "/api/v1/admin",
    },
    health: "/health",
    documentation: "/api/v1",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    mongodb: "connected",
  });
});

// Apply rate limiting to API routes
app.use("/api", apiLimiter);

// ==================== API ROUTES ====================
console.log("Mounting API routes...");

try {
  app.use("/api/v1", routes);
  console.log("✅ API routes mounted successfully");
} catch (error) {
  console.error("❌ Failed to mount API routes:", error.message);
}

// ==================== 404 HANDLER ====================
app.use((req, res, next) => {
  next(new AppError(404, `Cannot find ${req.originalUrl} on this server`));
});

// ==================== GLOBAL ERROR HANDLER ====================
app.use(errorHandler);

console.log("✅ App configuration complete");

module.exports = app;
