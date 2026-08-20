// ═══════════════════════════════════════════════════════════
// Legacy Auth Routes — DEPRECATED
//
// Kept for backward compat during transition.
// New apps should use /api/workspace/* instead.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const {
  register,
  login,
  getMe,
  getAllUsers,
  updateUser,
  deleteUser,
} = require('../controllers/authController');
const { userProtect, authorize } = require('../middleware/auth');

// ─── Deprecated public routes ──────────────────────────────
router.post('/register', register); // returns 410
router.post('/login',    login);    // returns 410

// ─── User info (still works with new userToken) ────────────
router.get('/me', userProtect, getMe);

// ─── Admin-only user management ────────────────────────────
router.get('/users',        userProtect, authorize('admin'), getAllUsers);
router.put('/users/:id',    userProtect, authorize('admin'), updateUser);
router.delete('/users/:id', userProtect, authorize('admin'), deleteUser);

module.exports = router;