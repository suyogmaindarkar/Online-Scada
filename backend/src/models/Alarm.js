// ═══════════════════════════════════════════════════════════
// Alarm Model — Multi-Tenant Update
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const alarmSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    alarmName: {
      type: String,
      required: [true, 'Alarm name is required'],
      trim: true,
    },
    description: { type: String, default: '' },
    tag:         { type: String, required: true },
    alarmType: {
      type: String,
      enum: ['HIGH', 'HIGH_HIGH', 'LOW', 'LOW_LOW', 'EQUAL', 'NOT_EQUAL', 'DEVIATION', 'DIGITAL'],
      required: true,
    },
    setpoint:  { type: Number, default: 0 },
    deadband:  { type: Number, default: 0 },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    message:  { type: String, default: '' },
    group:    { type: String, default: 'Default' },

    isActive:        { type: Boolean, default: false },
    isAcknowledged:  { type: Boolean, default: false },
    acknowledgedBy:  { type: String, default: null },
    acknowledgedAt:  { type: Date },
    triggeredAt:     { type: Date },
    clearedAt:       { type: Date },

    enableEmail:      { type: Boolean, default: false },
    emailRecipients:  { type: [String], default: [] },
    lastEmailSentAt:  { type: Date, default: null },
    emailThrottleMinutes: { type: Number, default: 15 },

    enableSMS:     { type: Boolean, default: false },
    soundEnabled:  { type: Boolean, default: true },
    isEnabled:     { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Alarm name unique WITHIN a company
alarmSchema.index({ companyId: 1, alarmName: 1 }, { unique: true });

module.exports = mongoose.model('Alarm', alarmSchema);