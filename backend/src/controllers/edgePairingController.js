// ═══════════════════════════════════════════════════════════
// Edge Pairing Controller — Handles Pairing Code Lifecycle
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');
const EdgePairing = require('../models/EdgePairing');
const EdgeGateway = require('../models/EdgeGateway');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');
const edgeService = require('../services/edgeService');

// ─── Generate Random 6-Digit Pairing Code ─────────────────
const generate6DigitCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// ─── 1. POST /api/edge-pairing (Create Pairing Code) ─────
const createPairingCode = async (req, res) => {
    try {
        const companyId = req.companyId;

        // Find or create default gateway profile
        let gateway = await EdgeGateway.findOne({ companyId });
        if (!gateway) {
            const { hash, prefix } = EdgeGateway.generateApiKey();
            gateway = await EdgeGateway.create({
                companyId,
                name: 'Factory Connector',
                apiKeyHash: hash,
                apiKeyPrefix: prefix,
                status: 'never_connected',
            });
        }

        // Delete any existing pairing codes for this company
        await EdgePairing.deleteMany({ companyId });

        // Generate fresh code valid for 15 minutes
        let code = generate6DigitCode();
        let exists = await EdgePairing.findOne({ code });
        while (exists) {
            code = generate6DigitCode();
            exists = await EdgePairing.findOne({ code });
        }

        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        const pairing = await EdgePairing.create({
            companyId,
            code,
            gatewayId: gateway._id,
            expiresAt,
        });

        res.status(201).json({
            success: true,
            message: 'Pairing code generated successfully',
            data: {
                code: pairing.code,
                expiresAt: pairing.expiresAt,
                gatewayId: gateway._id,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── 2. POST /api/edge-pairing/redeem (Redeem Code from Gateway)
const redeemPairingCode = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ success: false, message: 'Pairing code is required' });
        }

        const pairing = await EdgePairing.findOne({
            code: String(code).trim(),
            isRedeemed: false,
            expiresAt: { $gt: new Date() },
        });

        if (!pairing) {
            return res.status(404).json({ success: false, message: 'Invalid or expired pairing code' });
        }

        const gateway = await EdgeGateway.findById(pairing.gatewayId);
        if (!gateway) {
            return res.status(404).json({ success: false, message: 'Gateway profile not found' });
        }

        // Generate fresh API key for the gateway
        const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
        gateway.apiKeyHash = hash;
        gateway.apiKeyPrefix = prefix;
        gateway.status = 'never_connected';
        await gateway.save();

        // Mark pairing code as redeemed
        pairing.isRedeemed = true;
        await pairing.save();

        // Compile PLCs and Tags for config payload
        const plcs = await PLCConnection.find({
            companyId: pairing.companyId,
            isSimulation: { $ne: true },
            isActive: true,
        });

        const plcConfigArray = [];
        for (const plc of plcs) {
            const tags = await Tag.find({
                companyId: pairing.companyId,
                plcConnection: plc._id,
                isActive: true,
            });

            if (tags.length === 0) continue;

            let normalizedProtocol = (plc.protocol || '').toLowerCase();
            if (normalizedProtocol.includes('modbus')) normalizedProtocol = 'modbus';
            if (normalizedProtocol.includes('opc')) normalizedProtocol = 'opcua';
            if (normalizedProtocol.includes('ethernet')) normalizedProtocol = 'ethernet_ip';

            plcConfigArray.push({
                plcId: plc._id.toString(),
                plcName: plc.name,
                protocol: normalizedProtocol,
                ip: plc.ipAddress,
                port: plc.port,
                rack: plc.rack || 0,
                slot: plc.slot || 0,
                opcuaUsername: plc.opcuaUsername || '',
                opcuaPassword: plc.opcuaPassword || '',
                pollIntervalMs: plc.pollingRate || 1000,
                tags: tags.map((t) => ({
                    tagId: t._id.toString(),
                    tagName: t.tagName,
                    address: t.plcAddress,
                    dataType: t.dataType,
                })),
            });
        }

        const cloudUrl = process.env.CLOUD_PUBLIC_URL || 'https://onlinescada-api.onrender.com';

        res.json({
            success: true,
            message: 'Pairing successful',
            data: {
                cloudUrl,
                namespace: '/edge',
                companyId: String(pairing.companyId),
                gatewayId: String(gateway._id),
                gatewayName: gateway.name,
                apiKey: rawKey,
                plcs: plcConfigArray,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── 3. GET /api/edge-pairing/status (Check Status) ──────
const getPairingStatus = async (req, res) => {
    try {
        const { code } = req.query;
        const query = { companyId: req.companyId };
        if (code) query.code = String(code).trim();

        const pairing = await EdgePairing.findOne(query).sort({ createdAt: -1 });

        if (!pairing) {
            return res.json({
                success: true,
                data: { active: false, isRedeemed: false, expired: true },
            });
        }

        const isExpired = new Date() > pairing.expiresAt;

        res.json({
            success: true,
            data: {
                active: !isExpired && !pairing.isRedeemed,
                code: pairing.code,
                isRedeemed: pairing.isRedeemed,
                expired: isExpired,
                expiresAt: pairing.expiresAt,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── 4. GET /api/edge/status (Overall Edge Namespace Status)
const getEdgeStatus = async (req, res) => {
    try {
        const isNamespaceReady = !!edgeService.edgeNamespace;
        const activeGatewayCount = edgeService.gateways.size;

        res.json({
            success: true,
            data: {
                status: isNamespaceReady ? 'online' : 'offline',
                namespace: '/edge',
                initialized: edgeService.isInitialized,
                activeGatewaysCount: activeGatewayCount,
                serverTime: new Date().toISOString(),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createPairingCode,
    redeemPairingCode,
    getPairingStatus,
    getEdgeStatus,
};
