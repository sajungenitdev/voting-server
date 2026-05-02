const Poll = require("../models/Poll.model");
const Vote = require("../models/Vote.model");
const ActivityLog = require("../models/ActivityLog.model");
const AppError = require("../utils/AppError");

exports.getAvailableCategories = async (req, res, next) => {
  try {
    const Category = require("../models/Category.model");
    let categories = await Category.find({ isActive: true }).sort({ order: 1 });

    if (categories.length === 0) {
      // Return default categories if none in database
      categories = [
        { name: "politics", displayName: "Politics", icon: "🏛️" },
        { name: "entertainment", displayName: "Entertainment", icon: "🎬" },
        { name: "sports", displayName: "Sports", icon: "⚽" },
        { name: "technology", displayName: "Technology", icon: "💻" },
        { name: "business", displayName: "Business", icon: "💼" },
        { name: "education", displayName: "Education", icon: "📚" },
        { name: "health", displayName: "Health", icon: "🏥" },
        { name: "other", displayName: "Other", icon: "📋" },
      ];
    }

    res.status(200).json({
      success: true,
      data: { categories },
    }); 
  } catch (error) {
    next(error);
  }
};

exports.getAllPolls = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    let filter = { isPublished: true };

    // Category filter
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Status filter
    const now = new Date();
    if (req.query.status === "active") {
      filter.startDate = { $lte: now };
      filter.endDate = { $gte: now };
    } else if (req.query.status === "ended") {
      filter.endDate = { $lt: now };
    } else if (req.query.status === "upcoming") {
      filter.startDate = { $gt: now };
    }

    // Search by title/description
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
      ];
    }

    // Get polls
    const polls = await Poll.find(filter)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Poll.countDocuments(filter);

    // Check if user has voted on each poll (if authenticated)
    let userVotes = {};
    if (req.user) {
      const votes = await Vote.find({
        user: req.user._id,
        poll: { $in: polls.map((p) => p._id) },
      });
      userVotes = votes.reduce((acc, vote) => {
        acc[vote.poll.toString()] = vote.candidate.toString();
        return acc;
      }, {});
    }

    // Format response
    const pollsWithStatus = polls.map((poll) => ({
      ...poll.toObject(),
      userVoted: !!userVotes[poll._id.toString()],
      userVoteCandidateId: userVotes[poll._id.toString()] || null,
      isOngoing: poll.isOngoing,
      hasEnded: poll.hasEnded,
      isUpcoming: poll.isUpcoming,
    }));

    res.status(200).json({
      success: true,
      count: pollsWithStatus.length,
      total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      data: { polls: pollsWithStatus },
    });
  } catch (error) {
    next(error);
  }
};

