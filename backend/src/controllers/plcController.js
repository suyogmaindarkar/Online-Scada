// ═══════════════════════════════════════════════════════════
// PLC Controller — Multi-Tenant Update
//
// ✅ All queries scoped by req.companyId
// ✅ All creates include companyId
// ✅ Plan limit enforcement (maxPLCs)
// ═══════════════════════════════════════════════════════════

const plcManager = require('../services/plcManager');
const simulationService = require('../services/simulationService');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');

// ─────────────────────────────────────────────────────────
// CSV UTILITIES (unchanged)
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

// ─── Helper: Find next available simulation IP (SCOPED TO COMPANY) ───
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

// ─── Helper: Check plan limits ───
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

    // ✅ Plan limit check
    const limitCheck = await checkPLCLimit(req);
    if (limitCheck.exceeded) {
      return res.status(403).json({ success: false, message: limitCheck.message, code: 'PLAN_LIMIT_EXCEEDED' });
    }

    // ✅ Uniqueness check SCOPED to company
    const exists = await PLCConnection.findOne({ companyId: req.companyId, name });
    if (exists) {
      return res.status(400).json({ success: false, message: 'PLC with this name already exists in this workspace' });
    }

    let defaultPort = 502;
    if (protocol === 'S7') defaultPort = 102;
    if (protocol === 'OPC_UA') defaultPort = 4840;
    if (protocol === 'ETHERNET_IP') defaultPort = 44818;

    const plc = await PLCConnection.create({
      companyId: req.companyId, // ✅ MULTI-TENANT
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
    });

    res.status(201).json({
      success: true,
      message: 'PLC created successfully',
      data: plc,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// QUICK-CREATE Simulation PLC
// ═══════════════════════════════════════════════════════════
const createQuickSimulationPLC = async (req, res) => {
  try {
    // ✅ Plan limit check
    const limitCheck = await checkPLCLimit(req);
    if (limitCheck.exceeded) {
      return res.status(403).json({ success: false, message: limitCheck.message, code: 'PLAN_LIMIT_EXCEEDED' });
    }

    const name = await getNextSimName(req.companyId);
    const ipAddress = await getNextSimIP(req.companyId);
    const simulationPrefix = await getNextSimPrefix(req.companyId);

    const plc = await PLCConnection.create({
      companyId: req.companyId, // ✅ MULTI-TENANT
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

    try {
      await plcManager.start(plc._id);
    } catch (startErr) {
      console.warn('Auto-start of sim PLC failed:', startErr.message);
    }

    const updated = await PLCConnection.findOne({ _id: plc._id, companyId: req.companyId });
    const tagCount = await Tag.countDocuments({ companyId: req.companyId, plcConnection: plc._id });

    res.status(201).json({
      success: true,
      message: `Simulation PLC "${name}" created with ${tagCount} auto-generated tags`,
      data: { ...updated.toObject(), tagCount },
    });
  } catch (error) {
    console.error('Quick Sim PLC Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create simulation PLC', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// GET ALL PLCs (scoped to company)
// ═══════════════════════════════════════════════════════════
const getAllPLCs = async (req, res) => {
  try {
    const plcs = await PLCConnection.find({ companyId: req.companyId }).sort({ createdAt: -1 });

    const plcsWithCount = await Promise.all(
      plcs.map(async (plc) => {
        const tagCount = await Tag.countDocuments({ companyId: req.companyId, plcConnection: plc._id });
        return { ...plc.toObject(), tagCount };
      })
    );

    res.json({ success: true, count: plcs.length, data: plcsWithCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// GET SINGLE PLC (scoped to company)
// ═══════════════════════════════════════════════════════════
const getPLC = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });
    const tagCount = await Tag.countDocuments({ companyId: req.companyId, plcConnection: plc._id });
    res.json({ success: true, data: { ...plc.toObject(), tagCount } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// UPDATE PLC (scoped to company)
// ═══════════════════════════════════════════════════════════
const updatePLC = async (req, res) => {
  try {
    // Prevent companyId from being changed
    delete req.body.companyId;

    const plc = await PLCConnection.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });
    res.json({ success: true, message: 'PLC updated successfully', data: plc });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// DELETE PLC (scoped to company)
// ═══════════════════════════════════════════════════════════
const deletePLC = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });

    try { await plcManager.stop(plc._id); } catch {}

    if (plc.isSimulation) {
      // Delete sim tags scoped to this company
      const deletedCount = await Tag.deleteMany({ companyId: req.companyId, plcConnection: plc._id, isSimulationTag: true });
      console.log(`🗑️  Cleaned up ${deletedCount.deletedCount} simulation tags for ${plc.name}`);
    } else {
      const tagCount = await Tag.countDocuments({ companyId: req.companyId, plcConnection: plc._id });
      if (tagCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete PLC. It has ${tagCount} associated tags. Delete tags first.`,
        });
      }
    }

    await PLCConnection.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });

    res.json({
      success: true,
      message: plc.isSimulation
        ? `Simulation PLC "${plc.name}" and its demo tags deleted successfully`
        : 'PLC deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// TEST PLC CONNECTION (scoped)
// ═══════════════════════════════════════════════════════════
const testPLCConnection = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });

    if (plc.protocol === 'SIMULATION') {
      plc.isConnected = true;
      plc.lastConnected = Date.now();
      await plc.save();
      return res.json({
        success: true,
        message: 'PLC connection successful (Simulation Mode)',
        data: { connected: true, protocol: plc.protocol, timestamp: new Date() },
      });
    }

    // Import services dynamically to avoid circular dependencies
    let service;
    switch (plc.protocol) {
      case 'S7':
        service = require('../services/s7Service');
        break;
      case 'MODBUS_TCP':
      case 'MODBUS_RTU':
        service = require('../services/modbusService');
        break;
      case 'OPC_UA':
        service = require('../services/opcuaService');
        break;
      default:
        return res.json({
          success: false,
          message: `Connection test not supported for protocol: ${plc.protocol}`,
          data: { protocol: plc.protocol },
        });
    }

    // Use the service's test method
    const result = await service.test(plc);

    if (result.success) {
      // Update PLC status on successful test
      plc.isConnected = true;
      plc.lastConnected = Date.now();
      await plc.save();

      return res.json({
        success: true,
        message: `PLC connection test successful (${plc.protocol})`,
        data: { connected: true, protocol: plc.protocol, timestamp: new Date() },
      });
    } else {
      return res.json({
        success: false,
        message: `PLC connection test failed: ${result.error}`,
        data: { connected: false, protocol: plc.protocol, error: result.error },
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// START / STOP / STATUS (scoped)
// ═══════════════════════════════════════════════════════════
const startPLC = async (req, res) => {
  try {
    // Verify PLC belongs to this company first
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });

    const result = await plcManager.start(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const stopPLC = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });

    const result = await plcManager.stop(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPLCStatus = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });
    const isRunning = plcManager.isRunning(plc._id, plc.protocol);
    res.json({
      success: true,
      data: {
        plcId: plc._id,
        name: plc.name,
        protocol: plc.protocol,
        isConnected: plc.isConnected,
        isRunning,
        lastConnected: plc.lastConnected,
        isSimulation: plc.isSimulation,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// EXPORT PLCs AS CSV (scoped)
// ═══════════════════════════════════════════════════════════
const exportPLCsCSV = async (req, res) => {
  try {
    const plcs = await PLCConnection.find({
      companyId: req.companyId,
      isSimulation: { $ne: true },
    }).sort({ name: 1 });

    const headers = [
      'name', 'description', 'protocol', 'ipAddress', 'port',
      'rack', 'slot', 'brand', 'model', 'pollingRate', 'isActive',
      'opcuaUsername', 'opcuaPassword',
    ];

    let csv = '';
    csv += `# OnlineSCADA PLC Export\n`;
    csv += `# Workspace: ${req.company?.slug || 'unknown'}\n`;
    csv += `# Generated: ${new Date().toISOString()}\n`;
    csv += `# Total PLCs: ${plcs.length}\n`;
    csv += `# Note: Simulation PLCs are excluded from export.\n`;
    csv += `# Note: Lines starting with # are ignored during import.\n`;
    csv += `#\n\n`;
    csv += headers.join(',') + '\n';

    plcs.forEach(plc => {
      const row = [
        csvEscape(plc.name),
        csvEscape(plc.description || ''),
        csvEscape(plc.protocol),
        csvEscape(plc.ipAddress),
        csvEscape(plc.port),
        csvEscape(plc.rack ?? 0),
        csvEscape(plc.slot ?? 1),
        csvEscape(plc.brand || 'OTHER'),
        csvEscape(plc.model || ''),
        csvEscape(plc.pollingRate ?? 1000),
        csvEscape(plc.isActive ? 'true' : 'false'),
        csvEscape(plc.opcuaUsername || ''),
        csvEscape(plc.opcuaPassword || ''),
      ];
      csv += row.join(',') + '\n';
    });

    const filename = `plcs_export_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Export PLCs CSV Error:', error);
    res.status(500).json({ success: false, message: 'Failed to export PLCs', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// DOWNLOAD PLC CSV TEMPLATE (unchanged — template is static)
// ═══════════════════════════════════════════════════════════
const downloadPLCTemplate = async (req, res) => {
  const headers = [
    'name', 'description', 'protocol', 'ipAddress', 'port',
    'rack', 'slot', 'brand', 'model', 'pollingRate', 'isActive',
    'opcuaUsername', 'opcuaPassword',
  ];

  const template = `# OnlineSCADA PLC Import Template
#
# INSTRUCTIONS:
#   1. Fill each row with your PLC data
#   2. Required fields: name, protocol
#   3. Valid protocol values: MODBUS_TCP, MODBUS_RTU, S7, OPC_UA, ETHERNET_IP, SIMULATION
#   4. Valid brand values: SIEMENS, ALLEN_BRADLEY, SCHNEIDER, DELTA, MITSUBISHI, OMRON, OTHER
#   5. Boolean fields (isActive): use true/false
#   6. Default ports: MODBUS_TCP=502, S7=102, OPC_UA=4840, ETHERNET_IP=44818
#   7. OPC UA fields (opcuaUsername, opcuaPassword): optional, for secured servers
#   8. Delete comment lines (starting with #) before uploading (optional)
#   9. Delete example rows below and add your own data
#
# EXAMPLE ROWS (delete before importing your data):

${headers.join(',')}
Main_PLC_01,Production line 1,S7,192.168.1.10,102,0,1,SIEMENS,S7-1500,1000,true,,
Boiler_PLC,Boiler control system,MODBUS_TCP,192.168.1.20,502,0,1,SCHNEIDER,M340,1000,true,,
Water_System,Water treatment PLC,MODBUS_TCP,192.168.1.30,502,0,1,ALLEN_BRADLEY,MicroLogix,2000,true,,
OPC_Server,OPC UA secured server,OPC_UA,192.168.1.40,4840,0,1,OTHER,,1000,true,opcuser,opcpass
`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="plcs_import_template.csv"');
  res.send(template);
};

// ═══════════════════════════════════════════════════════════
// IMPORT PLCs FROM CSV (scoped + plan limit check)
// ═══════════════════════════════════════════════════════════
const importPLCsCSV = async (req, res) => {
  try {
    const { csvText, mode = 'create' } = req.body;

    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ success: false, message: 'csvText is required' });
    }

    const { headers, rows } = parseCSV(csvText);

    console.log(`📥 PLC import [${req.companySlug}]: ${headers.length} headers, ${rows.length} rows`);

    if (headers.length === 0) {
      return res.status(400).json({ success: false, message: 'CSV appears to be empty or contains only comment lines.' });
    }
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'CSV has headers but no data rows.' });
    }

    const findHeader = (target) => {
      const lower = target.toLowerCase();
      return headers.find(h => h.toLowerCase() === lower);
    };

    const requiredHeaders = ['name', 'protocol'];
    const missingHeaders = requiredHeaders.filter(h => !findHeader(h));

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          `CSV is missing required headers: ${missingHeaders.join(', ')}.\n\n` +
          `Detected headers: [${headers.join(', ')}].`,
      });
    }

    // ✅ Plan limit check — how many can we still add?
    const currentCount = await PLCConnection.countDocuments({ companyId: req.companyId });
    const maxPLCs = req.company?.limits?.maxPLCs || 999;
    const slotsRemaining = Math.max(0, maxPLCs - currentCount);

    const normalizeRow = (row) => {
      const normalized = {};
      Object.keys(row).forEach((key) => { normalized[key.toLowerCase().trim()] = row[key]; });
      return normalized;
    };

    const results = { total: rows.length, created: [], updated: [], skipped: [], failed: [] };

    const validProtocols = ['MODBUS_TCP', 'MODBUS_RTU', 'S7', 'OPC_UA', 'ETHERNET_IP', 'SIMULATION'];
    const validBrands = ['SIEMENS', 'ALLEN_BRADLEY', 'SCHNEIDER', 'DELTA', 'MITSUBISHI', 'OMRON', 'OTHER', 'SIMULATION'];

    let createdCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowRaw = rows[i];
      const row = normalizeRow(rowRaw);
      const rowNum = i + 2;

      try {
        const name = (row.name || '').trim();
        const protocol = (row.protocol || '').trim();

        if (!name) { results.failed.push({ row: rowNum, error: 'Missing name' }); continue; }
        if (!protocol) { results.failed.push({ row: rowNum, name, error: 'Missing protocol' }); continue; }

        const upperProtocol = protocol.toUpperCase();
        if (!validProtocols.includes(upperProtocol)) {
          results.failed.push({ row: rowNum, name, error: `Invalid protocol '${protocol}'` });
          continue;
        }

        const brand = (row.brand || 'OTHER').trim() || 'OTHER';
        const upperBrand = brand.toUpperCase();
        if (!validBrands.includes(upperBrand)) {
          results.failed.push({ row: rowNum, name, error: `Invalid brand '${brand}'` });
          continue;
        }

        const parseBool = (v) => {
          if (v === true || v === false) return v;
          if (typeof v !== 'string') return true;
          const lower = v.trim().toLowerCase();
          return !(lower === 'false' || lower === '0' || lower === 'no');
        };

        const parseNum = (v, fallback) => {
          if (v === '' || v === null || v === undefined) return fallback;
          const n = Number(String(v).trim());
          return isNaN(n) ? fallback : n;
        };

        let defaultPort = 502;
        if (upperProtocol === 'S7') defaultPort = 102;
        if (upperProtocol === 'OPC_UA') defaultPort = 4840;
        if (upperProtocol === 'ETHERNET_IP') defaultPort = 44818;

        const plcData = {
          companyId: req.companyId, // ✅ MULTI-TENANT
          name,
          description: (row.description || '').trim(),
          protocol: upperProtocol,
          ipAddress: (row.ipaddress || '192.168.1.100').trim() || '192.168.1.100',
          port: parseNum(row.port, defaultPort),
          rack: parseNum(row.rack, 0),
          slot: parseNum(row.slot, 1),
          brand: upperBrand,
          model: (row.model || '').trim(),
          pollingRate: parseNum(row.pollingrate, 1000),
          isActive: parseBool(row.isactive),
          opcuaUsername: (row.opcuausername || '').trim(),
          opcuaPassword: (row.opcuapassword || '').trim(),
        };

        // ✅ Query scoped to company
        const existing = await PLCConnection.findOne({ companyId: req.companyId, name: plcData.name });

        if (existing) {
          if (mode === 'create') {
            results.skipped.push({ row: rowNum, name: plcData.name, reason: 'Already exists (mode=create)' });
            continue;
          }
          if (existing.isSimulation) {
            results.skipped.push({ row: rowNum, name: plcData.name, reason: 'Cannot update simulation PLC' });
            continue;
          }
          Object.assign(existing, plcData);
          delete plcData.companyId; // don't reassign
          await existing.save();
          results.updated.push(plcData.name);
        } else {
          if (mode === 'update') {
            results.skipped.push({ row: rowNum, name: plcData.name, reason: 'Does not exist (mode=update)' });
            continue;
          }
          // ✅ Check plan limit BEFORE creating
          if (createdCount >= slotsRemaining) {
            results.failed.push({
              row: rowNum,
              name: plcData.name,
              error: `Plan limit reached (${maxPLCs} PLCs). Upgrade to add more.`,
            });
            continue;
          }
          await PLCConnection.create(plcData);
          results.created.push(plcData.name);
          createdCount++;
        }
      } catch (err) {
        results.failed.push({ row: rowNum, name: rowRaw.name || '(unknown)', error: err.message });
      }
    }

    console.log(`✅ PLC import complete [${req.companySlug}]: ${results.created.length}c/${results.updated.length}u/${results.skipped.length}s/${results.failed.length}f`);

    res.json({
      success: true,
      message: `Import complete: ${results.created.length} created, ${results.updated.length} updated, ${results.skipped.length} skipped, ${results.failed.length} failed`,
      data: results,
    });
  } catch (error) {
    console.error('❌ Import PLCs CSV Error:', error);
    res.status(500).json({ success: false, message: 'Failed to import PLCs: ' + error.message, error: error.message });
  }
};

module.exports = {
  createPLC,
  createQuickSimulationPLC,
  getAllPLCs,
  getPLC,
  updatePLC,
  deletePLC,
  testPLCConnection,
  startPLC,
  stopPLC,
  getPLCStatus,
  exportPLCsCSV,
  importPLCsCSV,
  downloadPLCTemplate,
};