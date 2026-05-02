const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body
  });
  
  // Handle validation errors from express-validator
  if (err.name === 'ValidationError' && err.errors) {
    return res.status(400).json({
      success: false,
      status: 'fail',
      message: 'Validation failed',
      errors: err.errors
    });
  }
  
  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      stack: err.stack,
      errors: err.errors || null
    });
  } else {
    if (err.isOperational) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Something went wrong'
      });
    }
  }
};

module.exports = errorHandler;