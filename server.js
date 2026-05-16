const http = require("http");
const path = require("path");
const dotenv = require("dotenv");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

// Load environment variables FIRST
dotenv.config();

// ==================== STARTUP CHECKS ====================
console.log("=== 🚀 SERVER STARTING ===");
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`Port: ${process.env.PORT || 5000}`);

// Validate critical environment variables
const requiredEnvVars = ["MONGODB_URI", "JWT_ACCESS_SECRET"];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName],
);

if (missingEnvVars.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
  console.error("Please set these in your Render dashboard.");
  process.exit(1);
}

console.log("✅ Environment variables validated");

// Global error handlers
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  console.error("Stack:", error.stack);
  setTimeout(() => process.exit(1), 5000);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise);
  console.error("Reason:", reason);
});

// ==================== LOAD APP ====================
let app;
try {
  console.log("Loading app module...");
  app = require("./src/app");
  console.log("✅ App module loaded successfully");
} catch (error) {
  console.error("❌ Failed to load app:", error.message);
  console.error("Stack:", error.stack);
  process.exit(1);
}

// ==================== DATABASE & ROUTES ====================
const connectDB = require("./src/config/database");
const {
  initDefaultCategories,
} = require("./src/controllers/category.controller");
const seedDataCategories = require("./src/utils/seedB2BCategories");

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// ==================== SOCKET.IO SETUP ====================
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Make io accessible to routes
app.set("io", io);

// Socket.io authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log("⚠️ Socket connection without token");
    return next(new Error("Authentication required"));
  }

  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    socket.userId = decoded.id;
    console.log(`✅ Socket authenticated for user: ${socket.userId}`);
    next();
  } catch (err) {
    console.error("❌ Socket authentication failed:", err.message);
    next(new Error("Invalid token"));
  }
});

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.userId || socket.id}`);

  if (socket.userId) {
    socket.join(`user_${socket.userId}`);
    console.log(`📢 User ${socket.userId} joined their room`);
  }

  socket.on("vote-cast", (data) => {
    console.log(`🗳️ Vote cast: ${data.pollId}`);
    socket.broadcast.emit("vote-update", data);
  });

  socket.on("poll-update", (data) => {
    console.log(`📊 Poll update: ${data.pollId}`);
    io.emit("poll-changed", data);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 User disconnected: ${socket.userId || socket.id}`);
  });
});

// ==================== START SERVER ====================
console.log("Connecting to database...");

connectDB()
  .then(async () => {
    console.log("✅ MongoDB Atlas connected successfully");

    // Initialize categories with error handling
    try {
      await initDefaultCategories();
      console.log("✅ Default categories initialized");
    } catch (err) {
      console.error("⚠️ Category initialization failed:", err.message);
    }

    try {
      await seedDataCategories();
      console.log("✅ B2B categories seeded");
    } catch (err) {
      console.error("⚠️ B2B seeding failed:", err.message);
    }

    // ONLY ONE server.listen() call - remove any other listen() calls in this file!
    server.listen(PORT, "0.0.0.0", () => {
      const serverUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
      console.log(`
    ═══════════════════════════════════════════════════
    🚀 SERVER IS RUNNING SUCCESSFULLY!
    ═══════════════════════════════════════════════════
    📡 Port: ${PORT}
    🌍 Environment: ${process.env.NODE_ENV || "development"}
    🔗 API URL: ${serverUrl}
    💚 Health: ${serverUrl}/health
    🗄️  MongoDB: Connected
    ═══════════════════════════════════════════════════
    `);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  });

// ==================== GRACEFUL SHUTDOWN ====================
const gracefulShutdown = () => {
  console.log("🛑 Received shutdown signal, closing gracefully...");
  server.close(() => {
    console.log("✅ HTTP server closed");
    if (mongoose.connection) {
      mongoose.connection.close(false, () => {
        console.log("✅ MongoDB connection closed");
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("⚠️ Force shutdown after timeout");
    process.exit(1);
  }, 5000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);