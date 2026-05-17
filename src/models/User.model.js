const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    fullName: {
      type: String,
      trim: true,
      maxlength: [100, "Full name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },

    // Google OAuth
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },
    avatar: {
      type: String,
      default: null,
    },

    // B2B Fields
    companyName: {
      type: String,
      trim: true,
      maxlength: [100, "Company name cannot exceed 100 characters"],
    },
    phoneNumber: {
      type: String,
      trim: true,
      match: [
        /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/,
        "Please provide a valid phone number",
      ],
    },
    billingAddress: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true, default: "Bangladesh" },
      zipCode: { type: String, trim: true },
    },

    // Role & Status
    role: {
      type: String,
      enum: ["user", "admin", "moderator", "b2b_buyer"],
      default: "user",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // B2B Subscription
    subscription: {
      tier: {
        type: String,
        enum: ["basic", "standard", "premium", "enterprise", null],
        default: null,
      },
      startDate: Date,
      endDate: Date,
      status: {
        type: String,
        enum: ["active", "expired", "cancelled", "pending"],
        default: "pending",
      },
      autoRenew: {
        type: Boolean,
        default: false,
      },
      maxCategories: {
        type: Number,
        default: 0,
      },
      features: [{ type: String }],
    },

    // B2B Request/Application
    b2bRequest: {
      requestId: { type: String },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      purpose: { type: String, trim: true },
      selectedCategories: [{ type: String }],
      requestedAt: Date,
      approvedAt: Date,
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },

    // API Keys for B2B
    apiKeys: [
      {
        name: { type: String, required: true },
        key: { type: String, required: true },
        permissions: [{ type: String }],
        allowedCategories: [{ type: String }],
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date },
        lastUsed: Date,
        isActive: { type: Boolean, default: true },
      },
    ],

    // Security & Auth
    refreshToken: {
      type: String,
      select: false,
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    lastLogin: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,

    // User Statistics
    statistics: {
      totalVotes: { type: Number, default: 0 },
      totalPollsCreated: { type: Number, default: 0 },
      totalComments: { type: Number, default: 0 },
      joinDate: { type: Date, default: Date.now },
      lastActive: Date,
    },

    // Preferences
    preferences: {
      theme: {
        type: String,
        enum: ["dark", "light", "system"],
        default: "dark",
      },
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        voteUpdates: { type: Boolean, default: true },
        pollEnding: { type: Boolean, default: true },
      },
      language: { type: String, default: "en" },
    },

    // Activity Log
    activityLog: [
      {
        action: { type: String },
        timestamp: { type: Date, default: Date.now },
        ipAddress: { type: String },
        userAgent: { type: String },
        details: { type: mongoose.Schema.Types.Mixed },
      },
    ],

    // Social Links
    socialLinks: {
      website: { type: String, trim: true },
      twitter: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      github: { type: String, trim: true },
    },

    // Bio/Description
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      trim: true,
    },

    // Location
    location: {
      country: { type: String, trim: true },
      city: { type: String, trim: true },
      timezone: { type: String, default: "UTC" },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ==================== VIRTUAL FIELDS ====================

userSchema.virtual("isB2BUser").get(function () {
  return this.role === "b2b_buyer" || !!this.companyName;
});

userSchema.virtual("hasActiveSubscription").get(function () {
  return (
    this.subscription &&
    this.subscription.status === "active" &&
    this.subscription.endDate &&
    new Date(this.subscription.endDate) > new Date()
  );
});

userSchema.virtual("displayName").get(function () {
  return (
    this.fullName || this.name || this.companyName || this.email?.split("@")[0]
  );
});

// ==================== PRE-SAVE MIDDLEWARE (COMPLETELY FIXED) ====================

// Hash password before saving - NO 'next' parameter
userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// Update statistics - NO 'next' parameter needed
userSchema.pre("save", function () {
  if (this.isNew && this.statistics) {
    this.statistics.joinDate = new Date();
  }
  if (this.statistics) {
    this.statistics.lastActive = new Date();
  }
});

// ==================== INSTANCE METHODS ====================

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

userSchema.methods.incrementLoginAttempts = function () {
  this.loginAttempts += 1;
  if (this.loginAttempts >= 5) {
    this.lockUntil = Date.now() + 30 * 60 * 1000;
  }
  return this.save();
};

userSchema.methods.resetLoginAttempts = function () {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  return this.save();
};

userSchema.methods.addActivity = async function (action, req, details = {}) {
  this.activityLog.push({
    action,
    ipAddress: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.headers?.["user-agent"],
    details,
  });
  if (this.activityLog.length > 100) {
    this.activityLog = this.activityLog.slice(-100);
  }
  return this.save();
};

userSchema.methods.updateLastActive = function () {
  if (this.statistics) {
    this.statistics.lastActive = new Date();
  }
  return this.save();
};

// ==================== INDEXES ====================

userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ "subscription.status": 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ "b2bRequest.status": 1 });

module.exports = mongoose.model("User", userSchema);
