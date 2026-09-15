// ═══════════════════════════════════════════════════════════
// Edge Gateway Controller — Multi-Tenant CRUD
//
// Scoped by req.companyId, plan limits enforced.
// Generates dynamic JSON configuration profiles for gateways.
// Forces socket disconnect on key rotation or deletion.
// ═══════════════════════════════════════════════════════════

const EdgeGateway = require('../models/EdgeGateway');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');
const edgeService = require('../services/edgeService');

// ─── Helper: Compile config.json profile dynamically ──────
const compileGatewayConfig = async (companyId, gateway, rawKey = null) => {
  // Find all active, non-simulation PLCs for this company
  const plcs = await PLCConnection.find({
    companyId,
    isSimulation: { $ne: true },
    isActive: true,
  });

  const plcConfigArray = [];

  for (const plc of plcs) {
    // Find all active tags mapped to this PLC
    const tags = await Tag.find({
      companyId,
      plcConnection: plc._id,
      isActive: true,
    });

    // Skip PLCs that have no configured tags
    if (tags.length === 0) continue;

    let normalizedProtocol = plc.protocol.toLowerCase();
    if (normalizedProtocol === 'modbus_tcp' || normalizedProtocol === 'modbus_rtu') {
      normalizedProtocol = 'modbus';
    }

    plcConfigArray.push({
      plcId: plc._id.toString(),
      protocol: normalizedProtocol, // 's7' | 'modbus' | 'opcua'
      ip: plc.ipAddress,
      port: plc.port,
      rack: plc.rack || 0,
      slot: plc.slot || 0,
      pollIntervalMs: plc.pollingRate || 1000,
      tags: tags.map((t) => ({
        tagId: t._id.toString(),
        tagName: t.tagName,
        address: t.plcAddress,
        dataType: t.dataType,
      })),
    });
  }

  // Fallback API host URL
  const cloudUrl = process.env.VITE_API_URL 
    ? process.env.VITE_API_URL.replace(/^http/, 'ws') // Replace http/https with ws/wss
    : 'wss://onlinescada-backend.onrender.com';

  return {
    cloudUrl,
    namespace: '/edge',
    companyId: String(companyId),
    gatewayId: String(gateway._id),
    gatewayName: gateway.name,
    apiKey: rawKey || '<YOUR_SAVED_API_KEY_HERE>',
    plcs: plcConfigArray,
  };
};

// ─── Helper: Force-disconnect socket if online ────────────
const forceDisconnectGatewaySocket = (req, gatewayId) => {
  try {
    const io = req.app.get('io');
    const gatewayInfo = edgeService.gateways.get(String(gatewayId));
    if (gatewayInfo && gatewayInfo.socketId && io) {
      const socket = io.of('/edge').sockets.get(gatewayInfo.socketId);
      if (socket) {
        console.log(`🔌 Force-disconnecting socket ${socket.id} for key change or deletion of ${gatewayId}`);
        socket.disconnect(true);
      }
    }
  } catch (err) {
    console.error('⚠️ Failed to disconnect socket:', err.message);
  }
};

