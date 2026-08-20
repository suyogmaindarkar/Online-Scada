// ═══════════════════════════════════════════════════════════
// Lead Model — Demo requests & sales inquiries from landing site
// Stored in main MongoDB (no companyId — leads are pre-signup)
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema(
  {
    // ─── Contact info ───
    companyName:  { type: String, required: [true, 'Company name is required'], trim: true },
    contactName:  { type: String, required: [true, 'Contact name is required'], trim: true },
    email:        {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },
    phone:        { type: String, default: '', trim: true },
    country:      { type: String, default: '', trim: true },

    // ─── Business info ───
    companySize: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '500+', 'unknown'],
      default: 'unknown',
    },
    industry:    { type: String, default: '', trim: true },
    planInterest: {
      type: String,
      enum: ['trial', 'starter', 'pro', 'enterprise', 'not_sure'],
      default: 'not_sure',
    },
    numPLCs:     { type: String, default: '', trim: true },
    numUsers:    { type: String, default: '', trim: true },

    // ─── Free-text ───
    message: { type: String, default: '', trim: true, maxlength: 2000 },
    source:  { type: String, default: 'landing_form' }, // 'landing_form' | 'contact_sales' | 'demo_request'

    // ─── Metadata ───
    ipAddress:  { type: String, default: '' },
    userAgent:  { type: String, default: '' },
    referrer:   { type: String, default: '' },

    // ─── CRM tracking ───
    status: {
      type: String,
      enum: ['new', 'contacted', 'demo_scheduled', 'converted', 'closed_lost', 'spam'],
      default: 'new',
      index: true,
    },
    notes:            { type: String, default: '' }, // internal notes from Suyog
    contactedAt:      { type: Date, default: null },
    convertedAt:      { type: Date, default: null },
    convertedCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes
leadSchema.index({ email: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);