// Get single poll by ID
exports.getPollById = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id).populate(
      "createdBy",
      "name email",
    );

    if (!poll) {
      return next(new AppError(404, "Poll not found"));
    }

    // Check if poll is published (unless admin or owner)
    if (
      !poll.isPublished &&
      req.user?.role !== "admin" &&
      poll.createdBy._id.toString() !== req.user?._id.toString()
    ) {
      return next(new AppError(403, "This poll is not published yet"));
    }

    // Check if user has voted
    let userVoted = false;
    let userVoteCandidateId = null;

    if (req.user) {
      const vote = await Vote.findOne({
        poll: poll._id,
        user: req.user._id,
      });
      userVoted = !!vote;
      userVoteCandidateId = vote ? vote.candidate.toString() : null;
    }

    // Get results with percentages
    const results = await poll.getResults();

    res.status(200).json({
      success: true,
      data: {
        poll: {
          ...poll.toObject(),
          userVoted,
          userVoteCandidateId,
          isOngoing: poll.isOngoing,
          hasEnded: poll.hasEnded,
          isUpcoming: poll.isUpcoming,
          results: poll.settings.showResults || poll.hasEnded ? results : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.createPoll = async (req, res, next) => {
  try {
    const { 
      title, description, category, candidates, 
      endDate, startDate, settings, tags, image 
    } = req.body;
    
    // Validate candidates (at least 2)
    if (!candidates || candidates.length < 2) {
      return next(new AppError(400, 'At least 2 candidates are required'));
    }
    
    // Parse and validate end date
    let end;
    try {
      end = new Date(endDate);
      
      // Check if date is valid
      if (isNaN(end.getTime())) {
        return next(new AppError(400, 'Invalid end date format. Use ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)'));
      }
      
      // Get current time (remove milliseconds for comparison)
      const now = new Date();
      now.setMilliseconds(0);
      
      // Check if end date is in the future
      if (end <= now) {
        // Provide helpful message with example
        const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        return next(new AppError(400, `End date must be in the future. Example: "${futureDate.toISOString()}"`));
      }
    } catch (error) {
      return next(new AppError(400, 'Invalid end date format'));
    }
    
    // Parse start date (optional)
    let start = new Date();
    if (startDate) {
      start = new Date(startDate);
      if (isNaN(start.getTime())) {
        start = new Date();
      }
    }
    
    // Create poll
    const poll = await Poll.create({
      title,
      description,
      category,
      candidates,
      createdBy: req.user._id,
      endDate: end,
      startDate: start,
      settings: settings || {},
      tags: tags || [],
      image: image || null,
      isPublished: req.user.role === 'admin'
    });
    
    // Log activity
    await ActivityLog.create({
      user: req.user._id,
      action: 'CREATE_POLL',
      status: 'SUCCESS',
      details: { pollId: poll._id, pollTitle: poll.title }
    });
    
    res.status(201).json({
      success: true,
      message: 'Poll created successfully',
      data: { poll }
    });
  } catch (error) {
    next(error);
  }
};

// Update poll
exports.updatePoll = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return next(new AppError(404, "Poll not found"));
    }

    // Check permissions
    if (
      poll.createdBy.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return next(new AppError(403, "You can only update your own polls"));
    }

    // Don't allow update if voting has started and user is not admin
    if (poll.totalVotes > 0 && req.user.role !== "admin") {
      return next(
        new AppError(400, "Cannot update poll after voting has started"),
      );
    }

    const updatedPoll = await Poll.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await ActivityLog.create({
      user: req.user._id,
      action: "UPDATE_POLL",
      status: "SUCCESS",
      details: { pollId: poll._id, pollTitle: poll.title },
    });

    res.status(200).json({
      success: true,
      message: "Poll updated successfully",
      data: { poll: updatedPoll },
    });
  } catch (error) {
    next(error);
  }
};

// Delete poll
exports.deletePoll = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return next(new AppError(404, "Poll not found"));
    }

    // Check permissions
    if (
      poll.createdBy.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return next(new AppError(403, "You can only delete your own polls"));
    }

    // Delete all related votes and comments
    await Promise.all([
      Vote.deleteMany({ poll: poll._id }),
      require("../models/Comment.model").deleteMany({ poll: poll._id }),
    ]);

    await poll.deleteOne();

    await ActivityLog.create({
      user: req.user._id,
      action: "DELETE_POLL",
      status: "SUCCESS",
      details: { pollId: poll._id, pollTitle: poll.title },
    });

    res.status(200).json({
      success: true,
      message: "Poll deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Publish poll
exports.publishPoll = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return next(new AppError(404, "Poll not found"));
    }

    // Check permissions (only admin or owner can publish)
    if (
      poll.createdBy.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return next(new AppError(403, "You can only publish your own polls"));
    }

    poll.isPublished = true;
    await poll.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("poll-published", { pollId: poll._id, pollTitle: poll.title });
    }

    await ActivityLog.create({
      user: req.user._id,
      action: "PUBLISH_POLL",
      status: "SUCCESS",
      details: { pollId: poll._id, pollTitle: poll.title },
    });

    res.status(200).json({
      success: true,
      message: "Poll published successfully",
      data: { poll },
    });
  } catch (error) {
    next(error);
  }
};

// Unpublish poll
exports.unpublishPoll = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return next(new AppError(404, "Poll not found"));
    }

    // Check permissions (only admin can unpublish)
    if (req.user.role !== "admin") {
      return next(new AppError(403, "Only admins can unpublish polls"));
    }

    poll.isPublished = false;
    await poll.save();

    await ActivityLog.create({
      user: req.user._id,
      action: "UNPUBLISH_POLL",
      status: "SUCCESS",
      details: { pollId: poll._id, pollTitle: poll.title },
    });

    res.status(200).json({
      success: true,
      message: "Poll unpublished successfully",
      data: { poll },
    });
  } catch (error) {
    next(error);
  }
};

// Get poll results
exports.getPollResults = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return next(new AppError(404, "Poll not found"));
    }

    // Check if results can be shown
    if (
      !poll.settings.showResults &&
      !poll.hasEnded &&
      req.user?.role !== "admin"
    ) {
      return next(new AppError(403, "Results are not available yet"));
    }

    const results = await poll.getResults();

    // Get recent votes
    const recentVotes = await Vote.find({ poll: poll._id })
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        poll: {
          id: poll._id,
          title: poll.title,
          category: poll.category,
          totalVotes: poll.totalVotes,
          hasEnded: poll.hasEnded,
        },
        results,
        recentVotes: recentVotes.map((vote) => ({
          userName: vote.user?.name || "Anonymous",
          candidateName: poll.candidates.id(vote.candidate)?.name,
          votedAt: vote.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get polls by category
exports.getPollsByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { category, isPublished: true };

    const polls = await Poll.find(filter)
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Poll.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: polls.length,
      total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      data: { polls },
    });
  } catch (error) {
    next(error);
  }
};

// Get user's polls
exports.getMyPolls = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { createdBy: req.user._id };

    const polls = await Poll.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Poll.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: polls.length,
      total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      data: { polls },
    });
  } catch (error) {
    next(error);
  }
};
