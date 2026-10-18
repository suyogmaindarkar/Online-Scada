const express = require('express');
const router = express.Router();
const { startDiscovery, getStatus, edgeReport, cancelDiscovery } = require('../controllers/discoveryController');
const { userProtect } = require('../middleware/auth');

// Factory Connector Reporting Route (Authenticates via API key in payload)
router.post('/edge-report', edgeReport);

// Frontend App Routes (Authenticates via JWT)
// Using userProtect to ensure a valid user session exists before scanning
router.post('/start', userProtect, startDiscovery);
router.get('/status', userProtect, getStatus);
router.post('/cancel', userProtect, cancelDiscovery);
router.post('/scan', userProtect, startDiscovery);
router.get('/progress', userProtect, getStatus);

module.exports = router;
