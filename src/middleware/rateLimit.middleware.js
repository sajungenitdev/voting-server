const rateLimit = require('express-rate-limit');

// Helper to get client IP
const getIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         'unknown';
};

// Strict limiter for auth endpoints (5 attempts per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many attempts from this IP, please try again after 15 minutes',
  keyGenerator: (req) => getIP(req),
  standardHeaders: true,
  legacyHeaders: false
});

// General API limiter (100 requests per 15 minutes)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP',
  keyGenerator: (req) => getIP(req),
  standardHeaders: true,
  legacyHeaders: false
});

// Vote limiter (10 votes per minute)
const voteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many vote attempts, please slow down',
  keyGenerator: (req) => {
    if (req.user && req.user._id) {
      return req.user._id.toString();
    }
    return getIP(req);
  }
});

module.exports = {
  authLimiter,
  apiLimiter,
  voteLimiter
};