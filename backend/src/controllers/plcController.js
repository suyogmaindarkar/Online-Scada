// ═══════════════════════════════════════════════════════════
// PLC Controller — Multi-Tenant Update (With Edge Integration)
//
// ✅ All queries scoped by req.companyId
// ✅ All creates include companyId
// ✅ Plan limit enforcement (maxPLCs)
// ✅ Live Edge Gateway status integrated into getAllPLCs
// ═══════════════════════════════════════════════════════════

const plcManager = require('../services/plcManager');
const simulationService = require('../services/simulationService');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');
const edgeService = require('../services/edgeService'); // 🟢 Edge Integration
const { broadcastConfigUpdate } = require('../services/edgeConfigBroadcaster');

// ─── Helper: Check if PLC has fresh data from Edge (last 15s) ───
const isPlcLiveFromEdge = async (plc, companyId) => {
  if (plc.isSimulation) return plc.isConnected;
  if (!edgeService.hasActiveGateway(String(companyId))) return false;

  const freshTag = await Tag.findOne({
    companyId,
    plcConnection: plc._id,
    lastUpdated: { $gte: new Date(Date.now() - 15000) },
  });
  return !!freshTag;
};

// ─────────────────────────────────────────────────────────
// CSV UTILITIES
// ─────────────────────────────────────────────────────────
const csvEscape = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
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
  const lines = normalized.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith('#');
  });
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const cells = parseCSVLine(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx] !== undefined ? cells[idx] : '';
    });
    return row;
  });
  return { headers, rows };
};

// ─── Helpers ───
const getNextSimIP = async (companyId) => {
  const existingSimPLCs = await PLCConnection.find({ companyId, isSimulation: true }).select('ipAddress');
  const usedIPs = new Set(existingSimPLCs.map(p => p.ipAddress));
  for (let i = 100; i <= 199; i++) {
    const candidate = `10.0.0.${i}`;
    if (!usedIPs.has(candidate)) return candidate;
  }
  return `10.0.0.${100 + Math.floor(Math.random() * 100)}`;
};

const getNextSimPrefix = async (companyId) => {
  const existingPrefixes = await PLCConnection.find({ companyId, isSimulation: true }).select('simulationPrefix');
  const used = new Set(existingPrefixes.map(p => p.simulationPrefix));
  if (!used.has('SIM_')) return 'SIM_';
  for (let i = 2; i <= 20; i++) {
    const candidate = `SIM${i}_`;
    if (!used.has(candidate)) return candidate;
  }
  return `SIM${Date.now()}_`;
};

