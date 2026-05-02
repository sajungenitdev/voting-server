const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    
    // Extract detailed error messages
    const extractedErrors = errors.array().map(err => ({
      field: err.param,
      message: err.msg,
      value: err.value
    }));
    
    console.log('Validation errors:', JSON.stringify(extractedErrors, null, 2));
    
    // Return detailed error response
    return res.status(400).json({
      success: false,
      status: 'fail',
      message: 'Validation failed',
      errors: extractedErrors
    });
  };
};

module.exports = { validate };