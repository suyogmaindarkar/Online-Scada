// ============================================================================
// Factory Connector Download Routes
// Serves the official installer directly to end-users from the VPS
// ============================================================================

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// GET /api/v1/connector/download
router.get('/download', (req, res) => {
    const fileLocations = [
        path.join(__dirname, '../../../frontend/public/OnlineSCADA-Factory-Connector-Setup.exe'),
        path.join(__dirname, '../../public/OnlineSCADA-Factory-Connector-Setup.exe'),
        path.join(__dirname, '../../../installer/Output/OnlineSCADA-Factory-Connector-Setup.exe'),
        path.join(__dirname, '../../public/downloads/OnlineSCADA-Factory-Connector-Setup.exe'),
    ];

    let installerPath = null;
    for (const loc of fileLocations) {
        if (fs.existsSync(loc)) {
            installerPath = loc;
            break;
        }
    }

    if (!installerPath) {
        console.error('[x] Factory Connector installer binary missing on server');
        return res.status(404).json({
            success: false,
            message: 'Factory Connector setup binary is currently being updated. Please try again in a few minutes.',
        });
    }

    // res.download forces browser attachment download without navigating or opening new tabs
    return res.download(installerPath, 'OnlineSCADA-Factory-Connector-Setup.exe', (err) => {
        if (err && !res.headersSent) {
            console.error('[x] Error sending installer download:', err.message);
            res.status(500).json({ success: false, message: 'Failed to download installer.' });
        }
    });
});

module.exports = router;