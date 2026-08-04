// ═══════════════════════════════════════════════════════════
// Tag Model
//
// Task Bundle applied:
//   ✅ SIM  — isSimulationTag flag for auto-managed tags
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema(
  {
    tagName: {
      type: String,
      required: [true, 'Tag name is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      default: '',
    },
    group: {
      type: String,
      default: 'Default',
    },
    dataType: {
      type: String,
      enum: ['BOOL', 'INT', 'DINT', 'REAL', 'STRING', 'WORD', 'DWORD', 'BYTE'],
      required: true,
      default: 'INT',
    },
    plcConnection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PLCConnection',
      required: false,
    },
    plcAddress: {
      type: String,
      default: '',
    },
    accessType: {
      type: String,
      enum: ['READ', 'WRITE', 'READ_WRITE'],
      default: 'READ_WRITE',
    },
    currentValue: {
      type: mongoose.Schema.Types.Mixed,
      default: 0,
    },
    unit: {
      type: String,
      default: '',
    },
    minValue: {
      type: Number,
      default: 0,
    },
    maxValue: {
      type: Number,
      default: 100,
    },
    enableScaling: {
      type: Boolean,
      default: false,
    },
    rawMin: { type: Number, default: 0 },
    rawMax: { type: Number, default: 32767 },
    scaledMin: { type: Number, default: 0 },
    scaledMax: { type: Number, default: 100 },
    enableLogging: {
      type: Boolean,
      default: false,
    },
    loggingInterval: {
      type: Number,
      default: 1000,
    },
    enableAlarm: {
      type: Boolean,
      default: false,
    },
    quality: {
      type: String,
      enum: ['GOOD', 'BAD', 'UNCERTAIN'],
      default: 'GOOD',
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // ═══════════════════════════════════════════════════════════
    // ✅ SIMULATION: Track auto-managed tags
    // ═══════════════════════════════════════════════════════════
    isSimulationTag: {
      type: Boolean,
      default: false,
    },
    // Which simulation pattern to use (sine, walk, ramp, toggle, counter)
    simulationPattern: {
      type: String,
      enum: ['sine', 'walk', 'ramp', 'toggle', 'counter', 'none'],
      default: 'none',
    },
    // When user writes to a sim tag, we pause updates for 5s to let their value show
    simulationPausedUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast searches
tagSchema.index({ tagName: 1 });
tagSchema.index({ group: 1 });
tagSchema.index({ plcConnection: 1, isSimulationTag: 1 }); // Fast cleanup

module.exports = mongoose.model('Tag', tagSchema);