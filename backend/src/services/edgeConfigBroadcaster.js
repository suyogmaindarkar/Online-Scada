// ═══════════════════════════════════════════════════════════
// Edge Config Broadcaster
// Pushes full live PLC+Tag config to connected Edge Gateways
// Call this whenever PLCs or Tags are created/updated/deleted
// ═══════════════════════════════════════════════════════════

const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');
let lastConfigTimestamp = 0;

async function compileLiveConfig(companyId, { equipmentId, includeInactive = false } = {}) {
  lastConfigTimestamp = Math.max(Date.now(), lastConfigTimestamp + 1);
  const generatedAt = new Date(lastConfigTimestamp).toISOString();
  const plcs = await PLCConnection.find({
    companyId,
    isSimulation: { $ne: true },
    ...(includeInactive ? {} : { isActive: true }),
    ...(equipmentId ? { _id: equipmentId } : {}),
  });

  const plcConfigArray = [];

  for (const plc of plcs) {
    const tags = await Tag.find({
      companyId,
      plcConnection: plc._id,
      isActive: true,
    });

    const isProfibusGateway = plc.protocol === 'PROFIBUS_GATEWAY';
    let protocol = (isProfibusGateway ? plc.transportProtocol : plc.protocol || '').toLowerCase();
    if (protocol === 'modbus_tcp' || protocol === 'modbus_rtu') protocol = 'modbus';
    if (protocol === 'opc_ua' || protocol === 'opc-ua') protocol = 'opcua';
    if (protocol === 'ethernet_ip' || protocol === 'ethernet-ip') protocol = 'ethernet_ip';

    plcConfigArray.push({
      plcId: plc._id.toString(),
      plcName: plc.name,
      isActive: plc.isActive,
      sourceProtocol: plc.protocol,
      isProfibusGateway,
      gatewayDeviceAddress: plc.gatewayDeviceAddress || '',
      protocol,
      ip: plc.ipAddress,
      port: plc.port,
      unitId: plc.unitId ?? 1,
      rack: plc.rack || 0,
      slot: plc.slot || 0,
      opcuaUsername: plc.opcuaUsername || '',
      opcuaPassword: plc.opcuaPassword || '',
      username: plc.opcuaUsername || '',
      password: plc.opcuaPassword || '',
      pollIntervalMs: plc.pollingRate || 1000,
      isConnected: false,
      connectionState: 'pending',
      connectionMessage: 'Waiting for equipment connection test',
      tags: tags.map((t) => ({
        tagId: t._id.toString(),
        tagName: t.tagName,
        address: t.plcAddress,
        dataType: t.dataType,
      })),
    });
  }

  return {
    plcs: plcConfigArray,
    generatedAt,
  };
}

/**
 * Push full config to all edge gateways of this company.
 * Safe to call even if no gateway is online.
 */
async function broadcastConfigUpdate(io, companyId) {
  if (!io) return { sent: false };

  try {
    const config = await compileLiveConfig(companyId);
    const room = `edge:company:${String(companyId)}`;

    io.of('/edge').to(room).emit('edge:configUpdate', {
      message: 'PLC/Tag configuration changed — hot reload',
      plcs: config.plcs,
      generatedAt: config.generatedAt,
      timestamp: Date.now(),
    });

    return { sent: true, config };
  } catch (err) {
    return { sent: false };
  }
}

module.exports = {
  compileLiveConfig,
  broadcastConfigUpdate,
};
