const B2BUser = require("../models/B2BUser.model");
const B2BRequest = require("../models/B2BRequest.model");
const B2BSubscription = require("../models/B2BSubscription.model");
const B2BApiKey = require("../models/B2BApiKey.model");
const DataCategory = require("../models/DataCategory.model");
const {
  sendOTPEmail,
  sendWelcomeCredentialsEmail,
  sendSubscriptionInvoiceEmail,
  sendPaymentConfirmationEmail,
} = require("../services/b2bEmail.service");
const { generateAccessToken } = require("../utils/generateToken");
const AppError = require("../utils/AppError");
const crypto = require("crypto");

// ==================== HELPER FUNCTIONS ====================

// Generate random password
const generateRandomPassword = () => {
  const length = 10;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Get client IP
const getClientIP = (req) => {
  return (
    req.ip ||
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.connection?.remoteAddress ||
    "unknown"
  );
};

// Enhanced CSV conversion function for FULL user data
const convertToCSVFull = (data, categories) => {
  let csv = "";
  const timestamp = new Date().toISOString();

  csv += `"VOTING PLATFORM DATA EXPORT"\n`;
  csv += `"Export Date","${timestamp}"\n`;
  csv += `"Data Categories","${categories.join(", ")}"\n`;
  csv += `\n`;

  for (const category of categories) {
    const categoryData = data[category];
    if (!categoryData) continue;

    csv += `\n"========== ${category.toUpperCase()} DATA =========="\n`;

    if (category === "demographics") {
      csv += `\n"--- SUMMARY ---"\n`;
      csv += `"Metric","Value"\n`;
      csv += `"Total Users",${categoryData.summary?.totalUsers || 0}\n`;
      csv += `"Verified Users",${categoryData.summary?.verifiedUsers || 0}\n`;
      csv += `"Unverified Users",${categoryData.summary?.unverifiedUsers || 0}\n`;

      const users = categoryData.users || [];
      if (users && users.length > 0) {
        csv += `\n"--- COMPLETE USER LIST ---"\n`;
        csv += `"User ID","Name","Email","Phone","Location","Age","Gender","Registered Date","Verified","Last Login"\n`;

        users.forEach((user) => {
          csv += `"${user.id || ""}","${user.name || ""}","${user.email || ""}","${user.phoneNumber || "N/A"}","${user.location || "N/A"}","${user.age || "N/A"}","${user.gender || "N/A"}","${user.registeredAt || ""}","${user.isVerified ? "Yes" : "No"}","${user.lastLogin || "Never"}"\n`;
        });
      }
    } else if (category === "voting_history") {
      const votes = Array.isArray(categoryData) ? categoryData : [];
      if (votes.length > 0) {
        csv += `\n"--- VOTING HISTORY WITH USER DETAILS ---"\n`;
        csv += `"User ID","User Name","User Email","User Location","User Age","User Gender","Total Votes","First Vote Date","Last Vote Date","Unique Polls Voted"\n`;

        votes.forEach((vote) => {
          csv += `"${vote.user?.id || ""}","${vote.user?.name || ""}","${vote.user?.email || ""}","${vote.user?.location || "N/A"}","${vote.user?.age || "N/A"}","${vote.user?.gender || "N/A"}",${vote.totalVotes || 0},"${vote.firstVoteDate || ""}","${vote.lastVoteDate || ""}",${vote.uniquePollsVoted || 0}\n`;
        });
      }
    } else if (category === "poll_participation") {
      const participations = Array.isArray(categoryData) ? categoryData : [];
      if (participations.length > 0) {
        csv += `\n"--- POLL PARTICIPATION ---"\n`;
        csv += `"Category","Total Polls","Total Votes","Average Participation"\n`;
        participations.forEach((part) => {
          csv += `"${part._id || ""}",${part.totalPolls || 0},${part.totalVotes || 0},${part.averageParticipation || 0}\n`;
        });
      }
    } else if (category === "geographic_data") {
      const geoData = Array.isArray(categoryData) ? categoryData : [];
      if (geoData.length > 0) {
        csv += `\n"--- GEOGRAPHIC DISTRIBUTION ---"\n`;
        csv += `"Location","User Count","Users"\n`;
        geoData.forEach((location) => {
          const usersList =
            location.users?.map((u) => `${u.name} (${u.email})`).join("; ") ||
            "";
          csv += `"${location._id || "Unknown"}",${location.count || 0},"${usersList}"\n`;
        });
      }
    }
  }

  csv += `\n"========== END OF REPORT =========="\n`;
  return csv;
};

// ==================== PUBLIC ROUTES ====================

// B2B User Login
// backend/src/controllers/b2b.controller.js - Update b2bLogin

exports.b2bLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await B2BUser.findOne({ email }).select("+password");

    if (!user) {
      return next(new AppError(401, "Invalid email or password"));
    }

    if (!user.isActive) {
      return next(
        new AppError(
          401,
          "Your account has been deactivated. Please contact support.",
        ),
      );
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      await user.save();
      return next(new AppError(401, "Invalid email or password"));
    }

    user.loginAttempts = 0;
    user.lastLogin = new Date();
    await user.save();

    const accessToken = generateAccessToken(user._id);

    // ✅ Return complete user data
    const userData = {
      _id: user._id,
      id: user._id,
      name: user.fullName || user.companyName,
      fullName: user.fullName,
      companyName: user.companyName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role || "b2b_buyer",
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    };

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      data: {
        user: userData, // ✅ Return user object
        accessToken: accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Submit data access request
exports.submitRequest = async (req, res, next) => {
  try {
    console.log("=".repeat(50));
    console.log("📥 B2B SUBMIT REQUEST");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const {
      fullName,
      email,
      phoneNumber,
      purpose,
      selectedCategories,
      termsAgreed,
      complianceAgreed,
    } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!fullName) missingFields.push("fullName");
    if (!email) missingFields.push("email");
    if (!phoneNumber) missingFields.push("phoneNumber");
    if (!purpose) missingFields.push("purpose");
    if (
      !selectedCategories ||
      !Array.isArray(selectedCategories) ||
      selectedCategories.length === 0
    ) {
      missingFields.push("selectedCategories (must be a non-empty array)");
    }

    if (missingFields.length > 0) {
      console.log("❌ Missing required fields:", missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // Validate purpose length
    if (purpose.length > 1000) {
      console.log("❌ Purpose exceeds 1000 characters:", purpose.length);
      return res.status(400).json({
        success: false,
        message: "Purpose must be less than 1000 characters",
      });
    }

    if (!termsAgreed || !complianceAgreed) {
      return res.status(400).json({
        success: false,
        message: "You must agree to Terms & Policy and Data Usage Compliance",
      });
    }

    // Check if user exists
    let existingUser = null;
    try {
      existingUser = await B2BUser.findOne({ email });
      console.log("Existing user found:", !!existingUser);
    } catch (userError) {
      console.error("Error finding user:", userError.message);
    }

    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    console.log(`📝 Creating request for ${email}`);
    console.log(`Selected categories: ${selectedCategories.join(", ")}`);

    // Create request with clean data
    const requestData = {
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber.trim(),
      purpose: purpose.trim().substring(0, 1000), // Truncate if too long
      selectedCategories: selectedCategories.filter((cat) => cat && cat.trim()),
      termsAgreed: Boolean(termsAgreed),
      complianceAgreed: Boolean(complianceAgreed),
      otp,
      otpExpiresAt,
      status: "pending",
      otpVerified: false,
    };

    // Add user reference if exists
    if (existingUser) {
      requestData.user = existingUser._id;
    }

    console.log("Request data prepared, saving to database...");

    const request = await B2BRequest.create(requestData);
    console.log(`✅ Request created successfully with ID: ${request._id}`);

    // Try to send email (but don't fail if it doesn't work)
    try {
      await sendOTPEmail(email, otp, fullName);
      console.log(`📧 OTP email sent to ${email}`);
    } catch (emailError) {
      console.error(`⚠️ Failed to send OTP email: ${emailError.message}`);
      // Don't return error - continue anyway
    }

    res.status(201).json({
      success: true,
      message:
        "Request submitted successfully. Please check your email for OTP verification.",
      data: {
        requestId: request._id,
        email: email,
        isNewUser: !existingUser,
        requiresVerification: true,
        message: !existingUser
          ? "After OTP verification, you will receive your account credentials via email."
          : "After OTP verification, your request will be processed.",
      },
    });
  } catch (error) {
    console.error("❌ Submit request error:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message,
      );
      console.error("Validation errors:", validationErrors);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    next(error);
  }
};

// backend/src/controllers/b2b.controller.js - Update verifyOTP
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp, requestId } = req.body;

    const request = await B2BRequest.findById(requestId);
    if (!request) {
      return next(new AppError(404, "Request not found"));
    }

    if (request.otp !== otp || request.otpExpiresAt < new Date()) {
      return next(new AppError(400, "Invalid or expired OTP"));
    }

    let user = await B2BUser.findOne({ email });
    let isNewlyCreated = false;
    let tempPassword = null;

    if (!user) {
      tempPassword = generateRandomPassword();
      isNewlyCreated = true;

      user = await B2BUser.create({
        companyName: request.fullName,
        fullName: request.fullName,
        email: request.email,
        phoneNumber: request.phoneNumber,
        password: tempPassword,
        isVerified: true,
        isActive: true,
        role: "b2b_buyer", // ✅ Add this
      });

      request.user = user._id;
      await request.save();
      await sendWelcomeCredentialsEmail(email, tempPassword, request.fullName);
    } else {
      user.isVerified = true;
      user.role = "b2b_buyer"; // ✅ Add this
      await user.save();
    }

    request.otpVerified = true;
    request.status = "approved";
    request.approvedAt = new Date();
    await request.save();

    const accessToken = generateAccessToken(user._id);

    // ✅ Return complete user data
    const userData = {
      _id: user._id,
      id: user._id,
      name: user.fullName || user.companyName,
      fullName: user.fullName,
      companyName: user.companyName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role || "b2b_buyer",
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    };

    res.status(200).json({
      success: true,
      message: isNewlyCreated
        ? "Email verified successfully! Account credentials sent to your email."
        : "Request verified successfully!",
      data: {
        user: userData, // ✅ Add user object
        accessToken: accessToken,
        isNewUser: isNewlyCreated,
        canLogin: true,
        redirectUrl: "/b2b/dashboard",
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    next(error);
  }
};
// Resend OTP
exports.resendOTP = async (req, res, next) => {
  try {
    const { email, requestId } = req.body;
    const request = await B2BRequest.findById(requestId);
    if (!request) {
      return next(new AppError(404, "Request not found"));
    }

    const otp = generateOTP();
    request.otp = otp;
    request.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await request.save();

    await sendOTPEmail(email, otp, request.fullName);

    res.status(200).json({
      success: true,
      message: "New OTP sent to your email",
    });
  } catch (error) {
    next(error);
  }
};

// Get available data categories
exports.getDataCategories = async (req, res, next) => {
  try {
    const categories = await DataCategory.find({ isActive: true });
    res.status(200).json({
      success: true,
      count: categories.length,
      data: { categories },
    });
  } catch (error) {
    next(error);
  }
};

// Get subscription plans
exports.getSubscriptionPlans = async (req, res, next) => {
  try {
    const plans = {
      basic: {
        name: "Basic",
        price: 50,
        priceBDT: 5000,
        maxCategories: 4,
        features: [
          "Basic analytics",
          "Email support",
          "Monthly reports",
          "API access (1000/day)",
        ],
      },
      standard: {
        name: "Standard",
        price: 100,
        priceBDT: 10000,
        maxCategories: 8,
        features: [
          "Advanced analytics",
          "Priority support",
          "Weekly reports",
          "API access (5000/day)",
          "Data export",
        ],
      },
      premium: {
        name: "Premium",
        price: 299,
        priceBDT: 29900,
        maxCategories: "Unlimited",
        features: [
          "Full access",
          "24/7 dedicated support",
          "Real-time data",
          "Custom reports",
          "SLA agreement",
          "White-label solution",
        ],
      },
    };
    res.status(200).json({
      success: true,
      data: { plans },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== PROTECTED ROUTES ====================

// Get B2B user profile
exports.getProfile = async (req, res, next) => {
  try {
    const user = await B2BUser.findById(req.user._id)
      .populate("subscription")
      .select("-password");
    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// Update B2B user profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { companyName, phoneNumber, billingAddress } = req.body;
    const updateData = {};
    if (companyName) updateData.companyName = companyName;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (billingAddress) updateData.billingAddress = billingAddress;

    const user = await B2BUser.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// Create/activate subscription with payment
exports.createSubscription = async (req, res, next) => {
  try {
    const {
      tier,
      paymentMethod,
      autoRenew,
      cardDetails,
      billingAddress,
      couponCode,
    } = req.body;
    const userId = req.user._id;

    const pricing = {
      basic: { price: 50, priceBDT: 5000, maxCategories: 4 },
      standard: { price: 100, priceBDT: 10000, maxCategories: 8 },
      premium: { price: 299, priceBDT: 29900, maxCategories: 999 },
    };

    const selectedPlan = pricing[tier];
    if (!selectedPlan) {
      return next(new AppError(400, "Invalid subscription tier"));
    }

    const taxRate = 0.1;
    const taxAmount = selectedPlan.price * taxRate;
    let discountAmount = 0;
    if (couponCode === "WELCOME20") {
      discountAmount = selectedPlan.price * 0.2;
    }
    const finalAmount = selectedPlan.price + taxAmount - discountAmount;

    const existingSubscription = await B2BSubscription.findOne({
      user: userId,
      isActive: true,
      paymentStatus: "completed",
      endDate: { $gt: new Date() },
    });

    if (existingSubscription) {
      return next(
        new AppError(
          400,
          "You already have an active subscription. Please cancel it first.",
        ),
      );
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    const subscription = await B2BSubscription.create({
      user: userId,
      tier,
      price: selectedPlan.price,
      priceBDT: selectedPlan.priceBDT,
      maxCategories: selectedPlan.maxCategories,
      endDate,
      autoRenew: autoRenew || false,
      paymentMethod,
      paymentStatus: "completed",
      paymentId: `PAY_${Date.now()}_${userId}`,
      paymentDetails: cardDetails
        ? {
            cardLast4: cardDetails.last4,
            cardBrand: cardDetails.brand,
            transactionDate: new Date(),
          }
        : {},
      billingAddress: billingAddress || {},
      taxAmount,
      discountAmount,
      couponCode,
      subtotal: selectedPlan.price,
      totalAmount: finalAmount,
    });

    await B2BUser.findByIdAndUpdate(userId, { subscription: subscription._id });

    const invoiceDetails = {
      invoiceNumber: subscription.invoiceNumber,
      transactionId: subscription.transactionId,
      date: subscription.createdAt.toLocaleDateString(),
      plan: tier.toUpperCase(),
      amount: selectedPlan.price,
      amountBDT: selectedPlan.priceBDT,
      paymentMethod,
      validUntil: endDate.toLocaleDateString(),
      taxAmount,
      discountAmount,
      totalAmount: finalAmount,
      cardLast4: cardDetails?.last4,
      subtotal: selectedPlan.price,
    };

    await sendSubscriptionInvoiceEmail(
      req.user.email,
      req.user.fullName,
      invoiceDetails,
    );
    await sendPaymentConfirmationEmail(req.user.email, req.user.fullName, {
      transactionId: subscription.transactionId,
      amount: selectedPlan.price,
      amountBDT: selectedPlan.priceBDT,
      paymentMethod,
      tier: tier.toUpperCase(),
      endDate: endDate.toLocaleDateString(),
    });

    res.status(201).json({
      success: true,
      message:
        "Subscription activated successfully. Invoice sent to your email.",
      data: {
        subscription: {
          id: subscription._id,
          tier,
          price: selectedPlan.price,
          priceBDT: selectedPlan.priceBDT,
          endDate,
          remainingDays: 30,
          invoiceNumber: subscription.invoiceNumber,
          transactionId: subscription.transactionId,
          paymentStatus: "completed",
        },
      },
    });
  } catch (error) {
    console.error("Subscription error:", error);
    next(error);
  }
};

// Get subscription details
exports.getMySubscription = async (req, res, next) => {
  try {
    const user = await B2BUser.findById(req.user._id).populate("subscription");
    if (!user.subscription) {
      return res.status(200).json({
        success: true,
        data: { hasSubscription: false, message: "No active subscription" },
      });
    }

    const subscription = user.subscription;
    const isValid =
      subscription.endDate > new Date() &&
      subscription.paymentStatus === "completed";
    const remainingDays = Math.ceil(
      (subscription.endDate - new Date()) / (1000 * 60 * 60 * 24),
    );

    res.status(200).json({
      success: true,
      data: {
        subscriptionId: subscription._id,
        hasSubscription: true,
        isActive: isValid,
        tier: subscription.tier,
        price: subscription.price,
        priceBDT: subscription.priceBDT,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        remainingDays: remainingDays > 0 ? remainingDays : 0,
        maxCategories: subscription.maxCategories,
        autoRenew: subscription.autoRenew,
        paymentStatus: subscription.paymentStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Cancel subscription
exports.cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await B2BSubscription.findOne({
      user: req.user._id,
      isActive: true,
    });
    if (!subscription) {
      return next(new AppError(404, "No active subscription found"));
    }
    subscription.isActive = false;
    subscription.autoRenew = false;
    await subscription.save();
    res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get invoice by invoice number
exports.getInvoice = async (req, res, next) => {
  try {
    const { invoiceNumber } = req.params;
    const subscription = await B2BSubscription.findOne({
      invoiceNumber,
      user: req.user._id,
    }).populate("user", "companyName email phoneNumber billingAddress");

    if (!subscription) {
      return next(new AppError(404, "Invoice not found"));
    }

    res.status(200).json({
      success: true,
      data: {
        invoice: {
          invoiceNumber: subscription.invoiceNumber,
          transactionId: subscription.transactionId,
          date: subscription.createdAt,
          company: {
            name: subscription.user.companyName,
            email: subscription.user.email,
            phone: subscription.user.phoneNumber,
            address: subscription.user.billingAddress,
          },
          plan: {
            tier: subscription.tier,
            price: subscription.price,
            priceBDT: subscription.priceBDT,
            maxCategories: subscription.maxCategories,
          },
          billingAddress: subscription.billingAddress,
          paymentMethod: subscription.paymentMethod,
          paymentDetails: subscription.paymentDetails,
          subtotal: subscription.subtotal || subscription.price,
          taxAmount: subscription.taxAmount,
          discountAmount: subscription.discountAmount,
          totalAmount: subscription.totalAmount || subscription.price,
          status: subscription.paymentStatus,
          validUntil: subscription.endDate,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get payment history
exports.getPaymentHistory = async (req, res, next) => {
  try {
    const subscriptions = await B2BSubscription.find({
      user: req.user._id,
      paymentStatus: "completed",
    }).sort({ createdAt: -1 });

    const paymentHistory = subscriptions.map((sub) => ({
      invoiceNumber: sub.invoiceNumber,
      transactionId: sub.transactionId,
      date: sub.createdAt,
      tier: sub.tier,
      amount: sub.price,
      amountBDT: sub.priceBDT,
      paymentMethod: sub.paymentMethod,
      status: sub.paymentStatus,
      validUntil: sub.endDate,
    }));

    res.status(200).json({
      success: true,
      count: paymentHistory.length,
      data: { payments: paymentHistory },
    });
  } catch (error) {
    next(error);
  }
};

// Validate subscription and get accessible categories
exports.validateAccess = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { requestedCategories } = req.body;
    const user = await B2BUser.findById(userId).populate("subscription");

    if (!user.subscription) {
      return next(
        new AppError(403, "No subscription found. Please purchase a plan."),
      );
    }

    const subscription = user.subscription;
    if (
      subscription.endDate < new Date() ||
      subscription.paymentStatus !== "completed"
    ) {
      return next(
        new AppError(
          403,
          "Your subscription has expired or payment pending. Please renew.",
        ),
      );
    }

    let accessibleCategories = [];
    if (subscription.tier === "premium") {
      accessibleCategories = await DataCategory.find({ isActive: true });
    } else {
      accessibleCategories = await DataCategory.find({
        isActive: true,
        requiredPlan: { $in: [subscription.tier, "basic"] },
      });
    }

    if (requestedCategories && requestedCategories.length > 0) {
      if (
        subscription.tier !== "premium" &&
        requestedCategories.length > subscription.maxCategories
      ) {
        return next(
          new AppError(
            403,
            `Your ${subscription.tier} plan only allows ${subscription.maxCategories} categories. Upgrade to access more.`,
          ),
        );
      }
    }

    res.status(200).json({
      success: true,
      data: {
        subscription: {
          tier: subscription.tier,
          maxCategories: subscription.maxCategories,
          remainingDays: Math.ceil(
            (subscription.endDate - new Date()) / (1000 * 60 * 60 * 24),
          ),
          isValid: true,
        },
        accessibleCategories: accessibleCategories.map((c) => ({
          name: c.name,
          displayName: c.displayName,
          description: c.description,
          requiredPlan: c.requiredPlan,
        })),
        canAccess: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get user's requests history
exports.getMyRequests = async (req, res, next) => {
  try {
    const requests = await B2BRequest.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    res.status(200).json({
      success: true,
      count: requests.length,
      data: { requests },
    });
  } catch (error) {
    next(error);
  }
};

// Get specific request details
exports.getRequestById = async (req, res, next) => {
  try {
    const request = await B2BRequest.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!request) {
      return next(new AppError(404, "Request not found"));
    }
    res.status(200).json({
      success: true,
      data: { request },
    });
  } catch (error) {
    next(error);
  }
};

// backend/src/controllers/b2b.controller.js

exports.getUserData = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { format = "json", page = 1, limit = 100 } = req.query;

    console.log("📊 Fetching data for user:", userId);

    // Get user with subscription
    const user = await B2BUser.findById(userId).populate("subscription");

    if (!user) {
      return next(new AppError(404, "User not found"));
    }

    if (!user.subscription) {
      return next(
        new AppError(
          403,
          "No active subscription found. Please purchase a plan.",
        ),
      );
    }

    if (user.subscription.endDate < new Date()) {
      return next(new AppError(403, "Subscription has expired. Please renew."));
    }

    // Get approved request
    const approvedRequest = await B2BRequest.findOne({
      user: userId,
      status: "approved",
      otpVerified: true,
    }).sort({ createdAt: -1 });

    if (!approvedRequest) {
      return next(new AppError(404, "No approved data access request found."));
    }

    const purchasedCategories = approvedRequest.selectedCategories || [];

    if (purchasedCategories.length === 0) {
      return next(new AppError(400, "No data categories purchased."));
    }

    console.log("📊 Purchased categories:", purchasedCategories);

    // Import models
    const UserModel = require("../models/User.model");
    const Vote = require("../models/Vote.model");
    const Poll = require("../models/Poll.model");

    const responseData = {};
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // For each purchased category, fetch the relevant data
    for (const category of purchasedCategories) {
      console.log(`📊 Fetching data for category: ${category}`);

      // Handle different category types
      // You can fetch data based on the category name
      // For example, if they purchased "gaming", fetch data for gaming polls and users who voted in gaming polls

      // Fetch users who voted in polls of this category
      // First, find all polls in this category
      const categoryPolls = await Poll.find({
        category: category,
        isPublished: true,
      }).select("_id title");

      const pollIds = categoryPolls.map((p) => p._id);

      // Find votes in these polls
      const categoryVotes = await Vote.find({
        poll: { $in: pollIds },
      }).populate("user", "name email location age gender phoneNumber");

      // Get unique users who voted in this category
      const uniqueUserIds = [
        ...new Set(categoryVotes.map((v) => v.user?._id?.toString())),
      ];

      // Get full user details
      const usersWithDetails = await UserModel.find({
        _id: { $in: uniqueUserIds },
      }).select(
        "name email phoneNumber location age gender createdAt isVerified lastLogin",
      );

      // Prepare category data
      responseData[category] = {
        categoryName: category,
        totalPolls: categoryPolls.length,
        totalVotes: categoryVotes.length,
        uniqueVoters: uniqueUserIds.length,
        polls: categoryPolls.map((p) => ({
          id: p._id,
          title: p.title,
        })),
        users: usersWithDetails.map((u) => ({
          id: u._id,
          name: u.name,
          email: u.email,
          phoneNumber: u.phoneNumber || "N/A",
          location: u.location || "N/A",
          age: u.age || "N/A",
          gender: u.gender || "N/A",
          registeredAt: u.createdAt,
          isVerified: u.isVerified,
          lastLogin: u.lastLogin || "Never",
        })),
        votes: categoryVotes.slice(0, limitNum).map((v) => ({
          userId: v.user?._id,
          userName: v.user?.name,
          userEmail: v.user?.email,
          pollTitle: v.poll?.title,
          votedAt: v.createdAt,
        })),
      };

      console.log(
        `✅ Found ${categoryPolls.length} polls and ${uniqueUserIds.length} unique users for category: ${category}`,
      );
    }

    // Prepare purchase info
    const purchaseInfo = {
      subscriptionTier: user.subscription.tier,
      purchasedCategories: purchasedCategories,
      maxCategoriesAllowed:
        user.subscription.maxCategories === 999
          ? "Unlimited"
          : user.subscription.maxCategories,
      remainingCategories:
        user.subscription.maxCategories === 999
          ? "Unlimited"
          : Math.max(
              0,
              user.subscription.maxCategories - purchasedCategories.length,
            ),
      subscriptionValidUntil: user.subscription.endDate,
      remainingDays: Math.ceil(
        (user.subscription.endDate - new Date()) / (1000 * 60 * 60 * 24),
      ),
    };

    console.log("✅ Final response data keys:", Object.keys(responseData));

    res.status(200).json({
      success: true,
      data: responseData,
      purchaseInfo: purchaseInfo,
      meta: {
        totalCategories: purchasedCategories.length,
        dataRetrieved: Object.keys(responseData).length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error in getUserData:", error);
    next(error);
  }
};

// Generate API Key
exports.generateApiKey = async (req, res, next) => {
  try {
    const { name, permissions, allowedCategories } = req.body;
    const apiKey = await B2BApiKey.create({
      user: req.user._id,
      name,
      permissions: permissions || ["read:voting_data"],
      allowedCategories: allowedCategories || [],
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
    res.status(201).json({
      success: true,
      message: "API key generated successfully",
      data: {
        apiKey: apiKey.key,
        name: apiKey.name,
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all API keys for user
exports.getApiKeys = async (req, res, next) => {
  try {
    const apiKeys = await B2BApiKey.find({
      user: req.user._id,
      isActive: true,
    }).select("-key");
    res.status(200).json({
      success: true,
      count: apiKeys.length,
      data: { apiKeys },
    });
  } catch (error) {
    next(error);
  }
};

// Revoke API Key
exports.revokeApiKey = async (req, res, next) => {
  try {
    const apiKey = await B2BApiKey.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isActive: false },
      { new: true },
    );
    if (!apiKey) {
      return next(new AppError(404, "API key not found"));
    }
    res.status(200).json({
      success: true,
      message: "API key revoked successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get dashboard statistics for B2B user
exports.getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const requests = await B2BRequest.find({ user: userId });
    const subscription = await B2BSubscription.findOne({
      user: userId,
      isActive: true,
    });
    const apiKeys = await B2BApiKey.find({ user: userId, isActive: true });

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalRequests: requests.length,
          approvedRequests: requests.filter((r) => r.status === "approved")
            .length,
          pendingRequests: requests.filter((r) => r.status === "pending")
            .length,
          hasActiveSubscription: !!subscription && subscription.isValid?.(),
          subscriptionTier: subscription?.tier || null,
          apiKeysCount: apiKeys.length,
          remainingDays: subscription
            ? Math.ceil(
                (subscription.endDate - new Date()) / (1000 * 60 * 60 * 24),
              )
            : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Confirm payment (webhook or manual)
exports.confirmPayment = async (req, res, next) => {
  try {
    const { subscriptionId, transactionId } = req.body;
    const subscription = await B2BSubscription.findOne({
      _id: subscriptionId,
      user: req.user._id,
    });
    if (!subscription) {
      return next(new AppError(404, "Subscription not found"));
    }
    subscription.paymentStatus = "completed";
    subscription.isActive = true;
    subscription.transactionId = transactionId || subscription.transactionId;
    await subscription.save();
    res.status(200).json({
      success: true,
      message: "Payment confirmed successfully. Subscription is now active.",
      data: {
        subscription: {
          id: subscription._id,
          tier: subscription.tier,
          paymentStatus: subscription.paymentStatus,
          isActive: subscription.isActive,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
