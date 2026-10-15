// ═══════════════════════════════════════════════════════════
// PairingSession Model — Factory Connector Install/Pairing Flow
//
// Created when an admin clicks "Install Factory Connector". The
// pairing code is short-lived (10 min) and one-time use. After a
// successful pairing, a gateway credential is issued to the
// installed connector so it can authenticate on the /edge namespace.
//
// Multi-tenant: every session is scoped by companyId.
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const pairingSessionSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },

    // Short, human-enterable pairing code, e.g. "ABCD-1234"
    codeHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Lifecycle state
    status: {
      type: String,
      enum: ['pending', 'used', 'expired'],
      default: 'pending',
    },

    // Which gateway this pairing issued/activated
    gatewayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EdgeGateway',
      default: null,
    },

    // Multi-tenant: only the creator workspace can use this code
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    usedAt: {
      type: Date,
      default: null,
    },

    // Diagnostics — connector-reported info at pairing time
    pairedByOs: { type: String, default: '' },
    pairedByHostname: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

// ─── Instance: is this code still valid? ─────────────────
pairingSessionSchema.methods.isValid = function () {
  return (
    this.status === 'pending' &&
    this.expiresAt &&
    new Date(this.expiresAt).getTime() > Date.now()
  );
};

// ─── Static: generate a fresh pairing code ──────────────
pairingSessionSchema.statics.generateCode = function () {
  const part = (len) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars (I/1/O/0)
    let out = '';
    for (let i = 0; i < len; i += 1) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  };
  return `${part(4)}-${part(4)}`;
};

pairingSessionSchema.statics.hashCode = function (code) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');
};

module.exports = mongoose.model('PairingSession', pairingSessionSchema);
