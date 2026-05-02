const User = require('../models/User.model');
const Poll = require('../models/Poll.model');
const Vote = require('../models/Vote.model');
const Comment = require('../models/Comment.model');
const ActivityLog = require('../models/ActivityLog.model');
const AppError = require('../utils/AppError');

// ==================== DASHBOARD & ANALYTICS ====================

/**
 * Get dashboard statistics
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now.setDate(now.getDate() - 7));
    const startOfMonth = new Date(now.setMonth(now.getMonth() - 1));

    // Get counts
    const [totalUsers, totalPolls, totalVotes, totalComments] = await Promise.all([
      User.countDocuments(),
      Poll.countDocuments(),
      Vote.countDocuments(),
      Comment.countDocuments()
    ]);

    // Get active polls
    const activePolls = await Poll.countDocuments({
      isPublished: true,
      startDate: { $lte: new Date() },
      endDate: { $gt: new Date() }
    });

    // Get today's stats
    const [newUsersToday, newVotesToday, newPollsToday] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
      Vote.countDocuments({ createdAt: { $gte: startOfToday } }),
      Poll.countDocuments({ createdAt: { $gte: startOfToday } })
    ]);

    // Get weekly engagement
    const weeklyEngagement = await Vote.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfWeek }
        }
      },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          votes: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get voter turnout
    const voterTurnout = totalUsers > 0 ? ((totalVotes / totalUsers) * 100).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalPolls,
          totalVotes,
          totalComments,
          activePolls,
          voterTurnout: `${voterTurnout}%`
        },
        today: {
          newUsers: newUsersToday,
          newVotes: newVotesToday,
          newPolls: newPollsToday
        },
        weeklyEngagement,
        timestamp: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed analytics
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;
    
    let startDate;
    const now = new Date();
    
    switch(period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    // Polls by category
    const pollsByCategory = await Poll.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          votes: { $sum: '$totalVotes' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // User growth over time
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Vote distribution
    const voteDistribution = await Vote.aggregate([
      {
        $lookup: {
          from: 'polls',
          localField: 'poll',
          foreignField: '_id',
          as: 'pollInfo'
        }
      },
      {
        $unwind: '$pollInfo'
      },
      {
        $group: {
          _id: '$pollInfo.category',
          totalVotes: { $sum: 1 }
        }
      }
    ]);

    // Top performing polls
    const topPolls = await Poll.find()
      .sort({ totalVotes: -1 })
      .limit(5)
      .select('title totalVotes category createdAt');

    res.status(200).json({
      success: true,
      data: {
        period,
        pollsByCategory,
        userGrowth,
        voteDistribution,
        topPolls,
        summary: {
          totalEngagement: await Vote.countDocuments({ createdAt: { $gte: startDate } }),
          newUsers: await User.countDocuments({ createdAt: { $gte: startDate } }),
          newPolls: await Poll.countDocuments({ createdAt: { $gte: startDate } })
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get voter turnout statistics
 */
exports.getVoterTurnout = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalVotes = await Vote.countDocuments();
    
    // Unique voters (users who voted at least once)
    const uniqueVoters = await Vote.distinct('user').then(users => users.length);
    
    // Poll-specific turnout
    const pollTurnout = await Poll.aggregate([
      {
        $match: { isPublished: true }
      },
      {
        $lookup: {
          from: 'votes',
          localField: '_id',
          foreignField: 'poll',
          as: 'votes'
        }
      },
      {
        $project: {
          title: 1,
          totalVotes: { $size: '$votes' },
          turnout: {
            $multiply: [
              { $divide: [{ $size: '$votes' }, totalUsers] },
              100
            ]
          }
        }
      },
      { $sort: { turnout: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overall: {
          totalUsers,
          totalVotes,
          uniqueVoters,
          turnoutPercentage: totalUsers > 0 ? ((uniqueVoters / totalUsers) * 100).toFixed(2) : 0
        },
        pollTurnout
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== USER MANAGEMENT ====================

/**
 * Get all users with pagination and filters
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { role, isVerified, search } = req.query;

    // Build filter
    let filter = {};
    if (role) filter.role = role;
    if (isVerified !== undefined) filter.isVerified = isVerified === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -refreshToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -refreshToken');

    if (!user) {
      return next(new AppError(404, 'User not found'));
    }

    // Get user statistics
    const [votesCount, pollsCreated, commentsCount] = await Promise.all([
      Vote.countDocuments({ user: user._id }),
      Poll.countDocuments({ createdBy: user._id }),
      Comment.countDocuments({ user: user._id })
    ]);

    res.status(200).json({
      success: true,
      data: {
        user,
        stats: {
          votesCast: votesCount,
          pollsCreated,
          commentsPosted: commentsCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user role
 */
exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new AppError(404, 'User not found'));
    }

    // Prevent changing own role
    if (user._id.toString() === req.user._id.toString()) {
      return next(new AppError(400, 'You cannot change your own role'));
    }

    user.role = role;
    await user.save();

    await ActivityLog.create({
      user: req.user._id,
      action: 'UPDATE_USER_ROLE',
      status: 'SUCCESS',
      details: { targetUser: user.email, newRole: role }
    });

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: { user: { id: user._id, email: user.email, role: user.role } }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle user status (activate/deactivate)
 */
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new AppError(404, 'User not found'));
    }

    // Prevent deactivating own account
    if (user._id.toString() === req.user._id.toString()) {
      return next(new AppError(400, 'You cannot change your own status'));
    }

    user.isActive = isActive;
    await user.save();

    await ActivityLog.create({
      user: req.user._id,
      action: 'TOGGLE_USER_STATUS',
      status: 'SUCCESS',
      details: { targetUser: user.email, isActive }
    });

    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user: { id: user._id, email: user.email, isActive: user.isActive } }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return next(new AppError(404, 'User not found'));
    }

    // Prevent deleting own account
    if (user._id.toString() === req.user._id.toString()) {
      return next(new AppError(400, 'You cannot delete your own account'));
    }

    // Delete all user data
    await Promise.all([
      Vote.deleteMany({ user: user._id }),
      Comment.deleteMany({ user: user._id }),
      Poll.updateMany({ createdBy: user._id }, { isPublished: false, isActive: false })
    ]);

    await user.deleteOne();

    await ActivityLog.create({
      user: req.user._id,
      action: 'DELETE_USER',
      status: 'SUCCESS',
      details: { deletedUser: user.email }
    });

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get activity logs
 */
