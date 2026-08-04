const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── Verify JWT Token ──────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // ✅ T009: Verify and catch expiry separately
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (jwtError) {
        // Distinguish between expired and invalid tokens
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            message: 'Session expired. Please log in again.',
            code: 'TOKEN_EXPIRED',
          });
        }
        return res.status(401).json({
          success: false,
          message: 'Not authorized, invalid token',
          code: 'TOKEN_INVALID',
        });
      }

      // Get user from database (without password)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      if (!req.user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User account is deactivated',
          code: 'USER_INACTIVE',
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token check failed',
        code: 'TOKEN_INVALID',
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided',
      code: 'NO_TOKEN',
    });
  }
};

// ─── Check user role ───────────────────────────────────────────────────────
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' not authorized for this action`,
        code: 'INSUFFICIENT_ROLE',
      });
    }
    next();
  };
};

module.exports = { protect, authorize };