const getNextSimName = async (companyId) => {
  const existingNames = await PLCConnection.find({ companyId, isSimulation: true }).select('name');
  const used = new Set(existingNames.map(p => p.name));
  if (!used.has('Demo PLC')) return 'Demo PLC';
  for (let i = 2; i <= 20; i++) {
    const candidate = `Demo PLC ${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `Demo PLC ${Date.now()}`;
};

const checkPLCLimit = async (req) => {
  const currentCount = await PLCConnection.countDocuments({ companyId: req.companyId });
  const maxPLCs = req.company?.limits?.maxPLCs || 999;
  if (currentCount >= maxPLCs) {
    return {
      exceeded: true,
      current: currentCount,
      max: maxPLCs,
      message: `Plan limit reached: ${currentCount}/${maxPLCs} PLCs. Upgrade your plan to add more.`,
    };
  }
  return { exceeded: false };
};

// ═══════════════════════════════════════════════════════════
// CREATE PLC
// ═══════════════════════════════════════════════════════════
const createPLC = async (req, res) => {
  try {
    const {
      name, description, protocol, ipAddress, port,
      rack, slot, brand, model, pollingRate,
      opcuaUsername, opcuaPassword,
    } = req.body;

    if (!name || !protocol) {
      return res.status(400).json({ success: false, message: 'Name and protocol are required' });
    }

    const limitCheck = await checkPLCLimit(req);
    if (limitCheck.exceeded) {
      return res.status(403).json({ success: false, message: limitCheck.message, code: 'PLAN_LIMIT_EXCEEDED' });
    }

    const exists = await PLCConnection.findOne({ companyId: req.companyId, name });
    if (exists) {
      return res.status(400).json({ success: false, message: 'PLC with this name already exists in this workspace' });
    }

    let defaultPort = 502;
    if (protocol === 'S7') defaultPort = 102;
    if (protocol === 'OPC_UA') defaultPort = 4840;
    if (protocol === 'ETHERNET_IP') defaultPort = 44818;

    const plc = await PLCConnection.create({
      companyId: req.companyId,
      name,
      description: description || '',
      protocol,
      ipAddress: ipAddress || '192.168.1.100',
      port: port || defaultPort,
      rack: rack || 0,
      slot: slot || 1,
      brand: brand || 'OTHER',
      model: model || '',
      pollingRate: pollingRate || 1000,
      opcuaUsername: opcuaUsername || '',
      opcuaPassword: opcuaPassword || '',
      isActive: true, // Auto-active for Edge Gateway
    });

    // Notify Edge Gateway of config change
    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) {}

    res.status(201).json({ success: true, message: 'PLC created successfully', data: plc });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// QUICK-CREATE Simulation PLC
// ═══════════════════════════════════════════════════════════
const createQuickSimulationPLC = async (req, res) => {
  try {
    const limitCheck = await checkPLCLimit(req);
    if (limitCheck.exceeded) {
      return res.status(403).json({ success: false, message: limitCheck.message, code: 'PLAN_LIMIT_EXCEEDED' });
    }

    const name = await getNextSimName(req.companyId);
    const ipAddress = await getNextSimIP(req.companyId);
    const simulationPrefix = await getNextSimPrefix(req.companyId);

    const plc = await PLCConnection.create({
      companyId: req.companyId,
      name,
      description: `Auto-generated simulation PLC with 5 demo tags`,
      protocol: 'SIMULATION',
      ipAddress,
      port: 502,
      brand: 'SIMULATION',
      model: 'Virtual PLC',
      pollingRate: 1000,
      isActive: true,
      isSimulation: true,
      simulationPrefix,
    });

    try { await plcManager.start(plc._id); } catch (startErr) { }

    const updated = await PLCConnection.findOne({ _id: plc._id, companyId: req.companyId });
    const tagCount = await Tag.countDocuments({ companyId: req.companyId, plcConnection: plc._id });

    res.status(201).json({
      success: true,
      message: `Simulation PLC "${name}" created with ${tagCount} auto-generated tags`,
      data: { ...updated.toObject(), tagCount },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create simulation PLC', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// GET ALL PLCs (scoped to company + live edge status)
// ═══════════════════════════════════════════════════════════
const getAllPLCs = async (req, res) => {
  try {
    const plcs = await PLCConnection.find({ companyId: req.companyId }).sort({ createdAt: -1 });

    const plcsWithCount = await Promise.all(
      plcs.map(async (plc) => {
        const tagCount = await Tag.countDocuments({ companyId: req.companyId, plcConnection: plc._id });
        const liveConnected = await isPlcLiveFromEdge(plc, req.companyId);
        return {
          ...plc.toObject(),
          tagCount,
          isConnected: liveConnected || plc.isConnected,
        };
      })
    );

    res.json({ success: true, count: plcs.length, data: plcsWithCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// GET SINGLE PLC
// ═══════════════════════════════════════════════════════════
const getPLC = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });
    const tagCount = await Tag.countDocuments({ companyId: req.companyId, plcConnection: plc._id });
    const liveConnected = await isPlcLiveFromEdge(plc, req.companyId);

    res.json({ success: true, data: { ...plc.toObject(), tagCount, isConnected: liveConnected || plc.isConnected } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// UPDATE PLC
// ═══════════════════════════════════════════════════════════
const updatePLC = async (req, res) => {
  try {
    delete req.body.companyId;
    const plc = await PLCConnection.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });

    // Notify Edge Gateway
    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) {}

    res.json({ success: true, message: 'PLC updated successfully', data: plc });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// DELETE PLC
// ═══════════════════════════════════════════════════════════
const deletePLC = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });

    try { await plcManager.stop(plc._id); } catch { }

    if (plc.isSimulation) {
      await Tag.deleteMany({ companyId: req.companyId, plcConnection: plc._id, isSimulationTag: true });
    } else {
      const tagCount = await Tag.countDocuments({ companyId: req.companyId, plcConnection: plc._id });
      if (tagCount > 0) {
        return res.status(400).json({ success: false, message: `Cannot delete PLC. It has ${tagCount} associated tags. Delete tags first.` });
      }
    }

    await PLCConnection.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });

    // Notify Edge Gateway
    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) {}

    res.json({ success: true, message: plc.isSimulation ? `Simulation PLC deleted` : 'PLC deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// TEST PLC CONNECTION
// ═══════════════════════════════════════════════════════════
const testPLCConnection = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });

    if (plc.protocol === 'SIMULATION') {
      plc.isConnected = true; plc.lastConnected = Date.now(); await plc.save();
      return res.json({ success: true, message: 'Connection successful', data: { connected: true } });
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
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// START / STOP / STATUS
// ═══════════════════════════════════════════════════════════
const startPLC = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });

    plc.isActive = true;
    await plc.save();

    const result = await plcManager.start(req.params.id);

    if (result?.deferred) {
      try {
        const io = req.app.get('io');
        await broadcastConfigUpdate(io, req.companyId);
      } catch (e) {}
      return res.json({ success: true, message: `PLC is active. Data streams via Edge Gateway.`, deferred: true });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const stopPLC = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });

    plc.isActive = false;
    plc.isConnected = false;
    await plc.save();

    const result = await plcManager.stop(req.params.id);

    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) {}

    res.json({ success: true, message: `PLC "${plc.name}" stopped.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPLCStatus = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found' });

    const isRunning = plcManager.isRunning(plc._id, plc.protocol);
    const liveConnected = await isPlcLiveFromEdge(plc, req.companyId);

    res.json({
      success: true,
      data: {
        plcId: plc._id,
        name: plc.name,
        protocol: plc.protocol,
        isConnected: liveConnected || plc.isConnected,
        isRunning,
        isSimulation: plc.isSimulation,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// EXPORT / IMPORT CSV (Unchanged)
// ═══════════════════════════════════════════════════════════
const exportPLCsCSV = async (req, res) => {
  // Same logic as before...
  try {
    const plcs = await PLCConnection.find({ companyId: req.companyId, isSimulation: { $ne: true } }).sort({ name: 1 });
    const headers = ['name', 'description', 'protocol', 'ipAddress', 'port', 'rack', 'slot', 'brand', 'model', 'pollingRate', 'isActive', 'opcuaUsername', 'opcuaPassword'];
    let csv = `# OnlineSCADA PLC Export\n# Workspace: ${req.company?.slug || 'unknown'}\n# Generated: ${new Date().toISOString()}\n# Total PLCs: ${plcs.length}\n#\n\n${headers.join(',')}\n`;
    plcs.forEach(plc => {
      csv += [csvEscape(plc.name), csvEscape(plc.description || ''), csvEscape(plc.protocol), csvEscape(plc.ipAddress), csvEscape(plc.port), csvEscape(plc.rack ?? 0), csvEscape(plc.slot ?? 1), csvEscape(plc.brand || 'OTHER'), csvEscape(plc.model || ''), csvEscape(plc.pollingRate ?? 1000), csvEscape(plc.isActive ? 'true' : 'false'), csvEscape(plc.opcuaUsername || ''), csvEscape(plc.opcuaPassword || '')].join(',') + '\n';
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="plcs_export_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to export PLCs', error: error.message }); }
};

const downloadPLCTemplate = async (req, res) => {
  const headers = ['name', 'description', 'protocol', 'ipAddress', 'port', 'rack', 'slot', 'brand', 'model', 'pollingRate', 'isActive', 'opcuaUsername', 'opcuaPassword'];
  const template = `# OnlineSCADA PLC Import Template\n${headers.join(',')}\nMain_PLC_01,Production line 1,S7,192.168.1.10,102,0,1,SIEMENS,S7-1500,1000,true,,`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="plcs_import_template.csv"');
  res.send(template);
};

const importPLCsCSV = async (req, res) => {
  try {
    const { csvText, mode = 'create' } = req.body;
    if (!csvText || typeof csvText !== 'string') return res.status(400).json({ success: false, message: 'csvText is required' });
    const { headers, rows } = parseCSV(csvText);
    if (headers.length === 0 || rows.length === 0) return res.status(400).json({ success: false, message: 'CSV appears to be empty' });

    const requiredHeaders = ['name', 'protocol'];
    const missingHeaders = requiredHeaders.filter(h => !headers.find(xh => xh.toLowerCase() === h.toLowerCase()));
    if (missingHeaders.length > 0) return res.status(400).json({ success: false, message: `Missing headers: ${missingHeaders.join(', ')}` });

    const currentCount = await PLCConnection.countDocuments({ companyId: req.companyId });
    const maxPLCs = req.company?.limits?.maxPLCs || 999;
    const slotsRemaining = Math.max(0, maxPLCs - currentCount);

    const results = { total: rows.length, created: [], updated: [], skipped: [], failed: [] };
    let createdCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowRaw = rows[i];
      const row = {}; Object.keys(rowRaw).forEach(k => row[k.toLowerCase().trim()] = rowRaw[k]);
      const rowNum = i + 2;

      try {
        const name = (row.name || '').trim();
        const protocol = (row.protocol || '').trim().toUpperCase();
        if (!name) { results.failed.push({ row: rowNum, error: 'Missing name' }); continue; }
        if (!protocol) { results.failed.push({ row: rowNum, name, error: 'Missing protocol' }); continue; }

        const plcData = {
          companyId: req.companyId,
          name, description: (row.description || '').trim(), protocol,
          ipAddress: (row.ipaddress || '192.168.1.100').trim(), port: Number(row.port) || 502,
          rack: Number(row.rack) || 0, slot: Number(row.slot) || 1, brand: (row.brand || 'OTHER').trim().toUpperCase(),
          model: (row.model || '').trim(), pollingRate: Number(row.pollingrate) || 1000,
          isActive: true, opcuaUsername: (row.opcuausername || '').trim(), opcuaPassword: (row.opcuapassword || '').trim(),
        };

        const existing = await PLCConnection.findOne({ companyId: req.companyId, name: plcData.name });
        if (existing) {
          if (mode === 'create') { results.skipped.push({ row: rowNum, name: plcData.name, reason: 'Exists' }); continue; }
          if (existing.isSimulation) { results.skipped.push({ row: rowNum, name: plcData.name, reason: 'Cannot update simulation' }); continue; }
          Object.assign(existing, plcData); delete plcData.companyId;
          await existing.save(); results.updated.push(plcData.name);
        } else {
          if (mode === 'update') { results.skipped.push({ row: rowNum, name: plcData.name, reason: 'Does not exist' }); continue; }
          if (createdCount >= slotsRemaining) { results.failed.push({ row: rowNum, name: plcData.name, error: 'Plan limit reached' }); continue; }
          await PLCConnection.create(plcData); results.created.push(plcData.name); createdCount++;
        }
      } catch (err) { results.failed.push({ row: rowNum, name: rowRaw.name || '?', error: err.message }); }
    }

    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) {}

    res.json({ success: true, message: `Import complete: ${results.created.length} created`, data: results });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = {
  createPLC, createQuickSimulationPLC, getAllPLCs, getPLC, updatePLC, deletePLC,
  testPLCConnection, startPLC, stopPLC, getPLCStatus, exportPLCsCSV, importPLCsCSV, downloadPLCTemplate,
};