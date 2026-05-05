const User = require("../models/User.model");
const Poll = require("../models/Poll.model");
const Vote = require("../models/Vote.model");
const Comment = require("../models/Comment.model");
const ActivityLog = require("../models/ActivityLog.model");
const AppError = require("../utils/AppError");

// ==================== DASHBOARD & ANALYTICS ====================

exports.getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now.setDate(now.getDate() - 7));

    const [totalUsers, totalPolls, totalVotes, totalComments] =
      await Promise.all([
        User.countDocuments(),
        Poll.countDocuments(),
        Vote.countDocuments(),
        Comment.countDocuments(),
      ]);

    const activePolls = await Poll.countDocuments({
      isPublished: true,
      startDate: { $lte: new Date() },
      endDate: { $gt: new Date() },
    });

    const [newUsersToday, newVotesToday, newPollsToday] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
      Vote.countDocuments({ createdAt: { $gte: startOfToday } }),
      Poll.countDocuments({ createdAt: { $gte: startOfToday } }),
    ]);

    const weeklyEngagement = await Vote.aggregate([
      { $match: { createdAt: { $gte: startOfWeek } } },
      { $group: { _id: { $dayOfWeek: "$createdAt" }, votes: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const voterTurnout =
      totalUsers > 0 ? ((totalVotes / totalUsers) * 100).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalPolls,
          totalVotes,
          totalComments,
          activePolls,
          voterTurnout: `${voterTurnout}%`,
        },
        today: {
          newUsers: newUsersToday,
          newVotes: newVotesToday,
          newPolls: newPollsToday,
        },
        weeklyEngagement,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const { period = "month" } = req.query;
    let startDate;
    const now = new Date();

    switch (period) {
      case "week":
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case "year":
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    const pollsByCategory = await Poll.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          votes: { $sum: "$totalVotes" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
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

    const voteDistribution = await Vote.aggregate([
      {
        $lookup: {
          from: "polls",
          localField: "poll",
          foreignField: "_id",
          as: "pollInfo",
        },
      },
      { $unwind: "$pollInfo" },
      { $group: { _id: "$pollInfo.category", totalVotes: { $sum: 1 } } },
    ]);

    const topPolls = await Poll.find()
      .sort({ totalVotes: -1 })
      .limit(5)
      .select("title totalVotes category createdAt");

    res.status(200).json({
      success: true,
      data: {
        period,
        pollsByCategory,
        userGrowth,
        voteDistribution,
        topPolls,
        summary: {
          totalEngagement: await Vote.countDocuments({
            createdAt: { $gte: startDate },
          }),
          newUsers: await User.countDocuments({
            createdAt: { $gte: startDate },
          }),
          newPolls: await Poll.countDocuments({
            createdAt: { $gte: startDate },
          }),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getVoterTurnout = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalVotes = await Vote.countDocuments();
    const uniqueVoters = await Vote.distinct("user").then(
      (users) => users.length,
    );

    const pollTurnout = await Poll.aggregate([
      { $match: { isPublished: true } },
      {
        $lookup: {
          from: "votes",
          localField: "_id",
          foreignField: "poll",
          as: "votes",
        },
      },
      {
        $project: {
          title: 1,
          totalVotes: { $size: "$votes" },
          turnout: {
            $multiply: [{ $divide: [{ $size: "$votes" }, totalUsers] }, 100],
          },
        },
      },
      { $sort: { turnout: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overall: {
          totalUsers,
          totalVotes,
          uniqueVoters,
          turnoutPercentage:
            totalUsers > 0 ? ((uniqueVoters / totalUsers) * 100).toFixed(2) : 0,
        },
        pollTurnout,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== USER MANAGEMENT ====================

exports.getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { role, isVerified, search } = req.query;

    let filter = {};
    if (role) filter.role = role;
    if (isVerified !== undefined) filter.isVerified = isVerified === "true";
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password -refreshToken")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -refreshToken",
    );
    if (!user) return next(new AppError(404, "User not found"));

    const [votesCount, pollsCreated, commentsCount] = await Promise.all([
      Vote.countDocuments({ user: user._id }),
      Poll.countDocuments({ createdBy: user._id }),
      Comment.countDocuments({ user: user._id }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        user,
        stats: {
          votesCast: votesCount,
          pollsCreated,
          commentsPosted: commentsCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError(404, "User not found"));
    if (user._id.toString() === req.user._id.toString())
      return next(new AppError(400, "You cannot change your own role"));

    user.role = role;
    await user.save();

    await ActivityLog.create({
      user: req.user._id,
      action: "UPDATE_USER_ROLE",
      status: "SUCCESS",
      details: { targetUser: user.email, newRole: role },
    });

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: { user: { id: user._id, email: user.email, role: user.role } },
    });
  } catch (error) {
    next(error);
  }
};

exports.toggleUserStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError(404, "User not found"));
    if (user._id.toString() === req.user._id.toString() && isActive === false) {
      return next(new AppError(400, "You cannot deactivate your own account"));
    }

    user.isActive = isActive;
    await user.save();

    await ActivityLog.create({
      user: req.user._id,
      action: "TOGGLE_USER_STATUS",
      status: "SUCCESS",
      details: { targetUser: user.email, isActive },
    });

    res.status(200).json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: {
        user: { _id: user._id, email: user.email, isActive: user.isActive },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError(404, "User not found"));
    if (user._id.toString() === req.user._id.toString())
      return next(new AppError(400, "You cannot delete your own account"));

    await Promise.all([
      Vote.deleteMany({ user: user._id }),
      Comment.deleteMany({ user: user._id }),
      Poll.updateMany(
        { createdBy: user._id },
        { isPublished: false, isActive: false },
      ),
    ]);

    await user.deleteOne();

    await ActivityLog.create({
      user: req.user._id,
      action: "DELETE_USER",
      status: "SUCCESS",
      details: { deletedUser: user.email },
    });

    res
      .status(200)
      .json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    next(error);
  }
};

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
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ActivityLog.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== CREATE USER ====================

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, isVerified, isActive } = req.body;
    const bcrypt = require("bcryptjs");

    if (!name || !email) {
      return res
        .status(400)
        .json({ success: false, message: "Name and email are required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const userPassword = password || "Default123!";
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(userPassword, salt);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || "user",
      isVerified: isVerified !== undefined ? isVerified : true,
      isActive: isActive !== undefined ? isActive : true,
    });

    await ActivityLog.create({
      user: req.user._id,
      action: "CREATE_USER",
      status: "SUCCESS",
      details: {
        createdUser: user.email,
        role: user.role,
        createdBy: req.user.email,
      },
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create user",
    });
  }
};

// ==================== POLL MANAGEMENT ====================

exports.getAllPolls = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { category, isPublished, status } = req.query;

    let filter = {};
    if (category) filter.category = category;
    if (isPublished !== undefined) filter.isPublished = isPublished === "true";

    if (status === "active") {
      filter.startDate = { $lte: new Date() };
      filter.endDate = { $gt: new Date() };
      filter.isPublished = true;
    } else if (status === "ended") {
      filter.endDate = { $lt: new Date() };
    } else if (status === "scheduled") {
      filter.startDate = { $gt: new Date() };
    }

    const [polls, total] = await Promise.all([
      Poll.find(filter)
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Poll.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        polls,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getPollById = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id).populate(
      "createdBy",
      "name email",
    );
    if (!poll) return next(new AppError(404, "Poll not found"));

    const totalVotes = await Vote.countDocuments({ poll: poll._id });
    const candidateResults = await Vote.aggregate([
      { $match: { poll: poll._id } },
      { $group: { _id: "$candidate", votes: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        poll,
        statistics: {
          totalVotes,
          candidateResults,
          turnout:
            totalVotes > 0
              ? ((totalVotes / (await User.countDocuments())) * 100).toFixed(2)
              : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.createPoll = async (req, res, next) => {
  try {
    const { title, description, category, candidates, startDate, endDate } =
      req.body;

    const poll = await Poll.create({
      title,
      description,
      category,
      candidates,
      createdBy: req.user._id,
      startDate: startDate || new Date(),
      endDate,
      isPublished: true,
    });

    await ActivityLog.create({
      user: req.user._id,
      action: "CREATE_POLL",
      status: "SUCCESS",
      details: { pollId: poll._id, pollTitle: poll.title },
    });

    res.status(201).json({
      success: true,
      message: "Poll created successfully",
      data: { poll },
    });
  } catch (error) {
    next(error);
  }
};

exports.updatePoll = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return next(new AppError(404, "Poll not found"));

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

exports.deletePoll = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return next(new AppError(404, "Poll not found"));

    await Promise.all([
      Vote.deleteMany({ poll: poll._id }),
      Comment.deleteMany({ poll: poll._id }),
    ]);
    await poll.deleteOne();

    await ActivityLog.create({
      user: req.user._id,
      action: "DELETE_POLL",
      status: "SUCCESS",
      details: { pollId: poll._id, pollTitle: poll.title },
    });

    res
      .status(200)
      .json({ success: true, message: "Poll deleted successfully" });
  } catch (error) {
    next(error);
  }
};

exports.publishPoll = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return next(new AppError(404, "Poll not found"));

    poll.isPublished = true;
    await poll.save();

    const io = req.app.get("io");
    if (io)
      io.emit("poll-published", { pollId: poll._id, pollTitle: poll.title });

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

exports.unpublishPoll = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return next(new AppError(404, "Poll not found"));

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

// ==================== VOTE MANAGEMENT ====================

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
        .populate("poll", "title category")
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Vote.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        votes,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getPollResults = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return next(new AppError(404, "Poll not found"));

    const results = await Vote.aggregate([
      { $match: { poll: poll._id } },
      { $group: { _id: "$candidate", votes: { $sum: 1 } } },
    ]);

    const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
    const candidateDetails = poll.candidates.map((candidate) => {
      const voteData = results.find(
        (r) => r._id.toString() === candidate._id.toString(),
      );
      return {
        ...candidate.toObject(),
        votes: voteData ? voteData.votes : 0,
        percentage:
          totalVotes > 0
            ? (((voteData ? voteData.votes : 0) / totalVotes) * 100).toFixed(2)
            : 0,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        poll: { id: poll._id, title: poll.title, category: poll.category },
        results: candidateDetails,
        totalVotes,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.exportPollResults = async (req, res, next) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return next(new AppError(404, "Poll not found"));

    const votes = await Vote.find({ poll: poll._id }).populate(
      "user",
      "name email",
    );

    let csv = "Vote ID,User Name,User Email,Candidate,Timestamp\n";
    for (const vote of votes) {
      const candidate = poll.candidates.find(
        (c) => c._id.toString() === vote.candidate.toString(),
      );
      csv += `${vote._id},${vote.user.name},${vote.user.email},${candidate?.name || "Unknown"},${vote.createdAt}\n`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=poll_${poll._id}_results.csv`,
    );
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

// ==================== COMMENT MODERATION ====================

exports.getAllComments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const { pollId, userId, isDeleted } = req.query;

    let filter = {};
    if (pollId) filter.poll = pollId;
    if (userId) filter.user = userId;
    if (isDeleted !== undefined) filter.isDeleted = isDeleted === "true";

    const [comments, total] = await Promise.all([
      Comment.find(filter)
        .populate("user", "name email")
        .populate("poll", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Comment.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        comments,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return next(new AppError(404, "Comment not found"));

    await comment.deleteOne();

    await ActivityLog.create({
      user: req.user._id,
      action: "DELETE_COMMENT",
      status: "SUCCESS",
      details: { commentId: comment._id },
    });

    res
      .status(200)
      .json({ success: true, message: "Comment deleted successfully" });
  } catch (error) {
    next(error);
  }
};

exports.moderateComment = async (req, res, next) => {
  try {
    const { status } = req.body;
    const comment = await Comment.findById(req.params.id);
    if (!comment) return next(new AppError(404, "Comment not found"));

    if (status === "rejected") {
      await comment.deleteOne();
    } else if (status === "flagged") {
      comment.isFlagged = true;
      await comment.save();
    }

    await ActivityLog.create({
      user: req.user._id,
      action: "MODERATE_COMMENT",
      status: "SUCCESS",
      details: { commentId: comment._id, status },
    });

    res
      .status(200)
      .json({ success: true, message: `Comment ${status} successfully` });
  } catch (error) {
    next(error);
  }
};

// ==================== CATEGORY MANAGEMENT ====================

exports.getAllCategories = async (req, res, next) => {
  try {
    const Category = require("../models/Category.model");
    const categories = await Category.find({ isActive: true }).sort({
      order: 1,
    });
    res
      .status(200)
      .json({ success: true, count: categories.length, data: { categories } });
  } catch (error) {
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, displayName, description, icon, color, order } = req.body;
    const Category = require("../models/Category.model");

    const existingCategory = await Category.findOne({
      name: name.toLowerCase(),
    });
    if (existingCategory)
      return next(new AppError(400, "Category already exists"));

    const category = await Category.create({
      name: name.toLowerCase(),
      displayName,
      description: description || "",
      icon: icon || "📋",
      color: color || "#6B7280",
      order: order || 0,
      isActive: true,
    });

    await ActivityLog.create({
      user: req.user._id,
      action: "CREATE_CATEGORY",
      status: "SUCCESS",
      details: { categoryId: category._id, categoryName: category.name },
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { displayName, description, icon, color, order, isActive } = req.body;
    const Category = require("../models/Category.model");

    const category = await Category.findByIdAndUpdate(
      id,
      { displayName, description, icon, color, order, isActive },
      { new: true, runValidators: true },
    );
    if (!category) return next(new AppError(404, "Category not found"));

    await ActivityLog.create({
      user: req.user._id,
      action: "UPDATE_CATEGORY",
      status: "SUCCESS",
      details: { categoryId: category._id, categoryName: category.name },
    });

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const Category = require("../models/Category.model");
    const Poll = require("../models/Poll.model");

    const category = await Category.findById(id);
    if (!category) return next(new AppError(404, "Category not found"));

    const pollsUsingCategory = await Poll.countDocuments({
      category: category.name,
    });
    if (pollsUsingCategory > 0) {
      return next(
        new AppError(
          400,
          `Cannot delete category. ${pollsUsingCategory} polls are using this category.`,
        ),
      );
    }

    await category.deleteOne();

    await ActivityLog.create({
      user: req.user._id,
      action: "DELETE_CATEGORY",
      status: "SUCCESS",
      details: { categoryName: category.name },
    });

    res
      .status(200)
      .json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    next(error);
  }
};

exports.getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const Category = require("../models/Category.model");

    const category = await Category.findById(id);
    if (!category) return next(new AppError(404, "Category not found"));

    res.status(200).json({ success: true, data: { category } });
  } catch (error) {
    next(error);
  }
};

// ==================== SYSTEM MANAGEMENT ====================

exports.getSystemLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const logs = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    res.status(200).json({
      success: true,
      data: { logs, pagination: { page, limit, total: logs.length } },
    });
  } catch (error) {
    next(error);
  }
};

exports.clearCache = async (req, res, next) => {
  res
    .status(200)
    .json({ success: true, message: "Cache cleared successfully" });
};

exports.getBackup = async (req, res, next) => {
  try {
    const [users, polls, votes, comments] = await Promise.all([
      User.find().select("-password -refreshToken"),
      Poll.find(),
      Vote.find(),
      Comment.find(),
    ]);

    const backup = {
      timestamp: new Date(),
      data: { users, polls, votes, comments },
    };
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=backup_${Date.now()}.json`,
    );
    res.status(200).json(backup);
  } catch (error) {
    next(error);
  }
};

// ==================== B2B MANAGEMENT ====================

exports.getB2BRequests = async (req, res, next) => {
  try {
    const B2BRequest = require("../models/B2BRequest.model");
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status } = req.query;

    let filter = {};
    if (status) filter.status = status;

    const [requests, total] = await Promise.all([
      B2BRequest.find(filter)
        .populate("user", "companyName email phoneNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      B2BRequest.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: { requests },
      total,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

exports.approveB2BRequest = async (req, res, next) => {
  try {
    const B2BRequest = require("../models/B2BRequest.model");
    const request = await B2BRequest.findById(req.params.id);
    if (!request) return next(new AppError(404, "Request not found"));

    request.status = "approved";
    request.approvedAt = new Date();
    request.approvedBy = req.user._id;
    await request.save();

    await ActivityLog.create({
      user: req.user._id,
      action: "APPROVE_B2B_REQUEST",
      status: "SUCCESS",
      details: { requestId: request._id, company: request.fullName },
    });

    res.status(200).json({
      success: true,
      message: "Request approved successfully",
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectB2BRequest = async (req, res, next) => {
  try {
    const B2BRequest = require("../models/B2BRequest.model");
    const { reason } = req.body;
    const request = await B2BRequest.findById(req.params.id);
    if (!request) return next(new AppError(404, "Request not found"));

    request.status = "rejected";
    request.rejectionReason = reason || "No reason provided";
    await request.save();

    await ActivityLog.create({
      user: req.user._id,
      action: "REJECT_B2B_REQUEST",
      status: "SUCCESS",
      details: { requestId: request._id, company: request.fullName, reason },
    });

    res
      .status(200)
      .json({ success: true, message: "Request rejected", data: { request } });
  } catch (error) {
    next(error);
  }
};

exports.getB2BSubscriptions = async (req, res, next) => {
  try {
    const B2BSubscription = require("../models/B2BSubscription.model");
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      B2BSubscription.find()
        .populate("user", "companyName email phoneNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      B2BSubscription.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: { subscriptions },
      total,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

exports.getB2BPayments = async (req, res, next) => {
  try {
    const B2BSubscription = require("../models/B2BSubscription.model");
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      B2BSubscription.find({ paymentStatus: "completed" })
        .populate("user", "companyName email")
        .select(
          "transactionId tier price priceBDT paymentMethod paymentStatus createdAt user",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      B2BSubscription.countDocuments({ paymentStatus: "completed" }),
    ]);

    const formattedPayments = payments.map((payment) => ({
      _id: payment._id,
      transactionId: payment.transactionId,
      tier: payment.tier,
      amount: payment.price,
      amountBDT: payment.priceBDT,
      paymentMethod: payment.paymentMethod,
      status: payment.paymentStatus,
      createdAt: payment.createdAt,
      user: payment.user,
    }));

    res.status(200).json({
      success: true,
      data: { payments: formattedPayments },
      total,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

exports.getB2BUsers = async (req, res, next) => {
  try {
    const B2BUser = require("../models/B2BUser.model");
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      B2BUser.find()
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      B2BUser.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: { users },
      total,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== B2B CATEGORY MANAGEMENT ====================

exports.getB2BCategories = async (req, res, next) => {
  try {
    const DataCategory = require("../models/DataCategory.model");
    const categories = await DataCategory.find({ isActive: true }).sort({
      order: 1,
      name: 1,
    });
    res.status(200).json({ success: true, data: { categories } });
  } catch (error) {
    next(error);
  }
};

// Create a new B2B category
exports.createB2BCategory = async (req, res, next) => {
  try {
    const DataCategory = require("../models/DataCategory.model");
    const {
      name,
      displayName,
      description,
      icon,
      color,
      requiredPlan,
      sensitivity,
      isActive,
    } = req.body;

    // Validation
    if (!name || !displayName) {
      return res.status(400).json({
        success: false,
        message: "Name and display name are required",
      });
    }

    // Check if category already exists
    const existingCategory = await DataCategory.findOne({
      name: name.toLowerCase(),
    });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: `Category with name "${name}" already exists. Please use a different name.`,
      });
    }

    // Create category
    const category = await DataCategory.create({
      name: name.toLowerCase(),
      displayName,
      description: description || "",
      icon: icon || "📋",
      color: color || "#ef4444",
      requiredPlan: requiredPlan || "basic",
      sensitivity: sensitivity || "low",
      isActive: isActive !== undefined ? isActive : true,
    });

    // Log activity - wrap in try-catch to prevent main operation failure
    try {
      await ActivityLog.create({
        user: req.user._id,
        action: "CREATE_B2B_CATEGORY",
        status: "SUCCESS",
        details: { categoryId: category._id, categoryName: category.name },
      });
    } catch (logError) {
      console.error("Activity log failed:", logError.message);
      // Don't fail the main operation
    }

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: { category },
    });
  } catch (error) {
    console.error("Create category error:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message:
          "Category with this name already exists. Please use a different name.",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create category",
    });
  }
};

exports.updateB2BCategory = async (req, res, next) => {
  try {
    const DataCategory = require("../models/DataCategory.model");
    const { id } = req.params;
    const {
      name,
      displayName,
      description,
      icon,
      color,
      requiredPlan,
      sensitivity,
      isActive,
    } = req.body;

    const category = await DataCategory.findById(id);
    if (!category) return next(new AppError(404, "Category not found"));

    if (name) category.name = name.toLowerCase();
    if (displayName) category.displayName = displayName;
    if (description !== undefined) category.description = description;
    if (icon) category.icon = icon;
    if (color) category.color = color;
    if (requiredPlan) category.requiredPlan = requiredPlan;
    if (sensitivity) category.sensitivity = sensitivity;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    await ActivityLog.create({
      user: req.user._id,
      action: "UPDATE_B2B_CATEGORY",
      status: "SUCCESS",
      details: { categoryId: category._id, categoryName: category.name },
    });

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteB2BCategory = async (req, res, next) => {
  try {
    const DataCategory = require("../models/DataCategory.model");
    const { id } = req.params;

    const category = await DataCategory.findById(id);
    if (!category) return next(new AppError(404, "Category not found"));

    await category.deleteOne();

    await ActivityLog.create({
      user: req.user._id,
      action: "DELETE_B2B_CATEGORY",
      status: "SUCCESS",
      details: { categoryId: category._id, categoryName: category.name },
    });

    res
      .status(200)
      .json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    next(error);
  }
};
