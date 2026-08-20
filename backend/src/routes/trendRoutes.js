// ═══════════════════════════════════════════════════════════
// Trend Routes — Multi-Tenant Update
// Note: trendController.js queries InfluxDB which is not
// tenant-scoped YET (InfluxDB stores by tagName, not companyId).
// But the routes now require userProtect for auth.
// Phase 6+ will add InfluxDB tenant scoping if needed.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const {
  getTagHistory,
  getMultipleTagsHistory,
  getCustomRangeHistory,
  getTagStats,
  getLatestValue,
  exportTrendCSV,
} = require('../controllers/trendController');
const { userProtect } = require('../middleware/auth');

// ✅ All routes require valid user token
router.use(userProtect);

router.get('/history/:tagId', getTagHistory);
router.post('/history/multiple', getMultipleTagsHistory);
router.post('/history/custom', getCustomRangeHistory);
router.get('/stats/:tagId', getTagStats);
router.get('/latest/:tagId', getLatestValue);
router.post('/export', exportTrendCSV);

module.exports = router;