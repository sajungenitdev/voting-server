const Vote = require("../models/Vote.model");
const Poll = require("../models/Poll.model");
const User = require("../models/User.model");
const ActivityLog = require("../models/ActivityLog.model");
const AppError = require("../utils/AppError");

// Helper to get client IP
const getClientIP = (req) => {
  return (
    req.ip ||
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.connection?.remoteAddress ||
    "unknown"
  );
};

// Cast a vote
exports.castVote = async (req, res, next) => {
  try {
    const { pollId, candidateId } = req.body;
    const userId = req.user._id;

    // 1. Check if poll exists
    const poll = await Poll.findById(pollId);
    if (!poll) {
      return next(new AppError(404, "Poll not found"));
    }

    // 2. Check if poll is published
    if (!poll.isPublished) {
      return next(new AppError(400, "This poll is not published yet"));
    }

    // 3. Check if poll is active (not ended)
    const now = new Date();
    if (poll.endDate && new Date(poll.endDate) < now) {
      return next(new AppError(400, "This poll has ended. Voting is closed"));
    }

    // 4. Check if poll has started
    if (poll.startDate && new Date(poll.startDate) > now) {
      return next(new AppError(400, "This poll has not started yet"));
    }

    // 5. Check if candidate exists in this poll
    const candidate = poll.candidates.id(candidateId);
    if (!candidate) {
      return next(new AppError(400, "Invalid candidate"));
    }

    // 6. Check if user has already voted in this poll
    const existingVote = await Vote.findOne({ poll: pollId, user: userId });
    if (existingVote) {
      return next(new AppError(400, "You have already voted in this poll"));
    }

    // 7. Create vote
    const vote = await Vote.create({
      poll: pollId,
      user: userId,
      candidate: candidateId,
      ipAddress: getClientIP(req),
      userAgent: req.headers["user-agent"] || "unknown",
    });

    // 8. Update poll vote count
    candidate.voteCount += 1;
    poll.totalVotes += 1;
    await poll.save();

    // 9. Log activity
    await ActivityLog.create({
      user: userId,
      action: "CAST_VOTE",
      status: "SUCCESS",
      details: {
        pollId: pollId,
        pollTitle: poll.title,
        candidateId: candidateId,
        candidateName: candidate.name,
      },
    });

    // 10. Emit real-time update via socket.io
    const io = req.app.get("io");
    if (io) {
      io.emit("vote-update", {
        pollId: pollId,
        candidateId: candidateId,
        candidateName: candidate.name,
        newVoteCount: candidate.voteCount,
        totalVotes: poll.totalVotes,
        timestamp: new Date(),
      });
    }

    res.status(201).json({
      success: true,
      message: "Vote cast successfully",
      data: {
        voteId: vote._id,
        voteReceipt: vote.voteReceipt,
        poll: {
          id: poll._id,
          title: poll.title,
        },
        candidate: {
          id: candidate._id,
          name: candidate.name,
        },
        votedAt: vote.createdAt,
      },
    });
  } catch (error) {
    // Handle duplicate key error (user already voted)
    if (error.code === 11000) {
      return next(new AppError(400, "You have already voted in this poll"));
    }
    next(error);
  }
};

// Get user's vote history
exports.getMyVotes = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const votes = await Vote.find({ user: req.user._id })
      .populate("poll", "title category endDate isPublished")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Vote.countDocuments({ user: req.user._id });

    // Get detailed info for each vote
    const votesWithDetails = await Promise.all(
      votes.map(async (vote) => {
        const poll = vote.poll;
        let candidate = null;
        if (poll && poll.candidates) {
          candidate = poll.candidates.id(vote.candidate);
        }
        return {
          id: vote._id,
          voteReceipt: vote.voteReceipt,
          votedAt: vote.createdAt,
          poll: poll
            ? {
                id: poll._id,
                title: poll.title,
                category: poll.category,
                endDate: poll.endDate,
                isActive: poll.endDate
                  ? new Date(poll.endDate) > new Date()
                  : true,
              }
            : null,
          candidate: candidate
            ? {
                id: candidate._id,
                name: candidate.name,
              }
            : null,
        };
      }),
    );

    res.status(200).json({
      success: true,
      count: votesWithDetails.length,
      total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      data: { votes: votesWithDetails },
    });
  } catch (error) {
    next(error);
  }
};

