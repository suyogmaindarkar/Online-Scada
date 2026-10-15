// ═══════════════════════════════════════════════════════════
// Edge Pairing Routes — Multi-Tenant & Public Status
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const {
    createPairingCode,
    redeemPairingCode,
    getPairingStatus,
    getEdgeStatus,
} = require('../controllers/edgePairingController');
const { userProtect, authorize } = require('../middleware/auth');

// ─── Public Endpoints (NO Auth Middleware) ────────────────
router.post('/redeem', redeemPairingCode);
router.get('/status', getEdgeStatus);
router.get('/edge-status', getEdgeStatus);

// ─── Protected Endpoints (User JWT Required) ──────────────
router.post('/', userProtect, authorize('admin', 'engineer'), createPairingCode);
router.get('/check', userProtect, authorize('admin', 'engineer'), getPairingStatus);

module.exports = router;