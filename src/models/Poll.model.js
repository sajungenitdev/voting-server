const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Candidate name is required'],
    trim: true,
    maxlength: [100, 'Candidate name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  image: {
    type: String,
    default: null
  },
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
    required: [true, 'Poll description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    required: true,
    enum: ['politics', 'entertainment', 'sports', 'technology', 'business', 'education', 'health', 'other'],
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
    default: Date.now
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  totalVotes: {
    type: Number,
    default: 0
  },
  settings: {
    allowComments: { type: Boolean, default: true },
    showResults: { type: Boolean, default: true },
    allowMultipleVotes: { type: Boolean, default: false }
  },
  image: {
    type: String,
    default: null
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Indexes for better performance
pollSchema.index({ category: 1, isPublished: 1, endDate: 1 });
pollSchema.index({ createdBy: 1, createdAt: -1 });
pollSchema.index({ tags: 1 });
pollSchema.index({ title: 'text', description: 'text' });

// Virtual: Check if poll is ongoing
pollSchema.virtual('isOngoing').get(function() {
  const now = new Date();
  return this.isPublished && now >= this.startDate && now <= this.endDate;
});

// Virtual: Check if poll has ended
pollSchema.virtual('hasEnded').get(function() {
  return new Date() > this.endDate;
});

// Virtual: Check if poll is upcoming
pollSchema.virtual('isUpcoming').get(function() {
  return new Date() < this.startDate;
});

// Method: Get vote percentages
pollSchema.methods.getResults = async function() {
  const totalVotes = this.totalVotes;
  if (totalVotes === 0) {
    return this.candidates.map(c => ({ 
      ...c.toObject(), 
      percentage: 0,
      votes: 0
    }));
  }
  
  return this.candidates.map(candidate => ({
    ...candidate.toObject(),
    percentage: ((candidate.voteCount / totalVotes) * 100).toFixed(2),
    votes: candidate.voteCount
  }));
};

// Method: Increment vote count
pollSchema.methods.incrementVote = async function(candidateId) {
  const candidate = this.candidates.id(candidateId);
  if (candidate) {
    candidate.voteCount += 1;
    this.totalVotes += 1;
    await this.save();
    return true;
  }
  return false;
};

module.exports = mongoose.model('Poll', pollSchema);