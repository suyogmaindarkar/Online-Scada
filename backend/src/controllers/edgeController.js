// ═══════════════════════════════════════════════════════════
// Edge Gateway Controller — Multi-Tenant CRUD + Package Zip
// ═══════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const EdgeGateway = require('../models/EdgeGateway');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');
const edgeService = require('../services/edgeService');

// ─── Compile config profile ─────────────────────────
const compileGatewayConfig = async (companyId, gateway, rawKey = null) => {
  const plcs = await PLCConnection.find({
    companyId,
    isSimulation: { $ne: true },
    isActive: true,
  });

  const plcConfigArray = [];
  for (const plc of plcs) {
    const tags = await Tag.find({
      companyId,
      plcConnection: plc._id,
      isActive: true,
    });

    if (tags.length === 0) continue;

    let normalizedProtocol = plc.protocol.toLowerCase();
    if (normalizedProtocol === 'modbus_tcp' || normalizedProtocol === 'modbus_rtu') {
      normalizedProtocol = 'modbus';
    }

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

  return {
    cloudUrl,
    namespace: '/edge',
    companyId: String(companyId),
    gatewayId: String(gateway._id),
    gatewayName: gateway.name,
    apiKey: rawKey || '<PASTE_YOUR_API_KEY_HERE>',
    plcs: plcConfigArray,
    generatedAt: new Date().toISOString(),
  };
};

const forceDisconnectGatewaySocket = (req, gatewayId) => {
  try {
    const io = req.app.get('io');
    const gatewayInfo = edgeService.gateways.get(String(gatewayId));
    if (gatewayInfo && gatewayInfo.socketId && io) {
      const socket = io.of('/edge').sockets.get(gatewayInfo.socketId);
      if (socket) socket.disconnect(true);
    }
  } catch (err) { }
};

// ─── GET ALL GATEWAYS ───────────────────────────────
const getGateways = async (req, res) => {
  try {
    const gateways = await EdgeGateway.find({ companyId: req.companyId }).sort({ createdAt: -1 });
    const activeGateways = gateways.map((gw) => {
      const isLiveOnline = edgeService.hasActiveGateway(req.companyId) && edgeService.gateways.has(gw._id.toString());
      return {
        ...gw.toObject(),
        status: isLiveOnline ? 'online' : (gw.status === 'never_connected' ? 'never_connected' : 'offline'),
      };
    });
    res.json({ success: true, count: gateways.length, data: activeGateways });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ─── GET SINGLE GATEWAY ─────────────────────────────
const getGateway = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) return res.status(404).json({ success: false, message: 'Gateway not found' });
    const isLiveOnline = edgeService.gateways.has(gateway._id.toString());
    res.json({
      success: true,
      data: {
        ...gateway.toObject(),
        status: isLiveOnline ? 'online' : (gateway.status === 'never_connected' ? 'never_connected' : 'offline'),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ─── CREATE GATEWAY ─────────────────────────────────
const createGateway = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Gateway name is required' });

    const currentCount = await EdgeGateway.countDocuments({ companyId: req.companyId });
    const maxGateways = req.company?.limits?.maxGateways || 1;
    if (currentCount >= maxGateways) {
      return res.status(403).json({
        success: false,
        message: `Plan limit reached: ${currentCount}/${maxGateways} Gateways.`,
        code: 'PLAN_LIMIT_EXCEEDED',
      });
    }

    const exists = await EdgeGateway.findOne({ companyId: req.companyId, name: name.trim() });
    if (exists) return res.status(400).json({ success: false, message: 'Gateway name already exists' });

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
      message: 'Gateway created. Save the API key now.',
      data: {
        _id: gateway._id,
        name: gateway.name,
        apiKey: rawKey,
        apiKeyPrefix: gateway.apiKeyPrefix,
        status: gateway.status,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ─── UPDATE GATEWAY ─────────────────────────────────
const updateGateway = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Gateway name is required' });

    const duplicate = await EdgeGateway.findOne({
      companyId: req.companyId,
      name: name.trim(),
      _id: { $ne: req.params.id },
    });
    if (duplicate) return res.status(400).json({ success: false, message: 'Name already in use' });

    const gateway = await EdgeGateway.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { name: name.trim() },
      { new: true, runValidators: true }
    );
    if (!gateway) return res.status(404).json({ success: false, message: 'Gateway not found' });

    res.json({ success: true, message: 'Gateway updated', data: gateway });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ─── REGENERATE API KEY ─────────────────────────────
const regenerateApiKey = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) return res.status(404).json({ success: false, message: 'Gateway not found' });

    forceDisconnectGatewaySocket(req, gateway._id);
    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
    gateway.apiKeyHash = hash;
    gateway.apiKeyPrefix = prefix;
    gateway.status = 'never_connected';
    await gateway.save();

    res.json({
      success: true,
      message: 'API Key rotated',
      data: {
        _id: gateway._id,
        name: gateway.name,
        apiKey: rawKey,
        apiKeyPrefix: gateway.apiKeyPrefix,
        status: gateway.status,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ─── DOWNLOAD JSON CONFIG ONLY ──────────────────────
const downloadGatewayConfig = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) return res.status(404).json({ success: false, message: 'Gateway not found' });

    const { apiKey } = req.query;
    const configProfile = await compileGatewayConfig(req.companyId, gateway, apiKey);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="config.json"`);
    res.send(JSON.stringify(configProfile, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// 🆕 DOWNLOAD READY-TO-RUN PACKAGE (ZIP with embedded config)
// ═══════════════════════════════════════════════════════════
const downloadCompletePackage = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) return res.status(404).json({ success: false, message: 'Gateway not found' });

    // Rotate API key so user always gets fresh key in bundle
    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();

    // Force disconnect any existing session (old key invalidated)
    forceDisconnectGatewaySocket(req, gateway._id);

    gateway.apiKeyHash = hash;
    gateway.apiKeyPrefix = prefix;
    gateway.status = 'never_connected';
    await gateway.save();

    // Compile config with the fresh key
    const configProfile = await compileGatewayConfig(req.companyId, gateway, rawKey);

    // Locate template folder
    const templateDir = path.join(__dirname, '..', '..', 'edge-gateway-template');
    if (!fs.existsSync(templateDir)) {
      return res.status(500).json({
        success: false,
        message: 'Gateway template files missing on server. Contact support.',
      });
    }

    // Build filename
    const companyName = String(req.company?.slug || 'company').replace(/[^a-z0-9\-]/gi, '');
    const filename = `OnlineSCADA-Gateway-${companyName}.zip`;

    // Setup response headers for streaming ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('❌ Archive error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'ZIP generation failed' });
      }
    });

    archive.pipe(res);

    // 1. Add ALL template files
    archive.directory(templateDir, false);

    // 2. Add the pre-embedded config.json (with real API key + all PLCs)
    archive.append(JSON.stringify(configProfile, null, 2), { name: 'config.json' });

    await archive.finalize();

    console.log(`📦 Gateway package generated: ${filename} (${configProfile.plcs.length} PLCs)`);
  } catch (error) {
    console.error('❌ downloadCompletePackage error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
  }
};

// ─── DELETE GATEWAY ─────────────────────────────────
const deleteGateway = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) return res.status(404).json({ success: false, message: 'Gateway not found' });

    forceDisconnectGatewaySocket(req, gateway._id);
    await EdgeGateway.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });

    res.json({ success: true, message: `Gateway "${gateway.name}" deleted.` });
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
  downloadCompletePackage,
  deleteGateway,
};