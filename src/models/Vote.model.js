const mongoose = require('mongoose');
const crypto = require('crypto');

const voteSchema = new mongoose.Schema({
  poll: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Poll',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  voteReceipt: {
    type: String,
    unique: true
  },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

// Prevent duplicate votes
voteSchema.index({ poll: 1, user: 1 }, { unique: true });

// Generate unique vote receipt
voteSchema.pre('save', function(next) {
  if (!this.voteReceipt) {
    this.voteReceipt = crypto.randomBytes(32).toString('hex');
  }
  next();
});

module.exports = mongoose.model('Vote', voteSchema);