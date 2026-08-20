// ═══════════════════════════════════════════════════════════
// Report Routes — Multi-Tenant Update
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const {
  getProductionReport,
  getAlarmReport,
  getActivityReport,
  getRecentActivity,
} = require('../controllers/reportController');
const { userProtect, authorize } = require('../middleware/auth');

router.use(userProtect);

router.post('/production', authorize('admin', 'engineer'), getProductionReport);
router.post('/alarms', authorize('admin', 'engineer'), getAlarmReport);
router.post('/activity', authorize('admin'), getActivityReport);
router.get('/activity/recent', authorize('admin', 'engineer'), getRecentActivity);

module.exports = router;