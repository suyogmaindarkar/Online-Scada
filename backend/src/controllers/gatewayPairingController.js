// ═══════════════════════════════════════════════════════════
// Gateway Pairing Controller — Factory Connector Install Flow
//
// Flow:
//   1. Admin clicks "Install Factory Connector" → createPairing()
//   2. Connector installer calls redeemPairing() with the code
//   3. Admin UI polls getPairingStatus()
//
// Multi-tenant: codes are company-scoped + one-time + short-lived.
// The redeem endpoint is PUBLIC (connector has no token yet) but the
// code itself IS the credential gate — a valid, unexpired, pending code.
// ═══════════════════════════════════════════════════════════

const PairingSession = require('../models/PairingSession');
const EdgeGateway = require('../models/EdgeGateway');

const PAIRING_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Step 1: Admin creates a fresh pairing code ───────────
const createPairing = async (req, res) => {
  try {
    const companyId = req.companyId;

    // Expire any older pending codes for this company (one active code at a time)
    await PairingSession.updateMany(
      { companyId, status: 'pending' },
      { status: 'expired' }
    );

    const code = PairingSession.generateCode();
    const session = await PairingSession.create({
      companyId,
      code,
      createdBy: req.user?._id || null,
      expiresAt: new Date(Date.now() + PAIRING_TTL_MS),
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Pairing code created. Enter it in the Factory Connector installer.',
      data: {
        pairingId: session._id,
        code: session.code,
        expiresAt: session.expiresAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Step 2: Connector redeems a code (PUBLIC — no token) ──
// Called by the installed connector during first pairing.
const redeemPairing = async (req, res) => {
  try {
    const { code, os, hostname } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'Pairing code is required' });
    }

    const normalized = code.trim().toUpperCase();
    const session = await PairingSession.findOne({ code: normalized });

    if (!session) {
      return res.status(404).json({ success: false, code: 'INVALID_CODE', message: 'Pairing code not found' });
    }

    if (!session.isValid()) {
      await PairingSession.updateOne({ _id: session._id, status: 'pending' }, { status: 'expired' });
      return res.status(410).json({ success: false, code: 'CODE_EXPIRED', message: 'Pairing code has expired. Generate a new one from the website.' });
    }

    if (session.status === 'used') {
      return res.status(410).json({ success: false, code: 'CODE_USED', message: 'Pairing code already used' });
    }

    // ── Issue/activate gateway credential for this company ──
    // If a gateway already exists for this company, re-use it (rotate key).
    // Otherwise create one. The connector receives the raw key ONCE.
    let gateway = session.gatewayId
      ? await EdgeGateway.findOne({ _id: session.gatewayId, companyId: session.companyId })
      : null;

    let rotate = false;
    if (!gateway) {
      // Check for an existing gateway profile to pair with
      gateway = await EdgeGateway.findOne({ companyId: session.companyId });
    }

    if (!gateway) {
      gateway = await EdgeGateway.create({
        companyId: session.companyId,
        name: 'Factory Connector',
        apiKeyHash: 'pending', // replaced below
        apiKeyPrefix: 'PENDING',
        status: 'never_connected',
      });
      rotate = true;
    } else {
      rotate = true;
    }

    const { rawKey, hash, prefix } = EdgeGateway.generateApiKey();
    gateway.apiKeyHash = hash;
    gateway.apiKeyPrefix = prefix;
    gateway.status = 'never_connected';
    await gateway.save();

    // Mark session used
    session.status = 'used';
    session.gatewayId = gateway._id;
    session.usedAt = new Date();
    session.pairedByOs = os || '';
    session.pairedByHostname = hostname || '';
    await session.save();

    // Return credentials ONCE — after this the raw key is gone forever
    res.json({
      success: true,
      message: 'Factory Connector paired successfully',
      data: {
        gatewayId: gateway._id,
        companyId: String(session.companyId),
        apiKey: rawKey, // shown exactly once
        apiKeyPrefix: prefix,
        cloudUrl: (process.env.BACKEND_URL || '').replace(/\/+$/, '') || null,
        namespace: '/edge',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Step 3: Admin reads current pairing state ────────────
const getPairingStatus = async (req, res) => {
  try {
    const sessions = await PairingSession.find({ companyId: req.companyId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('code status expiresAt usedAt gatewayId createdAt')
      .lean();

    const active = sessions.find((s) => s.status === 'pending' && new Date(s.expiresAt).getTime() > Date.now());
    const used = sessions.find((s) => s.status === 'used');

    res.json({
      success: true,
      data: {
        sessions,
        activeCode: active ? { code: active.code, expiresAt: active.expiresAt } : null,
        paired: Boolean(used),
        gatewayId: used ? used.gatewayId : null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createPairing, redeemPairing, getPairingStatus };
