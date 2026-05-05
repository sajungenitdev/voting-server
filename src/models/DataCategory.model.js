const mongoose = require("mongoose");

const dataCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: [
        "demographics",
        "voting_history",
        "poll_participation",
        "geographic_data",
        "age_groups",
        "gender_distribution",
        "education_level",
        "income_bracket",
        "political_affiliation",
        "interest_categories",
        "device_usage",
        "engagement_metrics",
        "temporal_patterns",
        "social_media_links",
        "feedback_comments",
        "custom_segments",
      ],
    },
    displayName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    requiredPlan: {
      type: String,
      enum: ["basic", "standard", "premium"],
      default: "basic",
    },
    sensitivity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("DataCategory", dataCategorySchema);
