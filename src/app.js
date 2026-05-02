const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const xss = require('xss');

const routes = require('./routes/v1/index');
const errorHandler = require('./middleware/error.middleware');
const { apiLimiter } = require('./middleware/rateLimit.middleware');
const AppError = require('./utils/AppError');

const app = express();

// Custom NoSQL Injection Prevention (replaces mongoSanitize)
const preventNoSQLInjection = (req, res, next) => {
  const dangerousKeys = ['$', '^', '(', ')', '[', ']', '{', '}', '|', '&', '*', '?', '+', '-', '=', '~', '`', '!', '@', '#', '%', ';', ':', '"', "'", '<', '>', ',', '.'];
  
  const sanitize = (obj) => {
    if (!obj) return obj;
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove dangerous MongoDB operators
        for (let dKey of dangerousKeys) {
          if (obj[key].includes(dKey)) {
            obj[key] = obj[key].replace(new RegExp('\\' + dKey, 'g'), '');
          }
        }
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    }
  };
  
  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);
  
  next();
};

// XSS Protection
const xssProtection = (req, res, next) => {
  if (req.body) {
    const sanitizeObject = (obj) => {
      for (let key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = xss(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };
    sanitizeObject(req.body);
  }
  next();
};

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(xssProtection);
app.use(preventNoSQLInjection);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(hpp());
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use('/api', apiLimiter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/v1', routes);

// 404 handler
app.use((req, res, next) => {
  next(new AppError(404, `Cannot find ${req.originalUrl} on this server`));
});

// Global error handler
app.use(errorHandler);

module.exports = app;