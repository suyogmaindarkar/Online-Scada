// ═══════════════════════════════════════════════════════════
// AlarmHistory Model — No changes needed
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const alarmHistorySchema = new mongoose.Schema(
  {
    alarmName: String,
    tag: String,
    triggerValue: Number,
    priority: String,
    message: String,
    event: {
      type: String,
      enum: ['TRIGGERED', 'ACKNOWLEDGED', 'CLEARED'],
    },
    user: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

alarmHistorySchema.index({ timestamp: -1 });
alarmHistorySchema.index({ alarmName: 1 });

module.exports = mongoose.model('AlarmHistory', alarmHistorySchema);