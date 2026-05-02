const mongoose = require("mongoose");
const crypto = require("crypto");

const voteSchema = new mongoose.Schema(
  {
    poll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Poll",
      required: [true, "Poll ID is required"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Candidate ID is required"],
    },
    voteReceipt: {
      type: String,
      unique: true,
      sparse: true,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    deviceFingerprint: {
      type: String,
      default: null,
    },
    verified: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate votes
voteSchema.index({ poll: 1, user: 1 }, { unique: true });
voteSchema.index({ poll: 1, candidate: 1 });
voteSchema.index({ user: 1, createdAt: -1 });

// ✅ SIMPLIFIED FIX: No 'next' parameter needed with async/await
voteSchema.pre("save", async function() {
  if (!this.voteReceipt) {
    this.voteReceipt = crypto.randomBytes(32).toString("hex");
  }
});

voteSchema.methods.getDetails = async function () {
  const poll = await mongoose.model("Poll").findById(this.poll);
  const candidate = poll?.candidates.id(this.candidate);

  return {
    id: this._id,
    poll: {
      id: poll?._id,
      title: poll?.title,
      category: poll?.category,
    },
    candidate: candidate
      ? {
          id: candidate._id,
          name: candidate.name,
          description: candidate.description,
        }
      : null,
    voteReceipt: this.voteReceipt,
    votedAt: this.createdAt,
  };
};

module.exports = mongoose.model("Vote", voteSchema);