// Get vote by ID with receipt
exports.getVoteReceipt = async (req, res, next) => {
  try {
    const vote = await Vote.findById(req.params.id)
      .populate("poll", "title description category endDate")
      .populate("user", "name email");

    if (!vote) {
      return next(new AppError(404, "Vote not found"));
    }

    // Check if user owns this vote or is admin
    if (
      vote.user._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return next(
        new AppError(403, "You can only view your own vote receipts"),
      );
    }

    const poll = vote.poll;
    let candidate = null;
    if (poll && poll.candidates) {
      candidate = poll.candidates.id(vote.candidate);
    }

    res.status(200).json({
      success: true,
      data: {
        receipt: {
          voteId: vote._id,
          voteReceipt: vote.voteReceipt,
          votedAt: vote.createdAt,
          poll: {
            id: poll._id,
            title: poll.title,
            description: poll.description,
            category: poll.category,
          },
          candidate: {
            id: candidate?._id,
            name: candidate?.name,
            description: candidate?.description,
          },
          voter: {
            name: vote.user.name,
            email: vote.user.email,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Check if user has voted in a poll
exports.hasVoted = async (req, res, next) => {
  try {
    const { pollId } = req.params;

    const vote = await Vote.findOne({
      poll: pollId,
      user: req.user._id,
    });

    res.status(200).json({
      success: true,
      data: {
        hasVoted: !!vote,
        voteId: vote?._id || null,
        votedAt: vote?.createdAt || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get vote results for a poll (public)
exports.getPollVoteResults = async (req, res, next) => {
  try {
    const { pollId } = req.params;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return next(new AppError(404, "Poll not found"));
    }

    // Check if results should be shown
    if (
      !poll.settings?.showResults &&
      !poll.hasEnded &&
      req.user?.role !== "admin"
    ) {
      return next(new AppError(403, "Results are not available yet"));
    }

    // Get vote counts per candidate
    const results = await Vote.aggregate([
      { $match: { poll: poll._id } },
      {
        $group: {
          _id: "$candidate",
          votes: { $sum: 1 },
        },
      },
    ]);

    // Calculate percentages
    const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
    const candidateResults = poll.candidates.map((candidate) => {
      const voteData = results.find(
        (r) => r._id.toString() === candidate._id.toString(),
      );
      return {
        id: candidate._id,
        name: candidate.name,
        description: candidate.description,
        image: candidate.image,
        voteCount: voteData ? voteData.votes : 0,
        percentage:
          totalVotes > 0
            ? (((voteData ? voteData.votes : 0) / totalVotes) * 100).toFixed(2)
            : 0,
      };
    });

    // Sort by vote count (highest first)
    candidateResults.sort((a, b) => b.voteCount - a.voteCount);

    res.status(200).json({
      success: true,
      data: {
        poll: {
          id: poll._id,
          title: poll.title,
          category: poll.category,
          totalVotes,
          hasEnded: poll.hasEnded,
          isActive: poll.isActive,
        },
        results: candidateResults,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Get all votes for a poll
exports.getPollVotes = async (req, res, next) => {
  try {
    const { pollId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return next(new AppError(404, "Poll not found"));
    }

    const votes = await Vote.find({ poll: pollId })
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Vote.countDocuments({ poll: pollId });

    // Format votes with candidate names
    const formattedVotes = votes.map((vote) => {
      const candidate = poll.candidates.id(vote.candidate);
      return {
        id: vote._id,
        voter: {
          id: vote.user._id,
          name: vote.user.name,
          email: vote.user.email,
        },
        candidate: candidate
          ? {
              id: candidate._id,
              name: candidate.name,
            }
          : null,
        voteReceipt: vote.voteReceipt,
        votedAt: vote.createdAt,
        ipAddress: vote.ipAddress,
      };
    });

    res.status(200).json({
      success: true,
      count: formattedVotes.length,
      total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      data: { votes: formattedVotes },
    });
  } catch (error) {
    next(error);
  }
};

// Get voting statistics for dashboard
exports.getVoteStatistics = async (req, res, next) => {
  try {
    const totalVotes = await Vote.countDocuments();
    const uniqueVoters = await Vote.distinct("user").then(
      (users) => users.length,
    );
    const totalUsers = await User.countDocuments();

    // Votes per day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const votesPerDay = await Vote.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Most voted polls
    const topPolls = await Poll.find()
      .sort({ totalVotes: -1 })
      .limit(5)
      .select("title totalVotes category");

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalVotes,
          uniqueVoters,
          totalUsers,
          voterTurnout:
            totalUsers > 0 ? ((uniqueVoters / totalUsers) * 100).toFixed(2) : 0,
        },
        votesPerDay,
        topPolls,
      },
    });
  } catch (error) {
    next(error);
  }
};
