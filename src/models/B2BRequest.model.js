const mongoose = require("mongoose");

const b2bRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "B2BUser",
      required: false, // ✅ IMPORTANT: Set to false to allow null for new users
      default: null,
    },
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    selectedCategories: [
      {
        type: String,
        required: true,
      },
    ],
    termsAgreed: {
      type: Boolean,
      required: true,
      default: false,
    },
    complianceAgreed: {
      type: Boolean,
      required: true,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "expired"],
      default: "pending",
    },
    otp: {
      type: String,
    },
    otpExpiresAt: Date,
    otpVerified: {
      type: Boolean,
      default: false,
    },
    approvedAt: Date,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "B2BUser",
    },
    rejectionReason: String,
    accessExpiresAt: Date,
    auditLog: [
      {
        action: String,
        timestamp: Date,
        ipAddress: String,
        userAgent: String,
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes
b2bRequestSchema.index({ user: 1, status: 1 });
b2bRequestSchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model("B2BRequest", b2bRequestSchema);
