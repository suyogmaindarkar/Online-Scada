const express = require('express');
const router = express.Router();
const { startDiscovery, getStatus, edgeReport } = require('../controllers/discoveryController');
const { workspaceProtect, userProtect } = require('../middleware/auth');

// Factory Connector Reporting Route (Authenticates via API key in payload)
router.post('/edge-report', edgeReport);

// Frontend App Routes (Authenticates via JWT)
// Using userProtect to ensure a valid user session exists before scanning
router.post('/start', workspaceProtect, userProtect, startDiscovery);
router.get('/status', workspaceProtect, userProtect, getStatus);

module.exports = router;