// ============================================================================
// TelemetryLog Model - MongoDB Time Series Collection
// Includes Automatic TTL (Time-To-Live) index to protect MongoDB Free Tier.
// ============================================================================

const mongoose = require('mongoose');

// Default retention period: 7 days in seconds (7 * 24 * 60 * 60)
const RETENTION_SECONDS = parseInt(process.env.LOG_RETENTION_DAYS || '7', 10) * 24 * 60 * 60;

const telemetryLogSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        required: true,
        default: Date.now,
        expires: RETENTION_SECONDS // Automatically deletes documents older than retention window
    },
    meta: {
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company',
            required: true
        },
        tagId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tag',
            required: true
        }
    },
    value: {
        type: Number,
        required: true
    },
    quality: {
        type: String,
        enum: ['GOOD', 'BAD', 'UNCERTAIN'],
        default: 'GOOD'
    }
}, {
    timeseries: {
        timeField: 'timestamp',
        metaField: 'meta',
        granularity: 'seconds'
    }
});

// Index for fast tenant querying
telemetryLogSchema.index({ 'meta.companyId': 1, 'meta.tagId': 1, timestamp: -1 });

module.exports = mongoose.model('TelemetryLog', telemetryLogSchema);