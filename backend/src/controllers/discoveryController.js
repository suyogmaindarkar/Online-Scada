const discoveryService = require('../services/discoveryService');
const EdgeGateway = require('../models/EdgeGateway');
const Company = require('../models/Company');
const edgeService = require('../services/edgeService');
const crypto = require('crypto');

exports.startDiscovery = async (req, res, next) => {
    try {
        const options = discoveryService.validateOptions(req.body);
        const gateways = edgeService.getCompanyGateways(req.companyId);
        const gateway = req.body?.gatewayId ? gateways.find((candidate) => candidate.gatewayId === String(req.body.gatewayId)) : gateways[0];
        if (!gateway) return res.status(409).json({ success: false, code: 'CONNECTOR_OFFLINE', message: 'Factory Connector is offline. Start it before scanning the factory network.' });
        const status = discoveryService.initiateScan(req.companyId, options, gateway.gatewayId);
        const relay = edgeService.sendDiscoveryCommand(req.companyId, 'edge:startDiscovery', { ...options, scanId: status.scanId }, gateway.gatewayId);
        if (!relay.ok) {
            discoveryService.failScan(req.companyId, relay.message);
            return res.status(409).json({ success: false, ...relay });
        }
        res.status(200).json({ success: true, message: 'Scan command routed to Factory Connector', scanId: status.scanId, ...status });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, message: err.message });
        next(err);
    }
};

exports.getStatus = (req, res) => res.status(200).json(discoveryService.getStatus(req.companyId));

exports.cancelDiscovery = (req, res) => {
    const scan = discoveryService.cancelScan(req.companyId);
    if (scan) edgeService.sendDiscoveryCommand(req.companyId, 'edge:cancelDiscovery', { scanId: scan.scanId }, scan.gatewayId);
    res.json({ success: true, ...discoveryService.getStatus(req.companyId) });
};

// Compatibility for connectors reporting through HTTP. New connectors report on
// their authenticated socket; both paths require scan + gateway correlation.
exports.edgeReport = async (req, res) => {
    try {
        const { companyId, apiKey, scanId, phase, results, message } = req.body;
        if (!companyId || typeof apiKey !== 'string') return res.status(401).json({ success: false, message: 'Missing connector credentials' });
        const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        const gateway = await EdgeGateway.findOne({ companyId, apiKeyHash });
        const company = gateway && await Company.findOne({ _id: companyId });
        if (!gateway || !company?.canAccess() || !company.edgeApiEnabled) return res.status(401).json({ success: false, message: 'Unauthorized Factory Connector' });
        const accepted = discoveryService.updateStatus(companyId, { scanId, phase, results, message }, String(gateway._id));
        res.status(accepted ? 200 : 409).json({ success: accepted });
    } catch (_) {
        res.status(500).json({ success: false, message: 'Unable to update discovery status' });
    }
};
