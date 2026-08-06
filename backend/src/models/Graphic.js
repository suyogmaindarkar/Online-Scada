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
    elements: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    directConnections: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    // ─── Screen type flags ───
    isStartupScreen: {
      type: Boolean,
      default: false,
      index: true,
    },
    // ✅ NEW: Template screen — elements auto-appear on all regular screens
    isTemplate: {
      type: Boolean,
      default: false,
      index: true,
    },
    // ✅ NEW: Popup screen — rendered as modal overlay in runtime
    isPopup: {
      type: Boolean,
      default: false,
      index: true,
    },
    // ✅ NEW: Popup-specific settings
    popupModal: {
      type: Boolean,
      default: true, // true = blocks interaction with underlying screen
    },
    popupCloseable: {
      type: Boolean,
      default: true, // true = show close button in top-right
    },
    popupCloseOnBackdrop: {
      type: Boolean,
      default: true, // true = clicking backdrop closes popup
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