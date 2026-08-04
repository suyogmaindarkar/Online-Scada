// ═══════════════════════════════════════════════════════════
// AppError — Custom error class with HTTP status code
// Usage: throw new AppError('Message', 404)
// ═══════════════════════════════════════════════════════════

class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = null) {
    super(message);

    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.errorCode = errorCode; // optional short code like 'TAG_NOT_FOUND'
    this.isOperational = true;  // means: expected error, not a bug

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;