const discoveryService = require('../services/discoveryService');
const EdgeGateway = require('../models/EdgeGateway');
const edgeService = require('../services/edgeService');
const crypto = require('crypto');

exports.startDiscovery = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const { startIP, endIP, deepProbe } = req.body;

        // 1. Initialize scan state in memory
        await discoveryService.initiateScan(companyId, { startIP, endIP, deepProbe });

        // 2. Grab the live Socket.io instance from Express
        const io = req.app.get('io');
        if (!io) {
            console.error('[DISCOVERY] Socket.io not attached to req.app');
            return res.status(500).json({ success: false, message: 'Socket server error' });
        }

        // 3. Find the active Factory Connector for this company and send the command
        const gateways = await EdgeGateway.find({ companyId });
        let commandSent = false;

        for (const gw of gateways) {
            const gwInfo = edgeService.gateways.get(String(gw._id));
            if (gwInfo && gwInfo.socketId) {
                const socket = io.of('/edge').sockets.get(gwInfo.socketId);
                if (socket) {
                    socket.emit('edge:startDiscovery', { startIP, endIP, deepProbe });
                    commandSent = true;
                }
            }
        }

        // Fallback: Also emit to the general company room
        io.of('/edge').to(`company:${companyId}`).emit('edge:startDiscovery', { startIP, endIP, deepProbe });

        if (!commandSent) {
            console.warn(`[DISCOVERY] No active Factory Connector socket found in edgeService for company ${companyId}.`);
        }

        res.status(200).json({ success: true, message: 'Scan command routed to Factory Connector' });
    } catch (err) {
        next(err);
    }
};

exports.getStatus = async (req, res, next) => {
    try {
        const status = discoveryService.getStatus(req.user.companyId);
        res.status(200).json(status);
    } catch (err) {
        next(err);
    }
};

exports.edgeReport = async (req, res, next) => {
    try {
        const { companyId, apiKey, phase, results } = req.body;

        if (!companyId || !apiKey) {
            return res.status(401).json({ error: 'Missing edge credentials' });
        }

        const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
        const gateway = await EdgeGateway.findOne({ companyId, apiKeyHash: hashedKey });

        if (!gateway) {
            return res.status(401).json({ error: 'Unauthorized Factory Connector' });
        }

        discoveryService.updateStatus(companyId, { phase, results });
        res.status(200).json({ success: true });
    } catch (err) {
        console.error('[ERROR] Discovery edge report failed:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};