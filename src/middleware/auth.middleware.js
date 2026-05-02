const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const AppError = require('../utils/AppError');

const protect = async (req, res, next) => {
  try {
    let token;
    
    // Get token from cookie or Authorization header
    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return next(new AppError(401, 'You are not logged in. Please login to access this resource'));
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    // Check if user still exists
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return next(new AppError(401, 'The user belonging to this token no longer exists'));
    }
    
    // Grant access
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError(401, 'Invalid token. Please login again'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError(401, 'Your token has expired. Please login again'));
    }
    next(error);
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, `You do not have permission to perform this action. Required role: ${roles.join(' or ')}`));
    }
    next();
  };
};

module.exports = {
  protect,
  restrictTo
};