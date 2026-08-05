// ═══════════════════════════════════════════════════════════
// Report Routes
//
// Task Bundle applied:
//   ✅ T055  — POST /reports/production
//   ✅ T056  — POST /reports/alarms
//   ✅ T059  — POST /reports/activity + GET /reports/activity/recent
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const {
  getProductionReport,
  getAlarmReport,
  getActivityReport,
  getRecentActivity,
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

// All routes protected
router.use(protect);

// ─── Reports ───
router.post('/production', getProductionReport);   // T055
router.post('/alarms', getAlarmReport);            // T056
router.post('/activity', getActivityReport);        // T059

// ─── Recent activity feed (used for dashboards etc.) ───
router.get('/activity/recent', getRecentActivity);

module.exports = router;