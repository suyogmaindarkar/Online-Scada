const express = require('express');
const router = express.Router();
const {
  createPairing,
  redeemPairing,
  getPairingStatus,
} = require('../controllers/gatewayPairingController');
const { userProtect, authorize } = require('../middleware/auth');

// ─── PUBLIC — called by the Factory Connector installer during first install ───
// The connector has NO token yet, so this cannot require userProtect.
// Security gate = the code itself (created by the workspace admin).
router.post('/redeem', redeemPairing);

// ─── PROTECTED — website UI (admin/engineer) ───
router.use(userProtect);
router.post('/', authorize('admin'), createPairing);
router.get('/status', authorize('admin'), getPairingStatus);

module.exports = router;
