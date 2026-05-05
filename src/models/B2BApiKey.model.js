const mongoose = require("mongoose");
const crypto = require("crypto");

const b2bApiKeySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "B2BUser",
      required: true,
    },
    key: {
      type: String,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    permissions: [
      {
        type: String,
        enum: [
          "read:users",
          "read:voting_data",
          "read:analytics",
          "write:requests",
        ],
        default: ["read:voting_data"],
      },
    ],
    allowedCategories: [
      {
        type: String,
      },
    ],
    lastUsed: Date,
    expiresAt: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
    ipWhitelist: [String],
  },
  {
    timestamps: true,
  },
);

// ✅ FIXED: Generate API key before saving - NO 'next' PARAMETER
b2bApiKeySchema.pre("save", async function () {
  if (!this.key) {
    this.key = crypto.randomBytes(32).toString("hex");
  }
});

module.exports = mongoose.model("B2BApiKey", b2bApiKeySchema);
