// ═══════════════════════════════════════════════════════════
// Settings Model — Multi-Tenant Update
// ONE settings document PER COMPANY (was one global)
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      unique: true, // one settings doc per company
      index: true,
    },

    appearance: {
      canvasDefaultBg:      { type: String,  default: '#ffffff' },
      canvasDefaultWidth:   { type: Number,  default: 1280 },
      canvasDefaultHeight:  { type: Number,  default: 720 },
      gridSize:             { type: Number,  default: 10 },
      showGrid:             { type: Boolean, default: true },
      dashboardRefreshRate: { type: Number,  default: 1000 },
      dateFormat:           { type: String,  default: 'DD/MM/YYYY' },
      timeFormat:           { type: String,  default: '24h' },
    },

    notifications: {
      enableBrowserNotifications: { type: Boolean, default: true },
      enableSoundAlerts:          { type: Boolean, default: true },
      alarmSoundVolume:           { type: Number,  default: 70 },
      notificationTimeout:        { type: Number,  default: 5000 },
      criticalAlarmsOnly:         { type: Boolean, default: false },
      showSuccessMessages:        { type: Boolean, default: true },
    },

    system: {
      defaultPollingRate:  { type: Number,  default: 1000 },
      sessionTimeout:      { type: Number,  default: 60 },
      maxConcurrentUsers:  { type: Number,  default: 10 },
      autoStartPLCs:       { type: Boolean, default: true },
      enableDebugMode:     { type: Boolean, default: false },
      systemName:          { type: String,  default: 'OnlineSCADA' },
      companyName:         { type: String,  default: '' },
    },

    dataManagement: {
      trendDataRetention:    { type: Number,  default: 30 },
      alarmHistoryRetention: { type: Number,  default: 90 },
      autoCleanupEnabled:    { type: Boolean, default: false },
      cleanupSchedule:       { type: String,  default: 'weekly' },
      lastCleanup:           { type: Date },
    },

    security: {
      minPasswordLength:    { type: Number,  default: 6 },
      requireUppercase:     { type: Boolean, default: false },
      requireNumbers:       { type: Boolean, default: false },
      requireSpecialChars:  { type: Boolean, default: false },
      sessionDuration:      { type: Number,  default: 24 },
      maxLoginAttempts:     { type: Number,  default: 5 },
      lockoutDuration:      { type: Number,  default: 15 },
    },

    email: {
      enabled:      { type: Boolean, default: false },
      smtpHost:     { type: String,  default: '' },
      smtpPort:     { type: Number,  default: 587 },
      smtpSecure:   { type: Boolean, default: false },
      smtpUser:     { type: String,  default: '' },
      smtpPassword: { type: String,  default: '' },
      fromEmail:    { type: String,  default: '' },
      fromName:     { type: String,  default: 'OnlineSCADA' },
    },

    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// ─── Helper: Get or create settings for a company ─────────
settingsSchema.statics.getSettingsForCompany = async function (companyId) {
  let settings = await this.findOne({ companyId });
  if (!settings) {
    settings = await this.create({ companyId });
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);