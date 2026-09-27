const discoveryService = require('../services/discoveryService');
const EdgeGateway = require('../models/EdgeGateway');
const crypto = require('crypto');

exports.startDiscovery = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const { startIP, endIP, deepProbe } = req.body;
        
        await discoveryService.initiateScan(companyId, { startIP, endIP, deepProbe });
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

        // Validate Factory Connector API key to ensure security
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