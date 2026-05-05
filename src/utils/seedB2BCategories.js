const DataCategory = require("../models/DataCategory.model");

const seedDataCategories = async () => {
  const categories = [
    {
      name: "demographics",
      displayName: "Demographics",
      description: "Age, gender, education, income distribution",
      requiredPlan: "basic",
      sensitivity: "low",
    },
    {
      name: "voting_history",
      displayName: "Voting History",
      description: "Past voting records and patterns",
      requiredPlan: "basic",
      sensitivity: "medium",
    },
    {
      name: "poll_participation",
      displayName: "Poll Participation",
      description: "User engagement with polls",
      requiredPlan: "basic",
      sensitivity: "low",
    },
    {
      name: "geographic_data",
      displayName: "Geographic Data",
      description: "Location-based voting patterns",
      requiredPlan: "standard",
      sensitivity: "medium",
    },
    {
      name: "age_groups",
      displayName: "Age Groups",
      description: "Voting patterns by age bracket",
      requiredPlan: "basic",
      sensitivity: "low",
    },
    {
      name: "gender_distribution",
      displayName: "Gender Distribution",
      description: "Gender-based voting trends",
      requiredPlan: "basic",
      sensitivity: "low",
    },
    {
      name: "education_level",
      displayName: "Education Level",
      description: "Voting patterns by education",
      requiredPlan: "standard",
      sensitivity: "medium",
    },
    {
      name: "income_bracket",
      displayName: "Income Bracket",
      description: "Voting patterns by income",
      requiredPlan: "standard",
      sensitivity: "high",
    },
    {
      name: "political_affiliation",
      displayName: "Political Affiliation",
      description: "Party preference trends",
      requiredPlan: "standard",
      sensitivity: "high",
    },
    {
      name: "interest_categories",
      displayName: "Interest Categories",
      description: "User interests and preferences",
      requiredPlan: "premium",
      sensitivity: "medium",
    },
    {
      name: "device_usage",
      displayName: "Device Usage",
      description: "Device and platform statistics",
      requiredPlan: "premium",
      sensitivity: "low",
    },
    {
      name: "engagement_metrics",
      displayName: "Engagement Metrics",
      description: "User activity and engagement scores",
      requiredPlan: "premium",
      sensitivity: "medium",
    },
    {
      name: "temporal_patterns",
      displayName: "Temporal Patterns",
      description: "Time-based voting behavior",
      requiredPlan: "premium",
      sensitivity: "medium",
    },
    {
      name: "social_media_links",
      displayName: "Social Media Links",
      description: "Connected social accounts",
      requiredPlan: "premium",
      sensitivity: "high",
    },
    {
      name: "feedback_comments",
      displayName: "Feedback & Comments",
      description: "User feedback and comments",
      requiredPlan: "premium",
      sensitivity: "high",
    },
    {
      name: "custom_segments",
      displayName: "Custom Segments",
      description: "Custom user segments",
      requiredPlan: "premium",
      sensitivity: "high",
    },
  ];

  for (const category of categories) {
    const exists = await DataCategory.findOne({ name: category.name });
    if (!exists) {
      await DataCategory.create(category);
      console.log(`✅ Category created: ${category.displayName}`);
    }
  }
};

module.exports = seedDataCategories;
