// ═══════════════════════════════════════════════════════════
// Workspace Routes — Multi-Tenant Authentication + Signup
//
// Public:
//   POST /api/workspace/register    — Self-service free trial signup
//   POST /api/workspace/verify      — Step 1: verify workspace
//
// Workspace Token Required:
//   POST /api/workspace/login-user  — Step 2: login as user
//   GET  /api/workspace/users       — Refresh user list
//
// User Token Required:
//   GET  /api/workspace/me          — Current user + company info
//   POST /api/workspace/logout-user — Logout user, keep workspace
//   POST /api/workspace/logout-all  — Full logout
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const {
  registerCompany,
  verifyWorkspace,
  loginUser,
  getWorkspaceUsers,
  getMe,
  logoutUser,
  logoutAll,
} = require('../controllers/workspaceController');
const {
  workspaceProtect,
  userProtect,
} = require('../middleware/auth');

// ─── Public: Self-Service Signup (no auth required) ───────
// Rate limit: max 5 signups per IP per hour to prevent abuse
const signupRateLimit = require('express-rate-limit');
const signupLimiter = signupRateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,                     // 5 signups per IP per hour
  message: {
    success: false,
    message: 'Too many signup attempts. Please try again later.',
    code: 'RATE_LIMITED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', signupLimiter, registerCompany);

// ─── Public: Step 1 (verify workspace) ────────────────────
router.post('/verify', verifyWorkspace);

// ─── Step 2 (requires workspaceToken) ─────────────────────
router.post('/login-user', workspaceProtect, loginUser);
router.get('/users', workspaceProtect, getWorkspaceUsers);

// ─── After user login (requires userToken) ────────────────
router.get('/me', userProtect, getMe);
router.post('/logout-user', userProtect, logoutUser);
router.post('/logout-all', userProtect, logoutAll);

module.exports = router;