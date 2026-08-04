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
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// VIEW - All authenticated users can view
router.get('/', getSettings);
router.get('/system-info', getSystemInfo);
router.get('/backup/export', exportBackup);

// MODIFY - Only ADMIN can modify
router.put('/', authorize('admin'), updateSettings);
router.post('/backup/import', authorize('admin'), importBackup);
router.post('/reset', authorize('admin'), resetSettings);

module.exports = router;