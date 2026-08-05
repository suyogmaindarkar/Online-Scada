// ═══════════════════════════════════════════════════════════
// Discovery Routes — PLC network scanning endpoints
// Phase 2: added /probe route
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const {
  startScan,
  probeDevice,
  getNetworks,
  getProgress,
  cancelScan,
} = require('../controllers/discoveryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Network info (available interfaces)
router.get('/networks', getNetworks);

// Start a full network scan (Phase 1 + Phase 2)
router.post('/scan', authorize('admin', 'engineer'), startScan);

// Deep-probe a single IP  ← NEW Phase 2
router.post('/probe', authorize('admin', 'engineer'), probeDevice);

// Get scan progress
router.get('/progress', getProgress);

// Cancel ongoing scan
router.post('/cancel', cancelScan);

module.exports = router;