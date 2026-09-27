// ═══════════════════════════════════════════════════════════
// PLC Controller — Bulletproof Edge Sync & Fixed Testing
// ═══════════════════════════════════════════════════════════

const plcManager = require('../services/plcManager');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');
const edgeService = require('../services/edgeService');

// ─── INTERNAL HOT-RELOAD SYNC ENGINE ───
const compileAndBroadcastConfig = async (req) => {
  try {
    const companyId = req.companyId;
    const io = req.app.get('io');
    if (!io) return;

    const plcs = await PLCConnection.find({ companyId, isSimulation: { $ne: true } });
    const plcConfigArray = [];

    for (const plc of plcs) {
      const tags = await Tag.find({ companyId, plcConnection: plc._id });
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
        tags: tags.map(t => ({
          tagId: t._id.toString(),
          tagName: t.tagName,
          address: t.address || t.plcAddress || t.register || t.nodeId || '',
          dataType: t.dataType || 'INT'
        }))
      });
    }

    io.of('/edge').to(`company:${companyId}`).emit('edge:configUpdate', { plcs: plcConfigArray });
  } catch (e) {
    console.error('Config broadcast failed:', e.message);
  }
};

const isPlcLiveFromEdge = async (plc, companyId) => {
  if (plc.isSimulation) return plc.isConnected;
  if (!edgeService.hasActiveGateway(String(companyId))) return false;
  const tagCount = await Tag.countDocuments({ companyId, plcConnection: plc._id });
  if (tagCount === 0) return plc.isConnected; // Trust Gateway's heartbeat if no tags

  const freshTag = await Tag.findOne({ companyId, plcConnection: plc._id, lastUpdated: { $gte: new Date(Date.now() - 15000) } });
  return !!freshTag;
};

const checkPLCLimit = async (req) => {
  const currentCount = await PLCConnection.countDocuments({ companyId: req.companyId });
  const maxPLCs = req.company?.limits?.maxPLCs || 999;
  if (currentCount >= maxPLCs) return { exceeded: true, message: `Plan limit reached: ${currentCount}/${maxPLCs} PLCs.` };
  return { exceeded: false };
};

const createPLC = async (req, res) => {
  try {
    const { name, description, protocol, ipAddress, port, rack, slot, brand, model, pollingRate, opcuaUsername, opcuaPassword } = req.body;
    if (!name || !protocol) return res.status(400).json({ success: false, message: 'Name and protocol are required' });

    const limitCheck = await checkPLCLimit(req);
    if (limitCheck.exceeded) return res.status(403).json({ success: false, message: limitCheck.message });

    const exists = await PLCConnection.findOne({ companyId: req.companyId, name });
    if (exists) return res.status(400).json({ success: false, message: 'Machine with this name already exists' });

    let defaultPort = 502;
    if (protocol === 'S7') defaultPort = 102;
    if (protocol === 'OPC_UA') defaultPort = 4840;
    if (protocol === 'ETHERNET_IP') defaultPort = 44818;

    const plc = await PLCConnection.create({
      companyId: req.companyId, name, description: description || '', protocol,
      ipAddress: ipAddress || '192.168.1.100', port: port || defaultPort, rack: rack || 0, slot: slot || 1,
      brand: brand || 'OTHER', model: model || '', pollingRate: pollingRate || 1000,
      opcuaUsername: opcuaUsername || '', opcuaPassword: opcuaPassword || '',
      isActive: true,
      isSimulation: false // Force false so gateway syncs it
    });

    await compileAndBroadcastConfig(req); // Sync to gateway instantly
    res.status(201).json({ success: true, message: 'Equipment created successfully', data: plc });
  } catch (error) { res.status(500).json({ success: false, message: 'Server Error', error: error.message }); }
};

const createQuickSimulationPLC = async (req, res) => {
  res.status(400).json({ success: false, message: 'Auto-Simulation is intentionally disabled.' });
};

const getAllPLCs = async (req, res) => {
  try {
    const plcs = await PLCConnection.find({ companyId: req.companyId }).sort({ createdAt: -1 });
    const plcsWithCount = await Promise.all(
      plcs.map(async (plc) => {
        const tagCount = await Tag.countDocuments({ companyId: req.companyId, plcConnection: plc._id });
        const liveConnected = await isPlcLiveFromEdge(plc, req.companyId);
        return { ...plc.toObject(), tagCount, isConnected: liveConnected };
      })
    );
    res.json({ success: true, count: plcs.length, data: plcsWithCount });
  } catch (error) { res.status(500).json({ success: false, message: 'Server Error', error: error.message }); }
};

const getPLC = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'Not found' });
    const tagCount = await Tag.countDocuments({ companyId: req.companyId, plcConnection: plc._id });
    const liveConnected = await isPlcLiveFromEdge(plc, req.companyId);
    res.json({ success: true, data: { ...plc.toObject(), tagCount, isConnected: liveConnected } });
  } catch (error) { res.status(500).json({ success: false, message: 'Server Error', error: error.message }); }
};

const updatePLC = async (req, res) => {
  try {
    delete req.body.companyId;
    const plc = await PLCConnection.findOneAndUpdate({ _id: req.params.id, companyId: req.companyId }, req.body, { new: true });
    if (!plc) return res.status(404).json({ success: false, message: 'Not found' });

    await compileAndBroadcastConfig(req); // Sync to gateway instantly
    res.json({ success: true, message: 'Equipment updated successfully', data: plc });
  } catch (error) { res.status(500).json({ success: false, message: 'Server Error', error: error.message }); }
};

const deletePLC = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'Not found' });

    const tagCount = await Tag.countDocuments({ companyId: req.companyId, plcConnection: plc._id });
    if (tagCount > 0) return res.status(400).json({ success: false, message: `Delete ${tagCount} tags first.` });

    await PLCConnection.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    await compileAndBroadcastConfig(req); // Sync to gateway instantly
    res.json({ success: true, message: 'Equipment deleted' });
  } catch (error) { res.status(500).json({ success: false, message: 'Server Error', error: error.message }); }
};

const testPLCConnection = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'Equipment not found' });

    if (edgeService.hasActiveGateway(String(req.companyId))) {
      return res.json({
        success: true,
        message: plc.isConnected ? 'Connection verified via Factory Connector' : 'Connector is attempting communication...',
        data: { connected: plc.isConnected }
      });
    }

    return res.json({ success: true, message: 'Ping deferred. Factory Connector is currently offline.', data: { connected: false } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

const startPLC = async (req, res) => res.json({ success: true, message: `System active` });
const stopPLC = async (req, res) => res.json({ success: true, message: `System paused` });
const getPLCStatus = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false });
    const liveConnected = await isPlcLiveFromEdge(plc, req.companyId);
    res.json({ success: true, data: { isConnected: liveConnected } });
  } catch (error) { res.status(500).json({ success: false }); }
};

module.exports = { createPLC, createQuickSimulationPLC, getAllPLCs, getPLC, updatePLC, deletePLC, testPLCConnection, startPLC, stopPLC, getPLCStatus };