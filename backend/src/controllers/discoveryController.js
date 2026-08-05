// ═══════════════════════════════════════════════════════════
// Discovery Controller — API endpoints for PLC network scanning
// Phase 2: added /probe endpoint for single-IP deep identification
// ═══════════════════════════════════════════════════════════

const discoveryService = require('../services/discoveryService');

// ─────────────────────────────────────────
// POST /api/discovery/scan
// Body: { startIP?, endIP?, networkIndex?, timeout?, concurrency?, deepProbe? }
// ─────────────────────────────────────────
const startScan = async (req, res) => {
  try {
    const {
      startIP,
      endIP,
      networkIndex,
      timeout,
      concurrency,
      deepProbe,        // NEW: boolean — default true
    } = req.body || {};

    const result = await discoveryService.discover({
      startIP,
      endIP,
      networkIndex: networkIndex || 0,
      timeout:      timeout      || 1500,
      concurrency:  concurrency  || 30,
      deepProbe:    deepProbe !== false,  // default true
    });

    res.json(result);
  } catch (error) {
    console.error('Discovery scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Discovery scan failed',
      error:   error.message,
    });
  }
};

// ─────────────────────────────────────────
// POST /api/discovery/probe            ← NEW (Phase 2)
// Body: { ip, ports? }
// Deep-probes a SINGLE IP using all protocol probes.
// Used by the "Re-probe" button in the UI on existing cards.
// ─────────────────────────────────────────
const probeDevice = async (req, res) => {
  try {
    const { ip, ports } = req.body || {};

    if (!ip) {
      return res.status(400).json({
        success: false,
        message: 'IP address is required',
      });
    }

    // Basic IP format validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid IP address format',
      });
    }

    console.log(`🔬 Deep probing ${ip}${ports ? ` (ports: ${ports.join(',')})` : ''}`);

    const result = await discoveryService.probeDevice(ip, ports || null);

    res.json({
      success: true,
      device:  result,
    });
  } catch (error) {
    console.error('Device probe error:', error);
    res.status(500).json({
      success: false,
      message: 'Deep probe failed',
      error:   error.message,
    });
  }
};

// ─────────────────────────────────────────
// GET /api/discovery/networks
// ─────────────────────────────────────────
const getNetworks = async (req, res) => {
  try {
    const networks = discoveryService.getNetworkInfo();
    res.json({ success: true, networks });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get network info',
      error:   error.message,
    });
  }
};

// ─────────────────────────────────────────
// GET /api/discovery/progress
// ─────────────────────────────────────────
const getProgress = async (req, res) => {
  res.json({ success: true, ...discoveryService.getProgress() });
};

// ─────────────────────────────────────────
// POST /api/discovery/cancel
// ─────────────────────────────────────────
const cancelScan = async (req, res) => {
  discoveryService.cancel();
  res.json({ success: true, message: 'Scan cancelled' });
};

module.exports = {
  startScan,
  probeDevice,
  getNetworks,
  getProgress,
  cancelScan,
};