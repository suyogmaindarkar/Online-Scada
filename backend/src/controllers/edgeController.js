// ═══════════════════════════════════════════════════════════
// Edge Gateway Controller — Dynamic File Compiler
// ═══════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const archiverPkg = require('archiver');
const EdgeGateway = require('../models/EdgeGateway');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');
const edgeService = require('../services/edgeService');

const createArchive = (format = 'zip', options = {}) => {
  if (typeof archiverPkg === 'function') return archiverPkg(format, options);
  if (archiverPkg && typeof archiverPkg.default === 'function') return archiverPkg.default(format, options);
  if (archiverPkg && typeof archiverPkg.create === 'function') return archiverPkg.create(format, options);
  if (format === 'zip' && archiverPkg && typeof archiverPkg.ZipArchive === 'function') return new archiverPkg.ZipArchive(options);
  if (archiverPkg && typeof archiverPkg.Archiver === 'function') return new archiverPkg.Archiver(format, options);
  throw new Error('Unable to initialize archiver');
};

const compileGatewayConfig = async (companyId, gateway, rawKey = null) => {
  // Fix 1: Removed restrictive 'isActive' filters that could accidentally block PLCs
  const plcs = await PLCConnection.find({ companyId, isSimulation: { $ne: true } });
  const plcConfigArray = [];

  for (const plc of plcs) {
    const tags = await Tag.find({ companyId, plcConnection: plc._id });

    // Fix 2: We no longer skip PLCs with 0 tags. 
    // We send them anyway so the Gateway can establish a connection and report "ONLINE" status!

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
        // Fix 3: Bulletproof schema mapping. Covers every common database field name.
        address: t.address || t.plcAddress || t.register || t.nodeId || '',
        dataType: t.dataType || 'INT',
      })),
    });
  }

  return {
    cloudUrl: process.env.CLOUD_PUBLIC_URL || 'https://onlinescada-api.onrender.com',
    namespace: '/edge',
    companyId: String(companyId),
    gatewayId: String(gateway._id),
    gatewayName: gateway.name,
    apiKey: rawKey || '<PASTE_YOUR_API_KEY_HERE>',
    plcs: plcConfigArray,
  };
};

const forceDisconnectGatewaySocket = (req, gatewayId) => {
  try {
    const io = req.app.get('io');
    const gatewayInfo = edgeService.gateways.get(String(gatewayId));
    if (gatewayInfo && gatewayInfo.socketId && io) io.of('/edge').sockets.get(gatewayInfo.socketId)?.disconnect(true);
  } catch (err) { }
};

const getGateways = async (req, res) => {
  try {
    let gateways = await EdgeGateway.find({ companyId: req.companyId }).sort({ createdAt: -1 });
    if (gateways.length === 0) {
      const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
      const autoGateway = await EdgeGateway.create({
        companyId: req.companyId, name: 'Factory Connector', apiKeyHash: hash, apiKeyPrefix: prefix, status: 'never_connected',
      });
      gateways = [autoGateway];
    }
    const activeGateways = gateways.map((gw) => {
      const isLiveOnline = edgeService.hasActiveGateway(req.companyId) && edgeService.gateways.has(gw._id.toString());
      return { ...gw.toObject(), status: isLiveOnline ? 'online' : (gw.status === 'never_connected' ? 'never_connected' : 'offline') };
    });
    res.json({ success: true, count: gateways.length, data: activeGateways });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getGateway = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: { ...gateway.toObject(), status: edgeService.gateways.has(gateway._id.toString()) ? 'online' : 'offline' } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const createGateway = async (req, res) => {
  try {
    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
    const gateway = await EdgeGateway.create({ companyId: req.companyId, name: req.body.name || 'Connector', apiKeyHash: hash, apiKeyPrefix: prefix, status: 'never_connected' });
    res.status(201).json({ success: true, data: gateway });
  } catch (e) { res.status(500).json({ success: false }); }
};

const updateGateway = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOneAndUpdate({ _id: req.params.id, companyId: req.companyId }, { name: req.body.name }, { new: true });
    res.json({ success: true, data: gateway });
  } catch (e) { res.status(500).json({ success: false }); }
};

const regenerateApiKey = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    forceDisconnectGatewaySocket(req, gateway._id);
    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
    gateway.apiKeyHash = hash; gateway.apiKeyPrefix = prefix; gateway.status = 'never_connected'; await gateway.save();
    res.json({ success: true, data: gateway });
  } catch (e) { res.status(500).json({ success: false }); }
};

const downloadGatewayConfig = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    const configProfile = await compileGatewayConfig(req.companyId, gateway, req.query.apiKey);
    res.setHeader('Content-Type', 'application/json'); res.send(JSON.stringify(configProfile, null, 2));
  } catch (e) { res.status(500).send(); }
};

// ─── DOWNLOAD READY PACKAGE (DYNAMIC FILE COMPILER) ───
const downloadCompletePackage = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!gateway) return res.status(404).json({ success: false, message: 'Not found' });

    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
    forceDisconnectGatewaySocket(req, gateway._id);
    gateway.apiKeyHash = hash; gateway.apiKeyPrefix = prefix; gateway.status = 'never_connected';
    await gateway.save();

    const configProfile = await compileGatewayConfig(req.companyId, gateway, rawKey);
    const companyName = String(req.company?.slug || 'company').replace(/[^a-z0-9\-]/gi, '');
    const filename = `OnlineSCADA-Connector-${companyName}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = createArchive('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => { if (!res.headersSent) res.status(500).json({ success: false, message: err.message }); });
    archive.pipe(res);

    const templateDir = path.join(__dirname, '../../edge-gateway-template');

    if (!fs.existsSync(templateDir)) {
      throw new Error(`Template directory not found on server at: ${templateDir}`);
    }

    const filesToInclude = [
      'package.json', 'Start.bat', 'Run-In-Background.vbs', 'README.txt',
      'src/index.js', 'src/cloudBridge.js', 'src/plcReader.js', 'src/healthMonitor.js',
      'src/readers/s7Reader.js', 'src/readers/modbusReader.js',
      'src/readers/opcuaReader.js', 'src/readers/ethernetIpReader.js'
    ];

    for (const file of filesToInclude) {
      const fullPath = path.join(templateDir, file);
      if (fs.existsSync(fullPath)) {
        archive.file(fullPath, { name: file });
      } else {
        console.warn(`[WARNING] Missing template file: ${file}`);
      }
    }

    archive.append(JSON.stringify(configProfile, null, 2), { name: 'config.json' });

    await archive.finalize();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ success: false, message: error.message });
  }
};

const deleteGateway = async (req, res) => {
  try {
    const gateway = await EdgeGateway.findOne({ _id: req.params.id, companyId: req.companyId });
    forceDisconnectGatewaySocket(req, gateway._id);
    await EdgeGateway.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    res.json({ success: true, message: `Deleted.` });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = { getGateways, getGateway, createGateway, updateGateway, regenerateApiKey, downloadGatewayConfig, downloadCompletePackage, deleteGateway };