import crypto from 'crypto';

// Generate unique receipt token
export const generateReceiptToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Format response data
export const formatResponse = (data, message = 'Success') => {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
};

// Calculate vote percentages
export const calculatePercentages = (votes, total) => {
  if (total === 0) return votes.map(v => ({ ...v, percentage: 0 }));
  return votes.map(vote => ({
    ...vote,
    percentage: ((vote.count / total) * 100).toFixed(2)
  }));
};

// Validate email format
export const isValidEmail = (email) => {
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
};

// Sanitize user input
export const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '');
  }
  return input;
};

// Get client IP from request
export const getClientIP = (req) => {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         req.connection.remoteAddress;
};

// Check if poll is active
export const isPollActive = (startDate, endDate) => {
  const now = new Date();
  return now >= new Date(startDate) && now <= new Date(endDate);
};

// Generate random OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};