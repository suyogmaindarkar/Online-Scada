// ═══════════════════════════════════════════════════════════
// Alarm Model
//
// Task Bundle applied:
//   ✅ T019  — Email recipient fields (emailRecipients, lastEmailSentAt)
//   ✅ T018  — soundEnabled flag (per-alarm sound override)
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const alarmSchema = new mongoose.Schema(
  {
    alarmName: {
      type: String,
      required: [true, 'Alarm name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    // Linked Tag
    tag: {
      type: String,
      required: true,
    },
    // Alarm Type
    alarmType: {
      type: String,
      enum: ['HIGH', 'HIGH_HIGH', 'LOW', 'LOW_LOW', 'EQUAL', 'NOT_EQUAL', 'DEVIATION', 'DIGITAL'],
      required: true,
    },
    setpoint: {
      type: Number,
      default: 0,
    },
    deadband: {
      type: Number,
      default: 0,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    message: {
      type: String,
      default: '',
    },
    group: {
      type: String,
      default: 'Default',
    },
    // Current State
    isActive: {
      type: Boolean,
      default: false,
    },
    isAcknowledged: {
      type: Boolean,
      default: false,
    },
    acknowledgedBy: {
      type: String,
      default: null,
    },
    acknowledgedAt: {
      type: Date,
    },
    triggeredAt: {
      type: Date,
    },
    clearedAt: {
      type: Date,
    },

    // ─── T019: Email settings ────────────────────────────────
    enableEmail: {
      type: Boolean,
      default: false,
    },
    // ✅ NEW: List of email addresses to notify
    emailRecipients: {
      type: [String],
      default: [],
    },
    // ✅ NEW: Track last email sent (to avoid spam — rate-limited)
    lastEmailSentAt: {
      type: Date,
      default: null,
    },
    // Minimum minutes between repeat emails for same alarm
    emailThrottleMinutes: {
      type: Number,
      default: 15,
    },

    enableSMS: {
      type: Boolean,
      default: false,
    },

    // ─── T018: Sound settings ─────────────────────────────────
    // ✅ NEW: Per-alarm sound (overrides global setting)
    soundEnabled: {
      type: Boolean,
      default: true,
    },

    isEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Alarm', alarmSchema);