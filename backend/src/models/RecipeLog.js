// ═══════════════════════════════════════════════════════════
// RecipeLog Model — Multi-Tenant Update
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const recipeLogSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    recipeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recipe',
    },
    recipeName:    { type: String, required: true },
    recipeVersion: { type: String, default: '1.0' },
    category:      { type: String, default: 'Default' },
    executedBy:    { type: String, required: true },
    executedAt:    { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['SUCCESS', 'PARTIAL', 'FAILED', 'CANCELLED'],
      default: 'SUCCESS',
    },
    totalParameters: { type: Number, default: 0 },
    successCount:    { type: Number, default: 0 },
    failedCount:     { type: Number, default: 0 },
    durationMs:      { type: Number, default: 0 },
    results: {
      success: [{ tagName: String, value: mongoose.Schema.Types.Mixed }],
      failed:  [{ tagName: String, reason: String }],
    },
    parametersSnapshot: [
      { tagName: String, value: mongoose.Schema.Types.Mixed, unit: String },
    ],
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

recipeLogSchema.index({ companyId: 1, executedAt: -1 });
recipeLogSchema.index({ companyId: 1, recipeId:   1, executedAt: -1 });
recipeLogSchema.index({ companyId: 1, executedBy: 1 });
recipeLogSchema.index({ companyId: 1, status:     1 });

module.exports = mongoose.model('RecipeLog', recipeLogSchema);