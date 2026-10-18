// ═══════════════════════════════════════════════════════════
// PLC Controller — Stable Original Core + Safe Deletion Fix
// ═══════════════════════════════════════════════════════════

const plcManager = require('../services/plcManager');
const simulationService = require('../services/simulationService');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');
const edgeService = require('../services/edgeService');
const { broadcastConfigUpdate, compileLiveConfig } = require('../services/edgeConfigBroadcaster');

const isPlcLiveFromEdge = async (plc, companyId) => {
  if (plc.isActive === false) return { connected: false, state: 'stopped', message: 'Equipment is stopped' };
  if (plc.isSimulation || plc.protocol === 'SIMULATION') return {
    connected: Boolean(plc.isConnected),
    state: plc.isConnected ? 'connected' : 'stopped',
    message: plc.isConnected ? 'Simulation is running' : 'Simulation is stopped',
  };
  if (!edgeService.hasActiveGateway(String(companyId))) return {
    connected: false,
    state: 'connector_offline',
    message: 'Factory Connector is offline',
  };

  const status = edgeService.getEquipmentStatus(companyId, plc._id);
  return status ? { connected: status.isConnected === true, state: status.state, message: status.message } : {
    connected: false, state: 'connecting', message: 'Waiting for equipment status from Factory Connector',
  };
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

const createPLC = async (req, res) => {
  try {
    const {
       name, description, protocol, transportProtocol, gatewayDeviceAddress, ipAddress, port,
       rack, slot, unitId, brand, model, pollingRate,
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
    if (protocol === 'PROFIBUS_GATEWAY') {
      if (!['OPC_UA', 'MODBUS_TCP', 'ETHERNET_IP'].includes(transportProtocol)) {
        return res.status(400).json({ success: false, message: 'Select OPC UA, Modbus TCP, or Ethernet/IP as the Profibus gateway transport.' });
      }
      if (transportProtocol === 'OPC_UA') defaultPort = 4840;
      if (transportProtocol === 'ETHERNET_IP') defaultPort = 44818;
    }

    const plc = await PLCConnection.create({
      companyId: req.companyId,
      name,
      description: description || '',
       protocol,
       transportProtocol: protocol === 'PROFIBUS_GATEWAY' ? transportProtocol : null,
       gatewayDeviceAddress: protocol === 'PROFIBUS_GATEWAY' ? (gatewayDeviceAddress || '') : '',
      ipAddress: ipAddress || '192.168.1.100',
      port: port || defaultPort,
       rack: rack || 0,
       slot: slot || 1,
       unitId: unitId ?? 1,
      brand: brand || 'OTHER',
      model: model || '',
      pollingRate: pollingRate || 1000,
      opcuaUsername: opcuaUsername || '',
      opcuaPassword: opcuaPassword || '',
      isActive: true,
    });

    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) { }

    res.status(201).json({ success: true, message: 'PLC created successfully', data: plc });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

const createQuickSimulationPLC = async (req, res) => {
  try {
    const limitCheck = await checkPLCLimit(req);
    if (limitCheck.exceeded) {
      return res.status(403).json({ success: false, message: limitCheck.message, code: 'PLAN_LIMIT_EXCEEDED' });
    }

    const plc = await PLCConnection.create({
      companyId: req.companyId,
      name: 'Demo Simulation PLC',
      description: `Auto-generated simulation PLC`,
      protocol: 'SIMULATION',
      ipAddress: '10.0.0.100',
      port: 502,
      brand: 'SIMULATION',
      model: 'Virtual PLC',
      pollingRate: 1000,
      isActive: true,
      isSimulation: true,
      simulationPrefix: 'SIM_',
    });

    res.status(201).json({ success: true, message: 'Simulation PLC created', data: plc });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create simulation PLC', error: error.message });
  }
};

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
          isConnected: liveConnected.connected,
           connectionState: liveConnected.state,
           connectionMessage: liveConnected.message,
        };
      })
    );

    res.json({ success: true, count: plcs.length, data: plcsWithCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

const getPLC = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });
    const tagCount = await Tag.countDocuments({ companyId: req.companyId, plcConnection: plc._id });
    const liveConnected = await isPlcLiveFromEdge(plc, req.companyId);

    res.json({ success: true, data: { ...plc.toObject(), tagCount, isConnected: liveConnected.connected, connectionState: liveConnected.state, connectionMessage: liveConnected.message } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

const updatePLC = async (req, res) => {
  try {
    delete req.body.companyId;
    const plc = await PLCConnection.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });

    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) { }

    res.json({ success: true, message: 'PLC updated successfully', data: plc });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

const deletePLC = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });

    try { await plcManager.stop(plc._id); } catch { }

    // ⭐ FIX: If it's a simulation/demo PLC, automatically delete its associated tags so deletion never gets blocked!
    if (plc.isSimulation) {
      await Tag.deleteMany({ companyId: req.companyId, plcConnection: plc._id });
    } else {
      const tagCount = await Tag.countDocuments({ companyId: req.companyId, plcConnection: plc._id });
      if (tagCount > 0) {
        return res.status(400).json({ success: false, message: `Cannot delete PLC. It has ${tagCount} associated tags. Delete tags first.` });
      }
    }

    await PLCConnection.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });

    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) { }

    res.json({ success: true, message: plc.isSimulation ? `Simulation PLC deleted` : 'PLC deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

const testPLCConnection = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });

    if (plc.isSimulation || plc.protocol === 'SIMULATION') {
      return res.json({ success: true, message: 'Connection successful', data: { connected: true } });
    }

    const config = (await compileLiveConfig(req.companyId, { equipmentId: plc._id, includeInactive: true })).plcs[0];
    const result = await edgeService.requestEquipmentCommand(req.companyId, {
      equipmentId: String(plc._id), action: 'test', payload: { config },
    });
    return res.json({
      success: result.success === true,
      code: result.code,
      message: result.message,
      data: { connected: result.success === true && result.connected === true, error: result.error || (result.success ? null : result.message), requestId: result.requestId || null },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

const startPLC = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });
    if (!plc.isSimulation && plc.protocol !== 'SIMULATION') return require('./equipmentCommandController').startEquipment(req, res);

    plc.isActive = true;
    await plc.save();

    const result = await plcManager.start(req.params.id);

    if (result?.deferred) {
      try {
        const io = req.app.get('io');
        await broadcastConfigUpdate(io, req.companyId);
      } catch (e) { }
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
    if (!plc.isSimulation && plc.protocol !== 'SIMULATION') return require('./equipmentCommandController').stopEquipment(req, res);

    plc.isActive = false;
    plc.isConnected = false;
    await plc.save();

    await plcManager.stop(req.params.id);

    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) { }

    res.json({ success: true, message: `PLC "${plc.name}" stopped.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPLCStatus = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'PLC not found' });

    const effectiveProtocol = plc.protocol === 'PROFIBUS_GATEWAY' ? plc.transportProtocol : plc.protocol;
    const liveConnected = await isPlcLiveFromEdge(plc, req.companyId);
    const isRunning = plc.isSimulation || plc.protocol === 'SIMULATION'
      ? plcManager.isRunning(plc._id, effectiveProtocol)
      : plc.isActive !== false && edgeService.hasActiveGateway(req.companyId) && Boolean(edgeService.getEquipmentStatus(req.companyId, plc._id));

    res.json({
      success: true,
      data: {
        plcId: plc._id,
        name: plc.name,
        protocol: plc.protocol,
        isConnected: liveConnected.connected,
        connectionState: liveConnected.state,
        connectionMessage: liveConnected.message,
        isRunning,
        isActive: plc.isActive,
        isSimulation: plc.isSimulation,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const exportPLCsCSV = async (req, res) => {
  try {
    const plcs = await PLCConnection.find({ companyId: req.companyId, isSimulation: { $ne: true } }).sort({ name: 1 });
    const headers = ['name', 'description', 'protocol', 'ipAddress', 'port', 'rack', 'slot', 'brand', 'model', 'pollingRate', 'isActive', 'opcuaUsername', 'opcuaPassword'];
    let csv = `# OnlineSCADA PLC Export\n# Workspace: ${req.company?.slug || 'unknown'}\n# Generated: ${new Date().toISOString()}\n# Total PLCs: ${plcs.length}\n#\n\n${headers.join(',')}\n`;
    plcs.forEach(plc => {
      csv += [plc.name, plc.description || '', plc.protocol, plc.ipAddress, plc.port, plc.rack ?? 0, plc.slot ?? 1, plc.brand || 'OTHER', plc.model || '', plc.pollingRate ?? 1000, plc.isActive ? 'true' : 'false', plc.opcuaUsername || '', plc.opcuaPassword || ''].join(',') + '\n';
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
  res.json({ success: true, message: 'Import ready' });
};

module.exports = {
  createPLC, createQuickSimulationPLC, getAllPLCs, getPLC, updatePLC, deletePLC,
  testPLCConnection, startPLC, stopPLC, getPLCStatus, exportPLCsCSV, importPLCsCSV, downloadPLCTemplate,
};
