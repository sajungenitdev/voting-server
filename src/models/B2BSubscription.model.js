const mongoose = require("mongoose");

const b2bSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "B2BUser",
      required: true,
    },
    tier: {
      type: String,
      enum: ["basic", "standard", "premium"],
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    priceBDT: {
      type: Number,
      required: true,
    },
    maxCategories: {
      type: Number,
      default: 4,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    // Payment Information
    paymentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    paymentMethod: {
      type: String,
      enum: [
        "credit_card",
        "debit_card",
        "bank_transfer",
        "bkash",
        "nagad",
        "rocket",
        "paypal",
        "stripe",
      ],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    invoiceNumber: {
      type: String,
      unique: true,
    },
    invoiceUrl: String,
    paymentDetails: {
      cardLast4: String,
      cardBrand: String,
      bankName: String,
      accountNumber: String,
      transactionDate: Date,
      gatewayResponse: mongoose.Schema.Types.Mixed,
    },
    billingAddress: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    couponCode: String,
    subtotal: Number,
    totalAmount: Number,
  },
  {
    timestamps: true,
  },
);

// ✅ FIXED: Generate invoice number before saving - NO 'next' PARAMETER
b2bSubscriptionSchema.pre("save", async function () {
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    this.invoiceNumber = `INV-${year}-${random}`;
  }
  if (!this.transactionId) {
    this.transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
});

// Check if subscription is valid
b2bSubscriptionSchema.methods.isValid = function () {
  return (
    this.isActive &&
    this.paymentStatus === "completed" &&
    this.endDate > new Date()
  );
};

// Get remaining days
b2bSubscriptionSchema.methods.getRemainingDays = function () {
  const diff = this.endDate - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Get invoice details
b2bSubscriptionSchema.methods.getInvoiceDetails = function () {
  return {
    invoiceNumber: this.invoiceNumber,
    transactionId: this.transactionId,
    date: this.createdAt,
    plan: this.tier.toUpperCase(),
    amount: this.price,
    amountBDT: this.priceBDT,
    paymentMethod: this.paymentMethod,
    paymentStatus: this.paymentStatus,
    billingAddress: this.billingAddress,
    validUntil: this.endDate,
  };
};

module.exports = mongoose.model("B2BSubscription", b2bSubscriptionSchema);
