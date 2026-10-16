// ═══════════════════════════════════════════════════════════
// Error Handler Middleware — Production Hardened
// ✅ Masks internal error details and stack traces in production
// ═══════════════════════════════════════════════════════════

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  const isProduction = process.env.NODE_ENV === 'production';

  // Log full stack trace on server terminal (for Suyog's debugging)
  if (!isProduction) {
    console.error('Server Error:', err.stack);
  } else {
    console.error(`[PROD ERROR] ${req.method} ${req.originalUrl}:`, err.message);
  }

  res.status(statusCode).json({
    success: false,
    message: isProduction && statusCode === 500
      ? 'An internal server error occurred. Please try again later.'
      : err.message,
    code: err.code || 'SERVER_ERROR',
    // 🔒 Never leak stack trace to the browser network tab in production
    stack: isProduction ? null : err.stack,
  });
};

module.exports = { notFound, errorHandler };
