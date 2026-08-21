// ═══════════════════════════════════════════════════════════
// Settings Routes — Multi-Tenant
// ✅ FIXED: Using modern userProtect middleware
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  getSystemInfo,
  exportBackup,
  importBackup,
  resetSettings,
} = require('../controllers/settingsController');

const { userProtect, authorize } = require('../middleware/auth');

// ✅ All routes require a valid user token (injects req.companyId)
router.use(userProtect);

// System Info (Dashboard needs this, any logged-in user can view)
router.get('/system-info', getSystemInfo);

// ─── Admin Only Routes ───
router.get('/', authorize('admin'), getSettings);
router.put('/', authorize('admin'), updateSettings);
router.post('/reset', authorize('admin'), resetSettings);

// Backup & Restore
router.get('/backup/export', authorize('admin'), exportBackup);
router.post('/backup/import', authorize('admin'), importBackup);

module.exports = router;