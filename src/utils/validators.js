import { body, param, query } from 'express-validator';

// Auth validators
export const registerValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain at least one number')
];

export const loginValidator = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

// Poll validators
export const createPollValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('Poll title is required')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('description')
    .notEmpty().withMessage('Poll description is required')
    .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),
  body('category')
    .isIn(['politics', 'entertainment', 'sports', 'technology', 'business', 'other'])
    .withMessage('Invalid category'),
  body('endDate')
    .isISO8601().withMessage('Invalid end date')
    .custom(value => {
      if (new Date(value) <= new Date()) {
        throw new Error('End date must be in the future');
      }
      return true;
    }),
  body('candidates')
    .isArray({ min: 2 }).withMessage('At least 2 candidates required')
    .custom(value => {
      if (value.length > 10) {
        throw new Error('Maximum 10 candidates allowed');
      }
      return true;
    })
];

// Vote validators
export const voteValidator = [
  param('pollId').isMongoId().withMessage('Invalid poll ID'),
  body('candidateId').isMongoId().withMessage('Invalid candidate ID')
];

// Pagination validators
export const paginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt()
];