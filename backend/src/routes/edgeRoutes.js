// ═══════════════════════════════════════════════════════════
// Edge Gateway Routes — Multi-Tenant Administration
//
// All routes require userProtect. Only admins and engineers
// can inspect gateways. Only admins can create/delete/rotate keys.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const {
    getGateways,
    getGateway,
    createGateway,
    updateGateway,
    regenerateApiKey,
    downloadGatewayConfig,
    deleteGateway,
} = require('../controllers/edgeController');
const { userProtect, authorize } = require('../middleware/auth');

// Apply userProtect universally across all gateway endpoints
router.use(userProtect);

// ─── Read Routes (Admin + Engineer) ───────────────────────
router.get('/', authorize('admin', 'engineer'), getGateways);
router.get('/:id', authorize('admin', 'engineer'), getGateway);
router.get('/:id/config', authorize('admin', 'engineer'), downloadGatewayConfig);

// ─── Write Routes (Admin Only) ────────────────────────────
router.post('/', authorize('admin'), createGateway);
router.put('/:id', authorize('admin'), updateGateway);
router.post('/:id/regenerate-key', authorize('admin'), regenerateApiKey);
router.delete('/:id', authorize('admin'), deleteGateway);

module.exports = router;