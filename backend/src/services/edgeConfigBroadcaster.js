// ═══════════════════════════════════════════════════════════
// Edge Config Broadcaster
// Pushes full live PLC+Tag config to connected Edge Gateways
// Call this whenever PLCs or Tags are created/updated/deleted
// ═══════════════════════════════════════════════════════════

const EdgeGateway = require('../models/EdgeGateway');
const PLCConnection = require('../models/PLCConnection');
const Tag = require('../models/Tag');

async function compileLiveConfig(companyId) {
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

    let protocol = (plc.protocol || '').toLowerCase();
    if (protocol === 'modbus_tcp' || protocol === 'modbus_rtu') protocol = 'modbus';
    if (protocol === 'opc_ua' || protocol === 'opc-ua') protocol = 'opcua';
    if (protocol === 'ethernet_ip' || protocol === 'ethernet-ip') protocol = 'ethernet_ip';

    plcConfigArray.push({
      plcId: plc._id.toString(),
      plcName: plc.name,
      protocol,
      ip: plc.ipAddress,
      port: plc.port,
      rack: plc.rack || 0,
      slot: plc.slot || 0,
      opcuaUsername: plc.opcuaUsername || '',
      opcuaPassword: plc.opcuaPassword || '',
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
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Push full config to all edge gateways of this company.
 * Safe to call even if no gateway is online.
 */
async function broadcastConfigUpdate(io, companyId) {
  if (!io) return;

  try {
    const config = await compileLiveConfig(companyId);
    const room = `edge:company:${String(companyId)}`;

    io.of('/edge').to(room).emit('edge:configUpdate', {
      message: 'PLC/Tag configuration changed — hot reload',
      plcs: config.plcs,
      generatedAt: config.generatedAt,
      timestamp: Date.now(),
    });

    console.log(
      `📡 edge:configUpdate → company=${companyId} | ${config.plcs.length} PLC(s) | ` +
      `${config.plcs.reduce((n, p) => n + (p.tags?.length || 0), 0)} tag(s)`
    );
  } catch (err) {
    console.warn('⚠️  broadcastConfigUpdate failed:', err.message);
  }
}

module.exports = {
  compileLiveConfig,
  broadcastConfigUpdate,
};
