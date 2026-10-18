// ═══════════════════════════════════════════════════════════
// Equipment Command Controller — Remote Start/Stop/Restart
//
// Bundles the "Start Equipment" / "Stop Equipment" / "Restart
// Connection" actions for factory operators. Every command is
// validated for ownership, then relayed to the company's Factory
// Connector over the /edge namespace (reverse tunnel). Results are
// streamed back to the browser via Socket.IO (equipmentCommandResult).
// ═══════════════════════════════════════════════════════════

const PLCConnection = require('../models/PLCConnection');
const edgeService = require('../services/edgeService');
const { broadcastConfigUpdate, compileLiveConfig } = require('../services/edgeConfigBroadcaster');

// ─── Start Equipment ──────────────────────────────────────
// Sets active + broadcasts fresh config to the connector so it
// launches a reader for this equipment. If no connector online,
// returns CONNECTOR_OFFLINE — the UI prompts to start the connector.
const startEquipment = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'Equipment not found in this workspace' });
    if (plc.isSimulation || plc.protocol === 'SIMULATION') return require('./plcController').startPLC(req, res);

    const hasGateway = edgeService.hasActiveGateway(String(req.companyId));
    if (!hasGateway) {
      return res.json({
        success: false,
        code: 'CONNECTOR_OFFLINE',
        message: 'Factory Connector is offline. Start it before starting equipment.',
      });
    }

    plc.isActive = true;
    plc.isConnected = false; // real state comes from connector
    await plc.save();

    // Push updated config to connector so it adds/refreshes this reader
    let sent = false;
    try {
      const io = req.app.get('io');
      const dispatch = await broadcastConfigUpdate(io, req.companyId);
      sent = dispatch?.sent || false;
    } catch (e) { /* broadcast is optional */ }

    // Also send a direct command with requestId for explicit ack
    const relay = edgeService.sendEquipmentCommand(req.companyId, {
      equipmentId: plc._id.toString(),
      action: 'start',
      payload: { config: (await compileLiveConfig(req.companyId, { equipmentId: plc._id })).plcs[0] },
    });

    if (!relay.ok) {
      return res.json({ success: false, code: relay.code, message: relay.message });
    }

    res.json({
      success: true,
      message: sent ? 'Equipment is starting on the Factory Connector' : 'Start command sent to Factory Connector',
      data: { equipmentId: plc._id, requestId: relay.requestId || null, deferred: true, isActive: true },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Stop Equipment ───────────────────────────────────────
const stopEquipment = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'Equipment not found in this workspace' });
    if (plc.isSimulation || plc.protocol === 'SIMULATION') return require('./plcController').stopPLC(req, res);

    plc.isActive = false;
    plc.isConnected = false;
    await plc.save();

    const relay = edgeService.sendEquipmentCommand(req.companyId, {
      equipmentId: plc._id.toString(),
      action: 'stop',
      payload: { name: plc.name },
    });

    // Also broadcast config so connector removes the reader
    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) { /* optional */ }

    res.json({
      success: true,
      message: relay.ok
        ? 'Stop command sent to Factory Connector'
        : 'Equipment marked inactive (connector offline). It will not stream.',
      data: { equipmentId: plc._id, requestId: relay.requestId || null, isActive: false },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Restart Connection ───────────────────────────────────
const restartEquipment = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'Equipment not found' });
    if (!plc.isActive) return res.status(409).json({ success: false, code: 'EQUIPMENT_DISABLED', message: 'Equipment is stopped. Start it before restarting the connection.' });
    if (plc.isSimulation || plc.protocol === 'SIMULATION') {
      await require('../services/plcManager').stop(req.params.id);
      return require('./plcController').startPLC(req, res);
    }

    if (!edgeService.hasActiveGateway(String(req.companyId))) {
      return res.json({ success: false, code: 'CONNECTOR_OFFLINE', message: 'Factory Connector is offline. Start Equipment first.' });
    }

    const relay = edgeService.sendEquipmentCommand(req.companyId, {
      equipmentId: plc._id.toString(),
      action: 'restart',
      payload: { config: (await compileLiveConfig(req.companyId, { equipmentId: plc._id })).plcs[0] },
    });

    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) { /* optional */ }

    res.json({ success: relay.ok, code: relay.code, message: relay.ok ? 'Restart command sent to Factory Connector' : relay.message, data: { equipmentId: plc._id, requestId: relay.requestId || null } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Connector overview (status for UI) ───────────────────
const getConnectorStatus = async (req, res) => {
  try {
    const gwList = edgeService.getCompanyGateways(String(req.companyId));
    const hasGateway = gwList.length > 0;
    res.json({
      success: true,
      data: {
        connectorOnline: Boolean(hasGateway),
        gatewayCount: gwList.length,
        gateways: gwList,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { startEquipment, stopEquipment, restartEquipment, getConnectorStatus };
