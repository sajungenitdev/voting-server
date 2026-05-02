const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  image: String,
  voteCount: {
    type: Number,
    default: 0
  }
});

const pollSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Poll title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    required: true,
    enum: ['politics', 'entertainment', 'sports', 'technology', 'business', 'other'],
    default: 'other'
  },
  candidates: [candidateSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  totalVotes: {
    type: Number,
    default: 0
  },
  settings: {
    allowComments: { type: Boolean, default: true },
    showResults: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

// Indexes for better performance
pollSchema.index({ category: 1, isPublished: 1, endDate: 1 });
pollSchema.index({ createdBy: 1, createdAt: -1 });

// Virtual: Check if poll is active
pollSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.isPublished && now >= this.startDate && now <= this.endDate;
});

module.exports = mongoose.model('Poll', pollSchema);