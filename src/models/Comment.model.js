const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
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
  content: {
    type: String,
    required: true,
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  dislikes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  isFlagged: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better performance
commentSchema.index({ poll: 1, createdAt: -1 });
commentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);