// ═══════════════════════════════════════════════════════════
// GET ALL GATEWAYS
// ═══════════════════════════════════════════════════════════
const getGateways = async (req, res) => {
  try {
    const gateways = await EdgeGateway.find({ companyId: req.companyId })
      .sort({ createdAt: -1 });

    // Enforce live status updates from memory
    const activeGateways = gateways.map((gw) => {
      const isLiveOnline = edgeService.hasActiveGateway(req.companyId) && 
                          edgeService.gateways.has(gw._id.toString());
      return {
        ...gw.toObject(),
        status: isLiveOnline ? 'online' : (gw.status === 'never_connected' ? 'never_connected' : 'offline'),
      };
    });

    res.json({
      success: true,
      count: gateways.length,
      data: activeGateways,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// GET SINGLE GATEWAY
// ═══════════════════════════════════════════════════════════
const getGateway = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) {
      return res.status(404).json({ success: false, message: 'Gateway not found' });
    }

    const isLiveOnline = edgeService.gateways.has(gateway._id.toString());
    const compiled = {
      ...gateway.toObject(),
      status: isLiveOnline ? 'online' : (gateway.status === 'never_connected' ? 'never_connected' : 'offline'),
    };

    res.json({ success: true, data: compiled });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// CREATE GATEWAY (Plan Limit Checked)
// ═══════════════════════════════════════════════════════════
const createGateway = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Gateway name is required' });
    }

    // ─── 1. Limit Check ───────────────────────────────────
    const currentCount = await EdgeGateway.countDocuments({ companyId: req.companyId });
    const maxGateways = req.company?.limits?.maxGateways || 1;

    if (currentCount >= maxGateways) {
      return res.status(403).json({
        success: false,
        message: `Plan limit reached: ${currentCount}/${maxGateways} Gateways. Upgrade your plan to add more.`,
        code: 'PLAN_LIMIT_EXCEEDED',
      });
    }

    // ─── 2. Uniqueness Check ──────────────────────────────
    const exists = await EdgeGateway.findOne({ companyId: req.companyId, name: name.trim() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'A gateway with this name already exists' });
    }

    // ─── 3. Generate Key Pair ─────────────────────────────
    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();

    const gateway = await EdgeGateway.create({
      companyId: req.companyId,
      name: name.trim(),
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      status: 'never_connected',
    });

    res.status(201).json({
      success: true,
      message: 'Gateway profile generated. Copy your API Key now.',
      data: {
        _id: gateway._id,
        name: gateway.name,
        apiKey: rawKey, // Sent ONCE
        apiKeyPrefix: gateway.apiKeyPrefix,
        status: gateway.status,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// UPDATE GATEWAY DETAILS
// ═══════════════════════════════════════════════════════════
const updateGateway = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Gateway name is required' });
    }

    // Enforce name uniqueness scoped by company
    const duplicate = await EdgeGateway.findOne({
      companyId: req.companyId,
      name: name.trim(),
      _id: { $ne: req.params.id },
    });

    if (duplicate) {
      return res.status(400).json({ success: false, message: 'Another gateway is already using this name' });
    }

    const gateway = await EdgeGateway.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { name: name.trim() },
      { new: true, runValidators: true }
    );

    if (!gateway) {
      return res.status(404).json({ success: false, message: 'Gateway not found' });
    }

    res.json({ success: true, message: 'Gateway updated', data: gateway });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// REGENERATE API KEY (Rotates key + disconnects online socket)
// ═══════════════════════════════════════════════════════════
const regenerateApiKey = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) {
      return res.status(404).json({ success: false, message: 'Gateway not found' });
    }

    // 1. Force-disconnect live connection if active
    forceDisconnectGatewaySocket(req, gateway._id);

    // 2. Generate new key pair
    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();

    gateway.apiKeyHash = hash;
    gateway.apiKeyPrefix = prefix;
    gateway.status = 'never_connected';
    await gateway.save();

    res.json({
      success: true,
      message: 'New API Key generated. Your previous key is now dead.',
      data: {
        _id: gateway._id,
        name: gateway.name,
        apiKey: rawKey, // Sent ONCE
        apiKeyPrefix: gateway.apiKeyPrefix,
        status: gateway.status,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// DOWNLOAD CONFIGURATION PROFILE (JSON format)
// ═══════════════════════════════════════════════════════════
const downloadGatewayConfig = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) {
      return res.status(404).json({ success: false, message: 'Gateway profile not found' });
    }

    const { apiKey } = req.query; // If downloaded immediately, frontend can append the raw key
    const configProfile = await compileGatewayConfig(req.companyId, gateway, apiKey);

    const filename = `${gateway.name.toLowerCase().replace(/\s+/g, '_')}_config.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(configProfile, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// DELETE GATEWAY
// ═══════════════════════════════════════════════════════════
const deleteGateway = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) {
      return res.status(404).json({ success: false, message: 'Gateway not found' });
    }

    // 1. Terminate socket stream safely
    forceDisconnectGatewaySocket(req, gateway._id);

    // 2. Delete database profile
    await EdgeGateway.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });

    res.json({
      success: true,
      message: `Gateway "${gateway.name}" deleted successfully.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

module.exports = {
  getGateways,
  getGateway,
  createGateway,
  updateGateway,
  regenerateApiKey,
  downloadGatewayConfig,
  deleteGateway,
};