// ═══════════════════════════════════════════════════════════
// PLCConnection Model — Multi-Tenant Update
// ✅ Added companyId — every PLC belongs to ONE company
// ✅ Name unique WITHIN a company (was globally)
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const plcConnectionSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'PLC name is required'],
      trim: true,
    },
    description:   { type: String, default: '' },
    protocol: {
      type: String,
      enum: ['MODBUS_TCP', 'MODBUS_RTU', 'S7', 'OPC_UA', 'ETHERNET_IP', 'SIMULATION'],
      required: true,
      default: 'SIMULATION',
    },
    ipAddress:     { type: String, default: '192.168.1.100' },
    port:          { type: Number, default: 502 },
    rack:          { type: Number, default: 0 },
    slot:          { type: Number, default: 1 },
    brand: {
      type: String,
      enum: ['SIEMENS', 'ALLEN_BRADLEY', 'SCHNEIDER', 'DELTA', 'MITSUBISHI', 'OMRON', 'OTHER', 'SIMULATION'],
      default: 'OTHER',
    },
    model:         { type: String, default: '' },
    isConnected:   { type: Boolean, default: false },
    lastConnected: { type: Date },
    pollingRate:   { type: Number, default: 1000 },
    isActive:      { type: Boolean, default: true },
    isSimulation:  { type: Boolean, default: false },
    simulationPrefix: { type: String, default: '' },
  },
  { timestamps: true }
);

// PLC name unique WITHIN a company (was globally unique)
plcConnectionSchema.index({ companyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('PLCConnection', plcConnectionSchema);