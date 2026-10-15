// ═══════════════════════════════════════════════════════════
// Edge Pairing Model — Temporary 6-Digit Pairing Codes
// ═══════════════════════════════════════════════════════════

const mongoose = require('mongoose');

const edgePairingSchema = new mongoose.Schema(
    {
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company',
            required: true,
            index: true,
        },
        code: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        gatewayId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'EdgeGateway',
            required: true,
        },
        isRedeemed: {
            type: Boolean,
            default: false,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expires: 0 }, // TTL index auto-deletes expired codes
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('EdgePairing', edgePairingSchema);