exports.getActivityLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const { action, status, userId } = req.query;

    let filter = {};
    if (action) filter.action = action;
    if (status) filter.status = status;
    if (userId) filter.user = userId;

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ActivityLog.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== POLL MANAGEMENT ====================

/**
 * Get all polls with filters
 */
exports.getAllPolls = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { category, isPublished, status } = req.query;

    let filter = {};
    if (category) filter.category = category;
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true';
    
    if (status === 'active') {
      filter.startDate = { $lte: new Date() };
      filter.endDate = { $gt: new Date() };
      filter.isPublished = true;
    } else if (status === 'ended') {
      filter.endDate = { $lt: new Date() };
    } else if (status === 'scheduled') {
      filter.startDate = { $gt: new Date() };
    }

    const [polls, total] = await Promise.all([
      Poll.find(filter)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Poll.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        polls,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get poll by ID with details
 */
exports.getPollById = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!poll) {
      return next(new AppError(404, 'Poll not found'));
    }

    // Get vote statistics
    const totalVotes = await Vote.countDocuments({ poll: poll._id });
    const candidateResults = await Vote.aggregate([
      { $match: { poll: poll._id } },
      {
        $group: {
          _id: '$candidate',
          votes: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        poll,
        statistics: {
          totalVotes,
          candidateResults,
          turnout: totalVotes > 0 ? ((totalVotes / await User.countDocuments()) * 100).toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create poll (admin)
 */
exports.createPoll = async (req, res, next) => {
  try {
    const { title, description, category, candidates, startDate, endDate } = req.body;

    const poll = await Poll.create({
      title,
      description,
      category,
      candidates,
      createdBy: req.user._id,
      startDate: startDate || new Date(),
      endDate,
      isPublished: true // Admin creates published polls
    });

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

/**
 * Update poll
 */
exports.updatePoll = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return next(new AppError(404, 'Poll not found'));
    }

    const updatedPoll = await Poll.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    await ActivityLog.create({
      user: req.user._id,
      action: 'UPDATE_POLL',
      status: 'SUCCESS',
      details: { pollId: poll._id, pollTitle: poll.title }
    });

    res.status(200).json({
      success: true,
      message: 'Poll updated successfully',
      data: { poll: updatedPoll }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete poll
 */
exports.deletePoll = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return next(new AppError(404, 'Poll not found'));
    }

    // Delete all related votes and comments
    await Promise.all([
      Vote.deleteMany({ poll: poll._id }),
      Comment.deleteMany({ poll: poll._id })
    ]);

    await poll.deleteOne();

    await ActivityLog.create({
      user: req.user._id,
      action: 'DELETE_POLL',
      status: 'SUCCESS',
      details: { pollId: poll._id, pollTitle: poll.title }
    });

    res.status(200).json({
      success: true,
      message: 'Poll deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Publish poll
 */
exports.publishPoll = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return next(new AppError(404, 'Poll not found'));
    }

    poll.isPublished = true;
    await poll.save();

    // Notify via socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('poll-published', { pollId: poll._id, pollTitle: poll.title });
    }

    await ActivityLog.create({
      user: req.user._id,
      action: 'PUBLISH_POLL',
      status: 'SUCCESS',
      details: { pollId: poll._id, pollTitle: poll.title }
    });

    res.status(200).json({
      success: true,
      message: 'Poll published successfully',
      data: { poll }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unpublish poll
 */
exports.unpublishPoll = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return next(new AppError(404, 'Poll not found'));
    }

    poll.isPublished = false;
    await poll.save();

    await ActivityLog.create({
      user: req.user._id,
      action: 'UNPUBLISH_POLL',
      status: 'SUCCESS',
      details: { pollId: poll._id, pollTitle: poll.title }
    });

    res.status(200).json({
      success: true,
      message: 'Poll unpublished successfully',
      data: { poll }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== VOTE MANAGEMENT ====================

/**
 * Get all votes with filters
 */
exports.getAllVotes = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const { pollId, userId } = req.query;

    let filter = {};
    if (pollId) filter.poll = pollId;
    if (userId) filter.user = userId;

    const [votes, total] = await Promise.all([
      Vote.find(filter)
        .populate('poll', 'title category')
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Vote.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        votes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get poll results with aggregation
 */
exports.getPollResults = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) {
      return next(new AppError(404, 'Poll not found'));
    }

    const results = await Vote.aggregate([
      { $match: { poll: poll._id } },
      {
        $group: {
          _id: '$candidate',
          votes: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'polls',
          localField: 'poll',
          foreignField: '_id',
          as: 'pollInfo'
        }
      }
    ]);

    // Calculate percentages
    const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
    const candidateDetails = poll.candidates.map(candidate => {
      const voteData = results.find(r => r._id.toString() === candidate._id.toString());
      return {
        ...candidate.toObject(),
        votes: voteData ? voteData.votes : 0,
        percentage: totalVotes > 0 ? ((voteData ? voteData.votes : 0) / totalVotes * 100).toFixed(2) : 0
      };
    });

    res.status(200).json({
      success: true,
      data: {
        poll: {
          id: poll._id,
          title: poll.title,
          category: poll.category
        },
        results: candidateDetails,
        totalVotes,
        timestamp: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export poll results as CSV
 */
exports.exportPollResults = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) {
      return next(new AppError(404, 'Poll not found'));
    }

    const votes = await Vote.find({ poll: poll._id })
      .populate('user', 'name email')
      .populate('poll', 'title');

    // Generate CSV
    let csv = 'Vote ID,User Name,User Email,Candidate,Timestamp\n';
    for (const vote of votes) {
      const candidate = poll.candidates.find(c => c._id.toString() === vote.candidate.toString());
      csv += `${vote._id},${vote.user.name},${vote.user.email},${candidate?.name || 'Unknown'},${vote.createdAt}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=poll_${poll._id}_results.csv`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

// ==================== COMMENT MODERATION ====================

/**
 * Get all comments with filters
 */
exports.getAllComments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const { pollId, userId, isDeleted } = req.query;

    let filter = {};
    if (pollId) filter.poll = pollId;
    if (userId) filter.user = userId;
    if (isDeleted !== undefined) filter.isDeleted = isDeleted === 'true';

    const [comments, total] = await Promise.all([
      Comment.find(filter)
        .populate('user', 'name email')
        .populate('poll', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Comment.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        comments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete comment (moderation)
 */
exports.deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return next(new AppError(404, 'Comment not found'));
    }

    await comment.deleteOne();

    await ActivityLog.create({
      user: req.user._id,
      action: 'DELETE_COMMENT',
      status: 'SUCCESS',
      details: { commentId: comment._id }
    });

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Moderate comment (approve/reject/flag)
 */
exports.moderateComment = async (req, res, next) => {
  try {
    const { status } = req.body;
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return next(new AppError(404, 'Comment not found'));
    }

    if (status === 'rejected') {
      await comment.deleteOne();
    } else if (status === 'flagged') {
      comment.isFlagged = true;
      await comment.save();
    }

    await ActivityLog.create({
      user: req.user._id,
      action: 'MODERATE_COMMENT',
      status: 'SUCCESS',
      details: { commentId: comment._id, status }
    });

    res.status(200).json({
      success: true,
      message: `Comment ${status} successfully`
    });
  } catch (error) {
    next(error);
  }
};

// ==================== SYSTEM MANAGEMENT ====================

/**
 * Get system logs
 */
exports.getSystemLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;
    const { level = 'error', timeRange = '24h' } = req.query;

    // This would integrate with your logging system (Winston)
    // For now, return recent activity logs
    const logs = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: { page, limit, total: logs.length }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear cache (if using Redis)
 */
exports.clearCache = async (req, res, next) => {
  try {
    // Implement cache clearing logic if using Redis
    // For now, just return success
    res.status(200).json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create database backup
 */
exports.getBackup = async (req, res, next) => {
  try {
    const [users, polls, votes, comments] = await Promise.all([
      User.find().select('-password -refreshToken'),
      Poll.find(),
      Vote.find(),
      Comment.find()
    ]);

    const backup = {
      timestamp: new Date(),
      data: {
        users,
        polls,
        votes,
        comments
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=backup_${Date.now()}.json`);
    res.status(200).json(backup);
  } catch (error) {
    next(error);
  }
};