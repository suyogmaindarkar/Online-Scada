const express = require('express');
const router = express.Router();
const { startDiscovery, getStatus, edgeReport } = require('../controllers/discoveryController');
const { workspaceProtect, requireRole } = require('../middleware/auth');

// Factory Connector Reporting Route (Authenticates via API key in payload)
router.post('/edge-report', edgeReport);

// Frontend App Routes (Authenticates via JWT)
router.post('/start', workspaceProtect, requireRole(['admin', 'engineer']), startDiscovery);
router.get('/status', workspaceProtect, requireRole(['admin', 'engineer', 'operator']), getStatus);

module.exports = router;