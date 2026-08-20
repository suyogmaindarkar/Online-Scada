// ═══════════════════════════════════════════════════════════
// Recipe Model — Multi-Tenant Update
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    recipeName: {
      type: String,
      required: [true, 'Recipe name is required'],
      trim: true,
    },
    description: { type: String, default: '' },
    category:    { type: String, default: 'Default' },
    parameters: [
      {
        tagName:     String,
        value:       mongoose.Schema.Types.Mixed,
        unit:        String,
        description: String,
      },
    ],
    version:       { type: String, default: '1.0' },
    versionNumber: { type: Number, default: 1 },
    versionHistory: [
      {
        version: String,
        parameters: [
          {
            tagName:     String,
            value:       mongoose.Schema.Types.Mixed,
            unit:        String,
            description: String,
          },
        ],
        savedAt:    Date,
        savedBy:    String,
        changeNote: String,
      },
    ],
    createdBy:        { type: String, default: 'admin' },
    lastModifiedBy:   { type: String, default: null },
    lastExecutedAt:   { type: Date, default: null },
    lastExecutedBy:   { type: String, default: null },
    executionCount:   { type: Number, default: 0 },
    isActive:         { type: Boolean, default: true },
  },
  { timestamps: true }
);

recipeSchema.index({ companyId: 1, recipeName: 1 }, { unique: true });
recipeSchema.index({ companyId: 1, createdAt: -1 });
recipeSchema.index({ companyId: 1, category:  1 });

module.exports = mongoose.model('Recipe', recipeSchema);