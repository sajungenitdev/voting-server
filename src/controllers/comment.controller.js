const Comment = require('../models/Comment.model');
const Poll = require('../models/Poll.model');
const ActivityLog = require('../models/ActivityLog.model');
const AppError = require('../utils/AppError');

// Get client IP
const getClientIP = (req) => {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         req.connection?.remoteAddress || 
         'unknown';
};

// ==================== CREATE COMMENT ====================

// Add comment to poll
exports.addComment = async (req, res, next) => {
  try {
    const { pollId, content, parentCommentId } = req.body;
    const userId = req.user._id;

    // Check if poll exists
    const poll = await Poll.findById(pollId);
    if (!poll) {
      return next(new AppError(404, 'Poll not found'));
    }

    // Check if poll allows comments
    if (poll.settings && poll.settings.allowComments === false) {
      return next(new AppError(403, 'Comments are disabled for this poll'));
    }

    // Check if parent comment exists (if replying)
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return next(new AppError(404, 'Parent comment not found'));
      }
      if (parentComment.isDeleted) {
        return next(new AppError(400, 'Cannot reply to a deleted comment'));
      }
    }

    // Create comment
    const comment = await Comment.create({
      poll: pollId,
      user: userId,
      content,
      parentComment: parentCommentId || null
    });

    // Populate user info
    await comment.populate('user', 'name email');

    // Log activity
    await ActivityLog.create({
      user: userId,
      action: 'CREATE_COMMENT',
      status: 'SUCCESS',
      details: {
        pollId,
        commentId: comment._id,
        isReply: !!parentCommentId
      }
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`poll_${pollId}`).emit('new-comment', {
        comment: {
          id: comment._id,
          content: comment.content,
          user: {
            id: comment.user._id,
            name: comment.user.name
          },
          createdAt: comment.createdAt,
          likeCount: 0,
          isLiked: false
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: { comment }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== GET COMMENTS ====================

// Get comments for a poll
exports.getPollComments = async (req, res, next) => {
  try {
    const { pollId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sortBy || 'latest'; // latest, popular

    // Check if poll exists
    const poll = await Poll.findById(pollId);
    if (!poll) {
      return next(new AppError(404, 'Poll not found'));
    }

    // Build sort options
    let sortOptions = {};
    if (sortBy === 'latest') {
      sortOptions = { createdAt: -1 };
    } else if (sortBy === 'popular') {
      sortOptions = { likeCount: -1, createdAt: -1 };
    }

    // Get top-level comments (not replies)
    const comments = await Comment.find({ 
      poll: pollId, 
      parentComment: null,
      isDeleted: false
    })
      .populate('user', 'name email')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({ 
      poll: pollId, 
      parentComment: null,
      isDeleted: false
    });

    // Get replies for each comment and check if user liked
    const userId = req.user?._id;
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        // Get replies (limited to 5 per comment)
        const replies = await Comment.find({ 
          parentComment: comment._id,
          isDeleted: false
        })
          .populate('user', 'name email')
          .sort({ createdAt: 1 })
          .limit(5);

        const replyCount = await Comment.countDocuments({ 
          parentComment: comment._id,
          isDeleted: false
        });

        return {
          id: comment._id,
          content: comment.content,
          createdAt: comment.createdAt,
          isEdited: comment.isEdited,
          editedAt: comment.editedAt,
          likeCount: comment.likeCount,
          isLiked: userId ? comment.isLikedByUser(userId) : false,
          user: {
            id: comment.user._id,
            name: comment.user.name,
            email: comment.user.email
          },
          replies,
          replyCount,
          hasMoreReplies: replyCount > 5
        };
      })
    );

    res.status(200).json({
      success: true,
      count: commentsWithReplies.length,
      total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      data: { comments: commentsWithReplies }
    });
  } catch (error) {
    next(error);
  }
};

// Get replies for a specific comment
exports.getCommentReplies = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      return next(new AppError(404, 'Comment not found'));
    }

    const replies = await Comment.find({ 
      parentComment: commentId,
      isDeleted: false
    })
      .populate('user', 'name email')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({ 
      parentComment: commentId,
      isDeleted: false
    });

    const userId = req.user?._id;
    const formattedReplies = replies.map(reply => ({
      id: reply._id,
      content: reply.content,
      createdAt: reply.createdAt,
      likeCount: reply.likeCount,
      isLiked: userId ? reply.isLikedByUser(userId) : false,
      user: {
        id: reply.user._id,
        name: reply.user.name
      }
    }));

    res.status(200).json({
      success: true,
      count: formattedReplies.length,
      total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      data: { replies: formattedReplies }
    });
  } catch (error) {
    next(error);
  }
};

