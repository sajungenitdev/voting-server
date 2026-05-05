const rateLimit = require("express-rate-limit");

const getIP = (req) => {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    "unknown"
  );
};

// Increase limit for development
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Increased from 5 to 100 for development
  message:
    "Too many authentication attempts, please try again after 15 minutes",
  keyGenerator: (req) => getIP(req),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === "development", // Skip rate limiting in development
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // Increased from 100 to 500
  message: "Too many requests from this IP",
  keyGenerator: (req) => getIP(req),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === "development",
});

const voteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50, // Increased from 10 to 50
  message: "Too many vote attempts, please slow down",
  keyGenerator: (req) => {
    if (req.user && req.user._id) {
      return req.user._id.toString();
    }
    return getIP(req);
  },
  skip: (req) => process.env.NODE_ENV === "development",
});

module.exports = {
  authLimiter,
  apiLimiter,
  voteLimiter,
};
