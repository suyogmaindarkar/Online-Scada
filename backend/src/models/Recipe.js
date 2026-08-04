// ═══════════════════════════════════════════════════════════
// Recipe Model
//
// Task Bundle applied:
//   ✅ T053  — Versioning: auto-bumped, parent tracking
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema(
  {
    recipeName: {
      type: String,
      required: [true, 'Recipe name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: 'Default',
    },
    // Recipe parameters (tag → value mapping)
    parameters: [
      {
        tagName: String,
        value: mongoose.Schema.Types.Mixed,
        unit: String,
        description: String,
      },
    ],
    version: {
      type: String,
      default: '1.0',
    },
    // ✅ T053: Track auto-increment version number for easier bumping
    versionNumber: {
      type: Number,
      default: 1,
    },
    // ✅ T053: Track version history (previous versions of this recipe)
    versionHistory: [
      {
        version: String,
        parameters: [
          {
            tagName: String,
            value: mongoose.Schema.Types.Mixed,
            unit: String,
            description: String,
          },
        ],
        savedAt: Date,
        savedBy: String,
        changeNote: String,
      },
    ],
    createdBy: {
      type: String,
      default: 'admin',
    },
    // Track last modified
    lastModifiedBy: {
      type: String,
      default: null,
    },
    lastExecutedAt: {
      type: Date,
      default: null,
    },
    lastExecutedBy: {
      type: String,
      default: null,
    },
    executionCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster history queries
recipeSchema.index({ createdAt: -1 });
recipeSchema.index({ category: 1 });

module.exports = mongoose.model('Recipe', recipeSchema);