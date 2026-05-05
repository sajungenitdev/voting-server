const mongoose = require("mongoose");

const dataCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      required: [true, "Display name is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },
    icon: {
      type: String,
      default: "📋",
    },
    color: {
      type: String,
      default: "#ef4444",
    },
    requiredPlan: {
      type: String,
      enum: ["basic", "standard", "premium"],
      default: "basic",
    },
    sensitivity: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "low",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("DataCategory", dataCategorySchema);
