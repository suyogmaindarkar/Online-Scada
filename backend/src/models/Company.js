const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'],
      minlength: 3,
      maxlength: 30,
    },
    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    contactPhone: { type: String, default: '' },
    contactName: { type: String, default: '' },

    plan: {
      type: String,
      enum: ['trial', 'starter', 'pro', 'enterprise'],
      default: 'trial',
    },
    limits: {
      maxUsers: { type: Number, default: 3 },
      maxPLCs: { type: Number, default: 1 },
      maxTags: { type: Number, default: 50 },
      maxScreens: { type: Number, default: 5 },
      maxAlarms: { type: Number, default: 20 },
      maxGateways: { type: Number, default: 1 },
    },

    // ─── Edge Gateway Feature Toggle ─────────────────────
    edgeApiEnabled: {
      type: Boolean,
      default: true,
    },

    trialEndsAt: {
      type: Date,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    suspensionReason: {
      type: String,
      default: '',
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SuperAdmin',
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
    logoUrl: { type: String, default: '' },
    timezone: { type: String, default: 'UTC' },
    country: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

// ─── Auto-set plan limits when plan changes (async hook — NO next) ───
companySchema.pre('save', async function () {
  if (this.isModified('plan')) {
    const planLimits = {
      trial: { maxUsers: 3, maxPLCs: 1, maxTags: 50, maxScreens: 5, maxAlarms: 20, maxGateways: 1 },
      starter: { maxUsers: 5, maxPLCs: 3, maxTags: 500, maxScreens: 20, maxAlarms: 100, maxGateways: 2 },
      pro: { maxUsers: 15, maxPLCs: 10, maxTags: 5000, maxScreens: 100, maxAlarms: 500, maxGateways: 5 },
      enterprise: { maxUsers: 999, maxPLCs: 999, maxTags: 999999, maxScreens: 99999, maxAlarms: 9999, maxGateways: 999 },
    };
    if (planLimits[this.plan]) {
      this.limits = planLimits[this.plan];
    }
  }
});

// ─── Helper: Check if company is expired ──────────────────
companySchema.methods.isExpired = function () {
  const now = new Date();
  if (this.plan === 'trial' && this.trialEndsAt && this.trialEndsAt < now) return true;
  if (this.subscriptionExpiresAt && this.subscriptionExpiresAt < now) return true;
  return false;
};

// ─── Helper: Check if company can access system ───────────
companySchema.methods.canAccess = function () {
  return this.isActive && !this.isSuspended && !this.isExpired();
};

module.exports = mongoose.model('Company', companySchema);