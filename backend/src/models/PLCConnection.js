// ═══════════════════════════════════════════════════════════
// PLCConnection Model
//
// Task Bundle applied:
//   ✅ SIM  — isSimulation flag (auto-created demo PLCs)
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const plcConnectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'PLC name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    protocol: {
      type: String,
      enum: ['MODBUS_TCP', 'MODBUS_RTU', 'S7', 'OPC_UA', 'ETHERNET_IP', 'SIMULATION'],
      required: true,
      default: 'SIMULATION',
    },
    ipAddress: {
      type: String,
      default: '192.168.1.100',
    },
    port: {
      type: Number,
      default: 502,
    },
    rack: {
      type: Number,
      default: 0,
    },
    slot: {
      type: Number,
      default: 1,
    },
    brand: {
      type: String,
      enum: ['SIEMENS', 'ALLEN_BRADLEY', 'SCHNEIDER', 'DELTA', 'MITSUBISHI', 'OMRON', 'OTHER', 'SIMULATION'],
      default: 'OTHER',
    },
    model: {
      type: String,
      default: '',
    },
    isConnected: {
      type: Boolean,
      default: false,
    },
    lastConnected: {
      type: Date,
    },
    pollingRate: {
      type: Number,
      default: 1000,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // ═══════════════════════════════════════════════════════════
    // ✅ SIMULATION: Auto-managed demo PLC flag
    // ═══════════════════════════════════════════════════════════
    isSimulation: {
      type: Boolean,
      default: false,
    },
    // Simulation prefix for tag names (e.g. "SIM1_" so multiple sim PLCs don't collide)
    simulationPrefix: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PLCConnection', plcConnectionSchema);