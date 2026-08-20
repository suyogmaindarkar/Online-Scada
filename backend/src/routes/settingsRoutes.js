// ═══════════════════════════════════════════════════════════
// Settings Routes — Multi-Tenant Update
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

// ✅ All routes require valid user token
router.use(userProtect);

// VIEW — admin/engineer can view
router.get('/', getSettings);
router.get('/system-info', getSystemInfo);
router.get('/backup/export', authorize('admin'), exportBackup);

// MODIFY — admin only
router.put('/', authorize('admin'), updateSettings);
router.post('/backup/import', authorize('admin'), importBackup);
router.post('/reset', authorize('admin'), resetSettings);

module.exports = router;