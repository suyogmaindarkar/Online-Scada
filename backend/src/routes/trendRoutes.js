// ============================================
// Trend Routes
//
// Task Bundle applied:
//   ✅ T023  — POST /trends/export CSV endpoint
// ============================================

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

const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Single tag history — GET /api/trends/history/:tagId?timeRange=1h&aggregation=10s
router.get('/history/:tagId', getTagHistory);

// Multiple tags history — POST /api/trends/history/multiple
router.post('/history/multiple', getMultipleTagsHistory);

// Custom time range — POST /api/trends/history/custom
router.post('/history/custom', getCustomRangeHistory);

// Statistics — GET /api/trends/stats/:tagId?timeRange=1h
router.get('/stats/:tagId', getTagStats);

// Latest value — GET /api/trends/latest/:tagId
router.get('/latest/:tagId', getLatestValue);

// ✅ T023: Server-side CSV export — POST /api/trends/export
router.post('/export', exportTrendCSV);

module.exports = router;