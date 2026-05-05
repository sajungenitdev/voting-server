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

        // User Management actions
        "CREATE_USER",
        "UPDATE_USER",

        // Category actions
        "CREATE_CATEGORY",
        "UPDATE_CATEGORY",
        "DELETE_CATEGORY",

        // B2B Actions (ADD THESE)
        "CREATE_B2B_CATEGORY",
        "UPDATE_B2B_CATEGORY",
        "DELETE_B2B_CATEGORY",
        "APPROVE_B2B_REQUEST",
        "REJECT_B2B_REQUEST",
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

// Indexes
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ user: 1, action: 1 });
activityLogSchema.index({ action: 1, status: 1 });
activityLogSchema.index({ email: 1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
