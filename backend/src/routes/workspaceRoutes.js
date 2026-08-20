// ═══════════════════════════════════════════════════════════
// Workspace Routes — Multi-Tenant Authentication
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const {
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

// ─── Public (Step 1) ───────────────────────────────────────
router.post('/verify', verifyWorkspace);

// ─── Step 2 (requires workspaceToken) ──────────────────────
router.post('/login-user', workspaceProtect, loginUser);
router.get('/users',        workspaceProtect, getWorkspaceUsers);

// ─── After user login (requires userToken) ─────────────────
router.get('/me',           userProtect, getMe);
router.post('/logout-user', userProtect, logoutUser);
router.post('/logout-all',  userProtect, logoutAll);

module.exports = router;