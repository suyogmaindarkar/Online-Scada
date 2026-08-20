// ═══════════════════════════════════════════════════════════
// Graphic Model — Multi-Tenant Update
// ✅ Added companyId
// ✅ screenName unique WITHIN a company
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const graphicSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    screenName: {
      type: String,
      required: [true, 'Screen name is required'],
      trim: true,
    },
    description:     { type: String, default: '' },
    width:           { type: Number, default: 1920 },
    height:          { type: Number, default: 1080 },
    backgroundColor: { type: String, default: '#ffffff' },
    elements:          { type: [mongoose.Schema.Types.Mixed], default: [] },
    directConnections: { type: [mongoose.Schema.Types.Mixed], default: [] },

    isStartupScreen: { type: Boolean, default: false, index: true },
    isTemplate:      { type: Boolean, default: false, index: true },
    isPopup:         { type: Boolean, default: false, index: true },
    popupModal:            { type: Boolean, default: true  },
    popupCloseable:        { type: Boolean, default: true  },
    popupCloseOnBackdrop:  { type: Boolean, default: true  },

    accessLevel: {
      type: String,
      enum: ['admin', 'engineer', 'operator', 'viewer'],
      default: 'viewer',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, minimize: false }
);

// Screen name unique WITHIN a company
graphicSchema.index({ companyId: 1, screenName: 1 }, { unique: true });

module.exports = mongoose.model('Graphic', graphicSchema);