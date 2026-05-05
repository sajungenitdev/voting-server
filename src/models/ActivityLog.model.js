const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    email: String,
    action: {
      type: String,
      required: true,
      enum: [
        // Auth actions
        "REGISTER",
        "LOGIN",
        "LOGOUT",
        "VERIFY_OTP",
        "RESEND_OTP",
        "FORGOT_PASSWORD",
        "RESET_PASSWORD",
        "CHANGE_PASSWORD",
        "LOGIN_FAILED",
        // Poll actions
        "CREATE_POLL",
        "UPDATE_POLL",
        "DELETE_POLL",
        "PUBLISH_POLL",
        "UNPUBLISH_POLL",
        // Vote actions
        "CAST_VOTE",
        // Comment actions
        "CREATE_COMMENT",
        "DELETE_COMMENT",
        "LIKE_COMMENT",
        "UNLIKE_COMMENT",
        // Admin actions
        "UPDATE_USER_ROLE",
        "DELETE_USER",
        "TOGGLE_USER_STATUS",
        "MODERATE_COMMENT",
        // Category actions (ADD THESE)
        "CREATE_CATEGORY",
        "UPDATE_CATEGORY",
        "DELETE_CATEGORY",
      ],
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED"],
      required: true,
    },
    ipAddress: String,
    userAgent: String,
    details: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
  },
);

// Indexes for better performance
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ user: 1, action: 1 });
activityLogSchema.index({ action: 1, status: 1 });
activityLogSchema.index({ email: 1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
