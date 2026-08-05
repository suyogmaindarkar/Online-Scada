// ═══════════════════════════════════════════════════════════
// UserActivityLog Model
//
// Task Bundle applied:
//   ✅ T059  — Track user actions for audit log & reports
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const userActivityLogSchema = new mongoose.Schema(
  {
    // Who did it
    username: {
      type: String,
      required: true,
      index: true,
    },
    userRole: {
      type: String,
      default: 'unknown',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },

    // What they did
    action: {
      type: String,
      required: true,
      enum: [
        'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
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

    // Target of the action (e.g., name of the tag/alarm/recipe affected)
    target: {
      type: String,
      default: '',
    },

    // Human-readable description
    description: {
      type: String,
      default: '',
    },

    // Additional context (JSON blob for flexibility)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Client info
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },

    // Success/Failure
    success: {
      type: Boolean,
      default: true,
    },
    errorMessage: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true, // Adds createdAt + updatedAt
  }
);

// Indexes for efficient querying
userActivityLogSchema.index({ createdAt: -1 });
userActivityLogSchema.index({ username: 1, createdAt: -1 });
userActivityLogSchema.index({ action: 1, createdAt: -1 });

// TTL index — auto-delete logs older than 90 days (adjust as needed)
// Uncomment to enable auto-cleanup:
// userActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('UserActivityLog', userActivityLogSchema);