const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    // Single document strategy - only one settings document exists
    settingKey: {
      type: String,
      default: 'main',
      unique: true,
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // APPEARANCE SETTINGS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    appearance: {
      canvasDefaultBg: { type: String, default: '#ffffff' },
      canvasDefaultWidth: { type: Number, default: 1280 },
      canvasDefaultHeight: { type: Number, default: 720 },
      gridSize: { type: Number, default: 10 },
      showGrid: { type: Boolean, default: true },
      dashboardRefreshRate: { type: Number, default: 1000 },
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
      timeFormat: { type: String, default: '24h' },
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // NOTIFICATION SETTINGS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    notifications: {
      enableBrowserNotifications: { type: Boolean, default: true },
      enableSoundAlerts: { type: Boolean, default: true },
      alarmSoundVolume: { type: Number, default: 70 },
      notificationTimeout: { type: Number, default: 5000 },
      criticalAlarmsOnly: { type: Boolean, default: false },
      showSuccessMessages: { type: Boolean, default: true },
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SYSTEM SETTINGS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    system: {
      defaultPollingRate: { type: Number, default: 1000 },
      sessionTimeout: { type: Number, default: 60 },
      maxConcurrentUsers: { type: Number, default: 10 },
      autoStartPLCs: { type: Boolean, default: true },
      enableDebugMode: { type: Boolean, default: false },
      systemName: { type: String, default: 'WebSCADA System' },
      companyName: { type: String, default: 'Your Company' },
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DATA MANAGEMENT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    dataManagement: {
      trendDataRetention: { type: Number, default: 30 }, // days
      alarmHistoryRetention: { type: Number, default: 90 }, // days
      autoCleanupEnabled: { type: Boolean, default: false },
      cleanupSchedule: { type: String, default: 'weekly' },
      lastCleanup: { type: Date },
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SECURITY SETTINGS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    security: {
      minPasswordLength: { type: Number, default: 6 },
      requireUppercase: { type: Boolean, default: false },
      requireNumbers: { type: Boolean, default: false },
      requireSpecialChars: { type: Boolean, default: false },
      sessionDuration: { type: Number, default: 24 }, // hours
      maxLoginAttempts: { type: Number, default: 5 },
      lockoutDuration: { type: Number, default: 15 }, // minutes
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EMAIL SETTINGS (Disabled for now)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    email: {
      enabled: { type: Boolean, default: false },
      smtpHost: { type: String, default: '' },
      smtpPort: { type: Number, default: 587 },
      smtpSecure: { type: Boolean, default: false },
      smtpUser: { type: String, default: '' },
      smtpPassword: { type: String, default: '' },
      fromEmail: { type: String, default: '' },
      fromName: { type: String, default: 'WebSCADA System' },
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // METADATA
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Helper static method to get or create settings
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ settingKey: 'main' });
  if (!settings) {
    settings = await this.create({ settingKey: 'main' });
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
