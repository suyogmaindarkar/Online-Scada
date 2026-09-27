// ═══════════════════════════════════════════════════════════
// PLC Controller — Edge Integration Fixes
// ═══════════════════════════════════════════════════════════

const plcManager = require('../services/plcManager');
const simulationService = require('../services/simulationService');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');
const edgeService = require('../services/edgeService');
const { broadcastConfigUpdate } = require('../services/edgeConfigBroadcaster');

// ─── Helper: Check if PLC is Live (Handles 0 Tags) ───
const isPlcLiveFromEdge = async (plc, companyId) => {
  if (plc.isSimulation) return plc.isConnected;
  if (!edgeService.hasActiveGateway(String(companyId))) return false;

  const tagCount = await Tag.countDocuments({ companyId, plcConnection: plc._id });
  
  // If there are 0 tags, we trust the DB's isConnected flag updated by the gateway heartbeat
  if (tagCount === 0) {
      return plc.isConnected;
  }

  // If there are tags, ensure telemetry is fresh
  const freshTag = await Tag.findOne({
    companyId,
    plcConnection: plc._id,
    lastUpdated: { $gte: new Date(Date.now() - 15000) },
  });
  return !!freshTag;
};

const csvEscape = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const parseCSVLine = (line) => {
  const result = []; let current = ''; let inQuotes = false; let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i += 2; }
      else if (ch === '"') { inQuotes = false; i++; }
      else { current += ch; i++; }
    } else {
      if (ch === '"' && current === '') { inQuotes = true; i++; }
      else if (ch === ',') { result.push(current); current = ''; i++; }
      else { current += ch; i++; }
    }
  }
  result.push(current);
  return result.map(s => s.trim());
};

const parseCSV = (csvText) => {
  const normalized = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter(line => line.trim().length > 0 && !line.trim().startsWith('#'));
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const cells = parseCSVLine(line); const row = {};
    headers.forEach((header, idx) => row[header] = cells[idx] !== undefined ? cells[idx] : '');
    return row;
  });
  return { headers, rows };
};

const checkPLCLimit = async (req) => {
  const currentCount = await PLCConnection.countDocuments({ companyId: req.companyId });
  const maxPLCs = req.company?.limits?.maxPLCs || 999;
  if (currentCount >= maxPLCs) return { exceeded: true, current: currentCount, max: maxPLCs, message: `Plan limit reached: ${currentCount}/${maxPLCs} PLCs. Upgrade your plan to add more.` };
  return { exceeded: false };
};

const createPLC = async (req, res) => {
  try {
    const { name, description, protocol, ipAddress, port, rack, slot, brand, model, pollingRate, opcuaUsername, opcuaPassword } = req.body;
    if (!name || !protocol) return res.status(400).json({ success: false, message: 'Name and protocol are required' });

    const limitCheck = await checkPLCLimit(req);
    if (limitCheck.exceeded) return res.status(403).json({ success: false, message: limitCheck.message, code: 'PLAN_LIMIT_EXCEEDED' });

    const exists = await PLCConnection.findOne({ companyId: req.companyId, name });
    if (exists) return res.status(400).json({ success: false, message: 'PLC with this name already exists in this workspace' });

    let defaultPort = 502;
    if (protocol === 'S7') defaultPort = 102;
    if (protocol === 'OPC_UA') defaultPort = 4840;
    if (protocol === 'ETHERNET_IP') defaultPort = 44818;

    const plc = await PLCConnection.create({
      companyId: req.companyId, name, description: description || '', protocol,
      ipAddress: ipAddress || '192.168.1.100', port: port || defaultPort, rack: rack || 0, slot: slot || 1,
      brand: brand || 'OTHER', model: model || '', pollingRate: pollingRate || 1000,
      opcuaUsername: opcuaUsername || '', opcuaPassword: opcuaPassword || '', isActive: true,
    });

    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) {}

    res.status(201).json({ success: true, message: 'PLC created successfully', data: plc });
  } catch (error) { res.status(500).json({ success: false, message: 'Server Error', error: error.message }); }
};

const createQuickSimulationPLC = async (req, res) => {
  res.status(400).json({ success: false, message: 'Simulation Quick Create is disabled.' });
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
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });
    const tagCount = await Tag.countDocuments({ companyId: req.companyId, plcConnection: plc._id });
    const liveConnected = await isPlcLiveFromEdge(plc, req.companyId);
    res.json({ success: true, data: { ...plc.toObject(), tagCount, isConnected: liveConnected } });
  } catch (error) { res.status(500).json({ success: false, message: 'Server Error', error: error.message }); }
};

