// ═══════════════════════════════════════════════════════════
// Global Error Handler Middleware
// Catches ALL errors and returns consistent response format
// ═══════════════════════════════════════════════════════════

const AppError = require('../utils/AppError');

// ─────────────────────────────────────────
// 404 Handler — for undefined routes
// ─────────────────────────────────────────
const notFound = (req, res, next) => {
  const error = new AppError(
    `Route not found: ${req.method} ${req.originalUrl}`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

// ─────────────────────────────────────────
// Global Error Handler
// Formats ALL errors consistently
// ─────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.errorCode = err.errorCode || null;

  // ── Log for developers ────────────────────────────────
  console.error('❌ Error:', {
    method: req.method,
    url: req.originalUrl,
    status: error.statusCode,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // ── Handle specific Mongoose errors ──────────────────

  // CastError = invalid ObjectId
  if (err.name === 'CastError') {
    error.statusCode = 400;
    error.message = `Invalid ${err.path}: ${err.value}`;
    error.errorCode = 'INVALID_ID';
  }

  // Duplicate key error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue?.[field] || 'value';
    error.statusCode = 400;
    error.message = `Duplicate ${field}: '${value}' already exists`;
    error.errorCode = 'DUPLICATE_ENTRY';
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    error.statusCode = 400;
    error.message = messages.join(', ') || 'Validation failed';
    error.errorCode = 'VALIDATION_ERROR';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.statusCode = 401;
    error.message = 'Invalid authentication token';
    error.errorCode = 'INVALID_TOKEN';
  }
  if (err.name === 'TokenExpiredError') {
    error.statusCode = 401;
    error.message = 'Authentication token expired. Please login again.';
    error.errorCode = 'TOKEN_EXPIRED';
  }

  // JSON parse error
  if (err.type === 'entity.parse.failed') {
    error.statusCode = 400;
    error.message = 'Invalid JSON in request body';
    error.errorCode = 'INVALID_JSON';
  }

  // Payload too large
  if (err.type === 'entity.too.large') {
    error.statusCode = 413;
    error.message = 'Request too large. Please reduce data size.';
    error.errorCode = 'PAYLOAD_TOO_LARGE';
  }

  // ── Send standardized response ────────────────────────
  const response = {
    success: false,
    message: error.message || 'Internal Server Error',
    errorCode: error.errorCode || 'UNKNOWN_ERROR',
  };

  // Only include stack trace in development
  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(error.statusCode).json(response);
};

module.exports = { notFound, errorHandler };