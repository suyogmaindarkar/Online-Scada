// ═══════════════════════════════════════════════════════════
// RecipeLog Model — Execution history
//
// Task Bundle applied:
//   ✅ T052  — Recipe execution log (every execution recorded)
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const recipeLogSchema = new mongoose.Schema(
  {
    // Recipe info at time of execution
    recipeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recipe',
    },
    recipeName: {
      type: String,
      required: true,
    },
    recipeVersion: {
      type: String,
      default: '1.0',
    },
    category: {
      type: String,
      default: 'Default',
    },

    // Who executed it
    executedBy: {
      type: String,
      required: true,
    },
    executedAt: {
      type: Date,
      default: Date.now,
    },

    // Result stats
    status: {
      type: String,
      enum: ['SUCCESS', 'PARTIAL', 'FAILED', 'CANCELLED'],
      default: 'SUCCESS',
    },
    totalParameters: {
      type: Number,
      default: 0,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },

    // Duration in milliseconds
    durationMs: {
      type: Number,
      default: 0,
    },

    // Detailed per-parameter results
    results: {
      success: [
        {
          tagName: String,
          value: mongoose.Schema.Types.Mixed,
        },
      ],
      failed: [
        {
          tagName: String,
          reason: String,
        },
      ],
    },

    // Snapshot of parameters at execution time (for audit)
    parametersSnapshot: [
      {
        tagName: String,
        value: mongoose.Schema.Types.Mixed,
        unit: String,
      },
    ],

    // Optional note/reason for execution
    note: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast querying
recipeLogSchema.index({ executedAt: -1 });
recipeLogSchema.index({ recipeId: 1, executedAt: -1 });
recipeLogSchema.index({ executedBy: 1 });
recipeLogSchema.index({ status: 1 });

module.exports = mongoose.model('RecipeLog', recipeLogSchema);