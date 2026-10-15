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
const Tag = require('../models/Tag');
const edgeService = require('../services/edgeService');
const { broadcastConfigUpdate } = require('../services/edgeConfigBroadcaster');

// ─── Start Equipment ──────────────────────────────────────
// Sets active + broadcasts fresh config to the connector so it
// launches a reader for this equipment. If no connector online,
// returns CONNECTOR_OFFLINE — the UI prompts to start the connector.
const startEquipment = async (req, res) => {
  try {
    const plc = await PLCConnection.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!plc) return res.status(404).json({ success: false, message: 'Equipment not found in this workspace' });

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
      payload: { name: plc.name, protocol: plc.protocol, transportProtocol: plc.transportProtocol || null },
    });

    if (!relay.ok && !sent) {
      return res.json({ success: false, code: 'CONNECTOR_OFFLINE', message: relay.message });
    }

    res.json({
      success: true,
      message: sent ? 'Equipment is starting on the Factory Connector' : 'Start command sent to Factory Connector',
      data: { equipmentId: plc._id, requestId: relay.requestId || null, deferred: true },
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
      data: { equipmentId: plc._id, requestId: relay.requestId || null },
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

    if (!edgeService.hasActiveGateway(String(req.companyId))) {
      return res.json({ success: false, code: 'CONNECTOR_OFFLINE', message: 'Factory Connector is offline. Start Equipment first.' });
    }

    const relay = edgeService.sendEquipmentCommand(req.companyId, {
      equipmentId: plc._id.toString(),
      action: 'restart',
      payload: { name: plc.name },
    });

    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) { /* optional */ }

    res.json({ success: relay.ok, message: 'Restart command sent to Factory Connector', data: { equipmentId: plc._id, requestId: relay.requestId || null } });
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
