// ═══════════════════════════════════════════════════════════
// EdgeGateway Model — Cloud ↔ Factory Bridge
//
// Each company gets one or more Edge Gateways that run on
// the factory floor and push PLC data to the cloud via WSS.
//
// Security:
//   - apiKey is stored as SHA-256 hash (never plain text)
//   - apiKeyPrefix shows first 8 chars for identification
//   - companyId scopes all queries (multi-tenant)
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const edgeGatewaySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },

    name: {
      type: String,
      required: [true, 'Gateway name is required'],
      trim: true,
      default: 'Default Gateway',
    },

    // ─── API Key (SHA-256 hashed, never stored in plain text) ───
    apiKeyHash: {
      type: String,
      required: true,
      select: false, // Never returned in queries by default
    },

    // ─── Display prefix so user can identify the key ───
    // e.g. "eg_a3f8b2c1" (first 11 chars of raw key)
    apiKeyPrefix: {
      type: String,
      required: true,
    },

    // ─── Connection Status ───
    status: {
      type: String,
      enum: ['online', 'offline', 'never_connected'],
      default: 'never_connected',
    },

    lastHeartbeat: {
      type: Date,
      default: null,
    },

    // ─── Gateway Metadata ───
    ipAddress: {
      type: String,
      default: '',
    },

    version: {
      type: String,
      default: '',
    },

    hostname: {
      type: String,
      default: '',
    },

    os: {
      type: String,
      default: '',
    },

    // ─── PLC Connections managed by this gateway ───
    plcConnections: [
      {
        plcId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'PLCConnection',
        },
        protocol: {
          type: String,
          enum: ['s7', 'modbus', 'opcua', 'simulation'],
          required: true,
        },
        plcIp: {
          type: String,
          required: true,
        },
        port: {
          type: Number,
          required: true,
        },
        rack: {
          type: Number,
          default: 0,
        },
        slot: {
          type: Number,
          default: 0,
        },
        pollIntervalMs: {
          type: Number,
          default: 500,
          min: 50,
          max: 10000,
        },
        tags: [
          {
            tagId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'Tag',
            },
            address: {
              type: String,
              required: true,
            },
            dataType: {
              type: String,
              enum: ['BOOL', 'INT', 'DINT', 'REAL', 'STRING', 'WORD', 'DWORD', 'BYTE'],
              required: true,
            },
          },
        ],
      },
    ],

    // ─── Stats (updated by heartbeat) ───
    stats: {
      uptimeSeconds: { type: Number, default: 0 },
      tagsReadPerSecond: { type: Number, default: 0 },
      memoryUsageMB: { type: Number, default: 0 },
      cpuPercent: { type: Number, default: 0 },
      totalReads: { type: Number, default: 0 },
      totalErrors: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// ─── Compound Indexes ─────────────────────────────────────
edgeGatewaySchema.index({ companyId: 1, name: 1 }, { unique: true });
edgeGatewaySchema.index({ companyId: 1, apiKeyPrefix: 1 }, { unique: true });

// ─── Static: Hash an API key ─────────────────────────────
const crypto = require('crypto');

edgeGatewaySchema.statics.hashApiKey = function (rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
};

// ─── Static: Generate a new raw API key ──────────────────
edgeGatewaySchema.statics.generateApiKey = function () {
  const raw = 'eg_' + crypto.randomBytes(28).toString('hex'); // 59 chars total
  return {
    rawKey: raw,
    hash: this.hashApiKey(raw),
    prefix: raw.substring(0, 11), // "eg_a3f8b2c1"
  };
};

// ─── Instance: Verify a raw API key against stored hash ──
edgeGatewaySchema.methods.verifyApiKey = function (rawKey) {
  const incomingHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  return incomingHash === this.apiKeyHash;
};

module.exports = mongoose.model('EdgeGateway', edgeGatewaySchema);