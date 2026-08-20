// ═══════════════════════════════════════════════════════════
// UserActivityLog Model — Multi-Tenant Update
// Each activity log entry belongs to a company
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const userActivityLogSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      index: true,
    },
    userRole: { type: String, default: 'unknown' },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
        'WORKSPACE_LOGIN', 'WORKSPACE_LOGIN_FAILED', 'WORKSPACE_LOGOUT',
        'TAG_CREATED', 'TAG_UPDATED', 'TAG_DELETED', 'TAG_WRITE',
        'PLC_CREATED', 'PLC_UPDATED', 'PLC_DELETED', 'PLC_STARTED', 'PLC_STOPPED',
        'ALARM_CREATED', 'ALARM_UPDATED', 'ALARM_DELETED', 'ALARM_ACKNOWLEDGED',
        'RECIPE_CREATED', 'RECIPE_UPDATED', 'RECIPE_DELETED', 'RECIPE_EXECUTED',
        'SCREEN_CREATED', 'SCREEN_UPDATED', 'SCREEN_DELETED',
        'SETTINGS_UPDATED', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
        'CSV_IMPORT', 'CSV_EXPORT', 'BACKUP_CREATED', 'BACKUP_RESTORED',
        'OTHER',
      ],
      index: true,
    },
    target:       { type: String, default: '' },
    description:  { type: String, default: '' },
    metadata:     { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress:    { type: String, default: '' },
    userAgent:    { type: String, default: '' },
    success:      { type: Boolean, default: true },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

userActivityLogSchema.index({ companyId: 1, createdAt: -1 });
userActivityLogSchema.index({ companyId: 1, username: 1, createdAt: -1 });
userActivityLogSchema.index({ companyId: 1, action:   1, createdAt: -1 });

module.exports = mongoose.model('UserActivityLog', userActivityLogSchema);