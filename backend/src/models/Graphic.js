const mongoose = require('mongoose');

const graphicSchema = new mongoose.Schema(
  {
    screenName: {
      type: String,
      required: [true, 'Screen name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    width: {
      type: Number,
      default: 1920,
    },
    height: {
      type: Number,
      default: 1080,
    },
    backgroundColor: {
      type: String,
      default: '#ffffff',
    },
    // ═══════════════════════════════════════════════════════════
    // Elements — FLEXIBLE schema (no strict enum)
    // ═══════════════════════════════════════════════════════════
    elements: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    // ═══════════════════════════════════════════════════════════
    // Direct Connections — Sprint D2
    // Auto-copy value from source to target on trigger
    // ═══════════════════════════════════════════════════════════
    directConnections: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    // Screen settings
    isStartupScreen: {
      type: Boolean,
      default: false,
    },
    accessLevel: {
      type: String,
      enum: ['admin', 'engineer', 'operator', 'viewer'],
      default: 'viewer',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

module.exports = mongoose.model('Graphic', graphicSchema);