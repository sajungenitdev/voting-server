const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const b2bUserSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "B2BSubscription",
    },
    apiKeys: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2BApiKey",
      },
    ],
    requests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "B2BRequest",
      },
    ],
    role: {
      type: String,
      enum: ["buyer", "admin"],
      default: "buyer",
    },
    lastLogin: Date,
  },
  {
    timestamps: true,
  },
);

// Hash password before saving
b2bUserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
b2bUserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("B2BUser", b2bUserSchema);
