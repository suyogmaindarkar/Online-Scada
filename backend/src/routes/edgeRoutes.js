const express = require('express');
const router = express.Router();
const {
    getGateways,
    getGateway,
    createGateway,
    updateGateway,
    regenerateApiKey,
    downloadGatewayConfig,
    downloadCompletePackage,
    deleteGateway,
} = require('../controllers/edgeController');
const { userProtect, authorize } = require('../middleware/auth');

router.use(userProtect);

router.get('/', authorize('admin', 'engineer'), getGateways);
router.get('/:id', authorize('admin', 'engineer'), getGateway);
router.get('/:id/config', authorize('admin', 'engineer'), downloadGatewayConfig);
router.get('/:id/download-package', authorize('admin', 'engineer'), downloadCompletePackage); // 🆕

router.post('/', authorize('admin'), createGateway);
router.put('/:id', authorize('admin'), updateGateway);
router.post('/:id/regenerate-key', authorize('admin'), regenerateApiKey);
router.delete('/:id', authorize('admin'), deleteGateway);

module.exports = router;