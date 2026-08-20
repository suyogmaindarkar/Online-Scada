// ═══════════════════════════════════════════════════════════
// AlarmHistory Model — Multi-Tenant Update
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const alarmHistorySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    alarmName:    String,
    tag:          String,
    triggerValue: Number,
    priority:     String,
    message:      String,
    event: {
      type: String,
      enum: ['TRIGGERED', 'ACKNOWLEDGED', 'CLEARED'],
    },
    user:      String,
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

alarmHistorySchema.index({ companyId: 1, timestamp: -1 });
alarmHistorySchema.index({ companyId: 1, alarmName: 1 });

module.exports = mongoose.model('AlarmHistory', alarmHistorySchema);