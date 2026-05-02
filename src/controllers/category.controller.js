const Category = require("../models/Category.model");
const Poll = require("../models/Poll.model");
const AppError = require("../utils/AppError");

// Get all categories
exports.getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({
      order: 1,
      name: 1,
    });

    // Get poll count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const pollCount = await Poll.countDocuments({
          category: category.name,
          isPublished: true,
        });
        return {
          ...category.toObject(),
          pollCount,
        };
      }),
    );

    res.status(200).json({
      success: true,
      count: categoriesWithCount.length,
      data: { categories: categoriesWithCount },
    });
  } catch (error) {
    next(error);
  }
};

// Get single category
exports.getCategoryByName = async (req, res, next) => {
  try {
    const { name } = req.params;
    const category = await Category.findOne({ name: name.toLowerCase() });

    if (!category) {
      return next(new AppError(404, "Category not found"));
    }

    const pollCount = await Poll.countDocuments({
      category: category.name,
      isPublished: true,
    });

    res.status(200).json({
      success: true,
      data: {
        category: { ...category.toObject(), pollCount },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create category (admin only)
exports.createCategory = async (req, res, next) => {
  try {
    const { name, displayName, description, icon, color, order } = req.body;

    const existingCategory = await Category.findOne({
      name: name.toLowerCase(),
    });
    if (existingCategory) {
      return next(new AppError(400, "Category already exists"));
    }

    const category = await Category.create({
      name: name.toLowerCase(),
      displayName,
      description,
      icon: icon || "📋",
      color: color || "#4F46E5",
      order: order || 0,
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: { category },
    });
  } catch (error) {
    next(error);
  }
};

// Initialize default categories
exports.initDefaultCategories = async () => {
  const defaultCategories = [
    {
      name: "politics",
      displayName: "Politics",
      icon: "🏛️",
      color: "#EF4444",
      order: 1,
    },
    {
      name: "entertainment",
      displayName: "Entertainment",
      icon: "🎬",
      color: "#F59E0B",
      order: 2,
    },
    {
      name: "sports",
      displayName: "Sports",
      icon: "⚽",
      color: "#10B981",
      order: 3,
    },
    {
      name: "technology",
      displayName: "Technology",
      icon: "💻",
      color: "#3B82F6",
      order: 4,
    },
    {
      name: "business",
      displayName: "Business",
      icon: "💼",
      color: "#8B5CF6",
      order: 5,
    },
    {
      name: "education",
      displayName: "Education",
      icon: "📚",
      color: "#06B6D4",
      order: 6,
    },
    {
      name: "health",
      displayName: "Health",
      icon: "🏥",
      color: "#EC4899",
      order: 7,
    },
    {
      name: "other",
      displayName: "Other",
      icon: "📋",
      color: "#6B7280",
      order: 8,
    },
  ];

  for (const cat of defaultCategories) {
    const exists = await Category.findOne({ name: cat.name });
    if (!exists) {
      await Category.create(cat);
      console.log(`✅ Category created: ${cat.displayName}`);
    }
  }
};
