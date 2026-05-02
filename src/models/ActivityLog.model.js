const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  email: String,
  action: {
    type: String,
    required: true,
    enum: ['REGISTER', 'LOGIN', 'LOGOUT', 'VERIFY_OTP', 'FORGOT_PASSWORD', 'RESET_PASSWORD', 'LOGIN_FAILED']
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED'],
    required: true
  },
  ipAddress: String,
  userAgent: String,
  details: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ user: 1, action: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);