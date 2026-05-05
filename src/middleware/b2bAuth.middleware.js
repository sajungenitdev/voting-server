const jwt = require("jsonwebtoken");
const B2BUser = require("../models/B2BUser.model");
const B2BApiKey = require("../models/B2BApiKey.model");
const AppError = require("../utils/AppError");

// JWT Authentication for B2B users
const protectB2B = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(new AppError(401, "Please login to access this resource"));
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await B2BUser.findById(decoded.id);

    if (!user) {
      return next(new AppError(401, "User no longer exists"));
    }

    req.user = user;
    next();
  } catch (error) {
    next(new AppError(401, "Invalid token"));
  }
};

// API Key Authentication for B2B API access
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      return next(new AppError(401, "API key required"));
    }

    const keyDoc = await B2BApiKey.findOne({
      key: apiKey,
      isActive: true,
    }).populate("user");

    if (!keyDoc) {
      return next(new AppError(401, "Invalid API key"));
    }

    if (keyDoc.expiresAt && keyDoc.expiresAt < new Date()) {
      return next(new AppError(401, "API key expired"));
    }

    // Update last used
    keyDoc.lastUsed = new Date();
    await keyDoc.save();

    req.apiKey = keyDoc;
    req.user = keyDoc.user;
    next();
  } catch (error) {
    next(error);
  }
};

// Check subscription access
const requireSubscription = async (req, res, next) => {
  try {
    const user = await B2BUser.findById(req.user._id).populate("subscription");

    if (!user.subscription || !user.subscription.isValid()) {
      return next(new AppError(403, "Active subscription required"));
    }

    req.subscription = user.subscription;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  protectB2B,
  authenticateApiKey,
  requireSubscription,
};