const updatePLC = async (req, res) => {
  try {
    delete req.body.companyId;
    const plc = await PLCConnection.findOneAndUpdate({ _id: req.params.id, companyId: req.companyId }, req.body, { new: true, runValidators: true });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });
    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) {}
    res.json({ success: true, message: 'PLC updated successfully', data: plc });
  } catch (error) { res.status(500).json({ success: false, message: 'Server Error', error: error.message }); }
};

const deletePLC = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });

    try { await plcManager.stop(plc._id); } catch { }

    if (plc.isSimulation) {
      await Tag.deleteMany({ companyId: req.companyId, plcConnection: plc._id, isSimulationTag: true });
    } else {
      const tagCount = await Tag.countDocuments({ companyId: req.companyId, plcConnection: plc._id });
      if (tagCount > 0) return res.status(400).json({ success: false, message: `Cannot delete PLC. It has ${tagCount} associated tags. Delete tags first.` });
    }

    await PLCConnection.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) {}
    res.json({ success: true, message: plc.isSimulation ? `Simulation PLC deleted` : 'PLC deleted successfully' });
  } catch (error) { res.status(500).json({ success: false, message: 'Server Error', error: error.message }); }
};

const testPLCConnection = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });

    if (plc.protocol === 'SIMULATION') {
      plc.isConnected = true; plc.lastConnected = Date.now(); await plc.save();
      return res.json({ success: true, message: 'Connection successful', data: { connected: true } });
    }

    // ⭐ FIX: If Edge Gateway is online, the test is handled dynamically via the edge heartbeat. 
    // Trying to ping an internal 192.168.X.X IP from the cloud server will always fail.
    if (edgeService.hasActiveGateway(req.companyId)) {
        return res.json({ 
            success: true, 
            message: plc.isConnected ? 'Connection verified via Factory Connector' : 'Factory Connector is attempting to connect...',
            data: { connected: plc.isConnected } 
        });
    }

    let service;
    switch (plc.protocol) {
      case 'S7': service = require('../services/s7Service'); break;
      case 'MODBUS_TCP':
      case 'MODBUS_RTU': service = require('../services/modbusService'); break;
      case 'OPC_UA': service = require('../services/opcuaService'); break;
      default: return res.json({ success: false, message: `Test not supported` });
    }

    const result = await service.test(plc);
    if (result.success) {
      plc.isConnected = true; plc.lastConnected = Date.now(); await plc.save();
      return res.json({ success: true, message: `Test successful`, data: { connected: true } });
    } else {
      return res.json({ success: false, message: `Test failed: ${result.error}`, data: { connected: false, error: result.error } });
    }
  } catch (error) { res.status(500).json({ success: false, message: 'Server Error', error: error.message }); }
};

const startPLC = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });
    plc.isActive = true; await plc.save();
    const result = await plcManager.start(req.params.id);
    if (result?.deferred) {
      try {
        const io = req.app.get('io');
        await broadcastConfigUpdate(io, req.companyId);
      } catch (e) {}
      return res.json({ success: true, message: `PLC is active. Data streams via Factory Connector.`, deferred: true });
    }
    res.json(result);
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const stopPLC = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });
    plc.isActive = false; plc.isConnected = false; await plc.save();
    await plcManager.stop(req.params.id);
    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) {}
    res.json({ success: true, message: `PLC "${plc.name}" stopped.` });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getPLCStatus = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found' });
    const isRunning = plcManager.isRunning(plc._id, plc.protocol);
    const liveConnected = await isPlcLiveFromEdge(plc, req.companyId);
    res.json({ success: true, data: { plcId: plc._id, name: plc.name, protocol: plc.protocol, isConnected: liveConnected, isRunning, isSimulation: plc.isSimulation } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const exportPLCsCSV = async (req, res) => { /* Omitted for brevity */ };
const downloadPLCTemplate = async (req, res) => { /* Omitted for brevity */ };
const importPLCsCSV = async (req, res) => { /* Omitted for brevity */ };

module.exports = { createPLC, createQuickSimulationPLC, getAllPLCs, getPLC, updatePLC, deletePLC, testPLCConnection, startPLC, stopPLC, getPLCStatus, exportPLCsCSV, importPLCsCSV, downloadPLCTemplate };