// Get single comment
exports.getCommentById = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id)
      .populate('user', 'name email')
      .populate('poll', 'title');

    if (!comment) {
      return next(new AppError(404, 'Comment not found'));
    }

    if (comment.isDeleted) {
      return next(new AppError(404, 'Comment has been deleted'));
    }

    // Get replies count
    const replyCount = await Comment.countDocuments({ 
      parentComment: comment._id,
      isDeleted: false
    });

    const userId = req.user?._id;
    const response = {
      id: comment._id,
      content: comment.content,
      createdAt: comment.createdAt,
      isEdited: comment.isEdited,
      editedAt: comment.editedAt,
      likeCount: comment.likeCount,
      isLiked: userId ? comment.isLikedByUser(userId) : false,
      replyCount,
      user: {
        id: comment.user._id,
        name: comment.user.name,
        email: comment.user.email
      },
      poll: {
        id: comment.poll._id,
        title: comment.poll.title
      }
    };

    res.status(200).json({
      success: true,
      data: { comment: response }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== UPDATE COMMENT ====================

// Update comment
exports.updateComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return next(new AppError(404, 'Comment not found'));
    }

    // Check ownership
    if (comment.user.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin') {
      return next(new AppError(403, 'You can only edit your own comments'));
    }

    if (comment.isDeleted) {
      return next(new AppError(400, 'Cannot edit a deleted comment'));
    }

    comment.content = content;
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    await ActivityLog.create({
      user: req.user._id,
      action: 'UPDATE_COMMENT',
      status: 'SUCCESS',
      details: { commentId: comment._id }
    });

    res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      data: { 
        comment: {
          id: comment._id,
          content: comment.content,
          isEdited: comment.isEdited,
          editedAt: comment.editedAt
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== DELETE COMMENT ====================

// Delete comment (soft delete)
exports.deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return next(new AppError(404, 'Comment not found'));
    }

    // Check ownership or admin
    if (comment.user.toString() !== req.user._id.toString() && 
        req.user.role !== 'admin') {
      return next(new AppError(403, 'You can only delete your own comments'));
    }

    await comment.softDelete();

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

// ==================== LIKE/UNLIKE COMMENT ====================

// Like a comment
exports.likeComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return next(new AppError(404, 'Comment not found'));
    }

    if (comment.isDeleted) {
      return next(new AppError(400, 'Cannot like a deleted comment'));
    }

    const isLiked = await comment.toggleLike(req.user._id);

    await ActivityLog.create({
      user: req.user._id,
      action: isLiked ? 'LIKE_COMMENT' : 'UNLIKE_COMMENT',
      status: 'SUCCESS',
      details: { commentId: comment._id }
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`poll_${comment.poll}`).emit('comment-like-update', {
        commentId: comment._id,
        likeCount: comment.likeCount,
        isLiked
      });
    }

    res.status(200).json({
      success: true,
      message: isLiked ? 'Comment liked' : 'Comment unliked',
      data: {
        likeCount: comment.likeCount,
        isLiked
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== ADMIN MODERATION ====================

// Get flagged comments (admin only)
exports.getFlaggedComments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({ isFlagged: true, isDeleted: false })
      .populate('user', 'name email')
      .populate('poll', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({ isFlagged: true, isDeleted: false });

    res.status(200).json({
      success: true,
      count: comments.length,
      total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      data: { comments }
    });
  } catch (error) {
    next(error);
  }
};

// Flag a comment (user report)
exports.flagComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return next(new AppError(404, 'Comment not found'));
    }

    comment.isFlagged = true;
    await comment.save();

    await ActivityLog.create({
      user: req.user._id,
      action: 'FLAG_COMMENT',
      status: 'SUCCESS',
      details: { commentId: comment._id }
    });

    res.status(200).json({
      success: true,
      message: 'Comment reported to admin'
    });
  } catch (error) {
    next(error);
  }
};

// Moderate comment (admin only)
exports.moderateComment = async (req, res, next) => {
  try {
    const { action } = req.body; // 'approve', 'delete', 'unflag'
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return next(new AppError(404, 'Comment not found'));
    }

    switch (action) {
      case 'delete':
        await comment.softDelete();
        break;
      case 'unflag':
        comment.isFlagged = false;
        await comment.save();
        break;
      case 'approve':
        comment.isFlagged = false;
        await comment.save();
        break;
      default:
        return next(new AppError(400, 'Invalid action'));
    }

    await ActivityLog.create({
      user: req.user._id,
      action: 'MODERATE_COMMENT',
      status: 'SUCCESS',
      details: { commentId: comment._id, action }
    });

    res.status(200).json({
      success: true,
      message: `Comment ${action}d successfully`
    });
  } catch (error) {
    next(error);
  }
};