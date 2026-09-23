// ═══════════════════════════════════════════════════════════
// PLC Manager — Central PLC Polling & Writing Orchestrator
// ═══════════════════════════════════════════════════════════

const PLCConnection = require('../models/PLCConnection');

const isPrivateIP = (ip) => {
  if (!ip) return false;
  const cleanIp = ip.replace(/^opc\.tcp:\/\//, '').split(':')[0].trim();
  if (cleanIp === 'localhost' || cleanIp === '127.0.0.1') return true;

  const parts = cleanIp.split('.').map(Number);
  if (parts.length !== 4) return false;

  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;

  return false;
};

const isCloudEnvironment = () => {
  return process.env.RENDER || process.env.NODE_ENV === 'production';
};

class PLCManager {
  constructor() {
    this.io = null;
    this.activeServices = new Map();
  }

  init(io) {
    this.io = io;
    console.log('🔌 PLCManager initialized');
  }

  async startAll() {
    try {
      const plcs = await PLCConnection.find({ isActive: true });
      console.log(`🔌 Starting ${plcs.length} active PLC connection(s)...`);

      for (const plc of plcs) {
        try {
          await this.start(plc._id);
        } catch (err) {
          console.warn(`⚠️ Could not auto-start PLC [${plc.name}]: ${err.message}`);
        }
      }
    } catch (err) {
      console.error('❌ Error starting active PLCs:', err.message);
    }
  }

  async start(plcId) {
    const plc = await PLCConnection.findById(plcId);
    if (!plc) throw new Error(`PLC with ID ${plcId} not found`);

    const id = plc._id.toString();

    if (plc.protocol === 'SIMULATION' || plc.isSimulation) {
      const simulationService = require('./simulationService');
      const result = await simulationService.start(plc, this.io);
      this.activeServices.set(id, 'SIMULATION');
      return result;
    }

    if (isCloudEnvironment() && isPrivateIP(plc.ipAddress)) {
      console.log(`🌐 PLC [${plc.name}] (${plc.ipAddress}) is on a private network.`);
      console.log(`   └─ Deferred to Edge Gateway (no direct TCP from Cloud server).`);
      return {
        success: true,
        deferred: true,
        message: 'PLC is on a private network. Data is streamed via Edge Gateway.',
      };
    }

    let service;
    switch (plc.protocol) {
      case 'S7':
        service = require('./s7Service');
        break;
      case 'MODBUS_TCP':
      case 'MODBUS_RTU':
        service = require('./modbusService');
        break;
      case 'OPC_UA':
      case 'OPC-UA':
        service = require('./opcuaService');
        break;
      default:
        throw new Error(`Unsupported protocol: ${plc.protocol}`);
    }

    const result = await service.start(plc, this.io);
    this.activeServices.set(id, plc.protocol);
    return result;
  }

  // ═══════════════════════════════════════════════════════════
  // 🆕 WRITE TAG METHOD (FIXES "plcManager.writeTag is not a function")
  // ═══════════════════════════════════════════════════════════
  async writeTag(plcId, tag, value) {
    const plc = await PLCConnection.findById(plcId);
    if (!plc) throw new Error(`PLC ${plcId} not found`);

    if (plc.protocol === 'SIMULATION' || plc.isSimulation) {
      const simulationService = require('./simulationService');
      return await simulationService.writeTag(plcId, tag, value);
    }

    let service;
    switch (plc.protocol) {
      case 'S7':
        service = require('./s7Service');
        break;
      case 'MODBUS_TCP':
      case 'MODBUS_RTU':
        service = require('./modbusService');
        break;
      case 'OPC_UA':
      case 'OPC-UA':
        service = require('./opcuaService');
        break;
      default:
        throw new Error(`Unsupported protocol for write: ${plc.protocol}`);
    }

    return await service.writeTag(plcId, tag, value);
  }

  async stop(plcId) {
    const id = plcId.toString();
    const plc = await PLCConnection.findById(plcId);
    if (!plc) return false;

    if (plc.protocol === 'SIMULATION' || plc.isSimulation) {
      const simulationService = require('./simulationService');
      simulationService.stop(id);
      this.activeServices.delete(id);
      return true;
    }

    let service;
    switch (plc.protocol) {
      case 'S7':
        service = require('./s7Service');
        break;
      case 'MODBUS_TCP':
      case 'MODBUS_RTU':
        service = require('./modbusService');
        break;
      case 'OPC_UA':
      case 'OPC-UA':
        service = require('./opcuaService');
        break;
      default:
        return false;
    }

    await service.stop(id);
    this.activeServices.delete(id);
    return true;
  }

  isRunning(plcId, protocol) {
    const id = plcId.toString();
    if (protocol === 'SIMULATION') {
      const simulationService = require('./simulationService');
      return simulationService.isRunning(id);
    }
    if (protocol === 'S7') {
      const s7Service = require('./s7Service');
      return s7Service.isRunning(id);
    }
    if (protocol === 'MODBUS_TCP' || protocol === 'MODBUS_RTU') {
      const modbusService = require('./modbusService');
      return modbusService.isRunning(id);
    }
    if (protocol === 'OPC_UA' || protocol === 'OPC-UA') {
      const opcuaService = require('./opcuaService');
      return opcuaService.isRunning(id);
    }
    return this.activeServices.has(id);
  }

  stopAll() {
    try {
      require('./simulationService').stopAll();
      require('./s7Service').stopAll();
      require('./modbusService').stopAll();
      require('./opcuaService').stopAll();
      this.activeServices.clear();
      console.log('⏹️  All PLC services stopped');
    } catch (e) {
      console.error('Error stopping all PLCs:', e.message);
    }
  }
}

module.exports = new PLCManager();