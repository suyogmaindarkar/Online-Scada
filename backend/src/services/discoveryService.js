const { randomUUID } = require('crypto');
const { isIPv4 } = require('net');

const activeScans = new Map();
const ACTIVE = new Set(['queued', 'pinging', 'probing']);
const PHASES = new Set([...ACTIVE, 'done', 'failed', 'cancelled']);
const SCAN_TIMEOUT_MS = 120000;

function finish(scan, phase, message) {
    clearTimeout(scan.timer);
    scan.phase = phase;
    scan.message = message || '';
    scan.finishedAt = Date.now();
}

exports.validateOptions = ({ startIP = '', endIP = '', deepProbe = false } = {}) => {
    if (Boolean(startIP) !== Boolean(endIP) || (startIP && (typeof startIP !== 'string' || typeof endIP !== 'string' || !isIPv4(startIP) || !isIPv4(endIP)))) throw Object.assign(new Error('Enter a valid start and end IPv4 address, or leave both blank for the factory subnet'), { status: 400 });
    const numeric = (ip) => ip.split('.').reduce((value, octet) => value * 256 + Number(octet), 0);
    if (startIP && (numeric(endIP) < numeric(startIP) || numeric(endIP) - numeric(startIP) >= 1024)) throw Object.assign(new Error('Scan range must contain between 1 and 1024 addresses'), { status: 400 });
    return { startIP, endIP, deepProbe: deepProbe === true };
};

exports.initiateScan = (companyId, options, gatewayId) => {
    const key = String(companyId);
    const previous = activeScans.get(key);
    if (previous && ACTIVE.has(previous.phase)) throw Object.assign(new Error('A discovery scan is already running'), { status: 409 });
    clearTimeout(previous?.timer);
    const scan = { scanId: randomUUID(), gatewayId: String(gatewayId), phase: 'queued', scannedIPs: 0, aliveHosts: 0, totalIPs: 0, devices: [], startTime: Date.now(), message: '', ...options };
    scan.timer = setTimeout(() => {
        if (ACTIVE.has(scan.phase)) {
            finish(scan, 'failed', 'Factory Connector scan timed out');
            require('./edgeService').sendDiscoveryCommand(key, 'edge:cancelDiscovery', { scanId: scan.scanId }, scan.gatewayId);
        }
    }, SCAN_TIMEOUT_MS);
    scan.timer.unref?.();
    activeScans.set(key, scan);
    return exports.getStatus(key);
};

exports.getStatus = (companyId) => {
    const scan = activeScans.get(String(companyId));
    if (!scan) return { phase: 'idle', devices: [], scannedIPs: 0, aliveHosts: 0, totalIPs: 0 };
    const { timer, gatewayId, ...status } = scan;
    return status;
};

exports.updateStatus = (companyId, data, gatewayId) => {
    const scan = activeScans.get(String(companyId));
    if (!scan || !ACTIVE.has(scan.phase) || data?.scanId !== scan.scanId || String(gatewayId) !== scan.gatewayId || !PHASES.has(data.phase)) return false;
    const results = data.results || {};
    for (const key of ['scannedIPs', 'aliveHosts', 'totalIPs']) {
        if (Number.isInteger(results[key]) && results[key] >= 0 && results[key] <= 1024) scan[key] = Math.max(scan[key], results[key]);
    }
    if (Array.isArray(results.devices)) scan.devices = results.devices.slice(0, 4096).filter((device) => device && typeof device.ip === 'string').map(({ ip, port, protocol, vendorName, confirmed, evidence, supported }) => ({ ip, port, protocol, vendorName, confirmed: confirmed === true, evidence, supported: supported === true }));
    scan.phase = data.phase;
    if (!ACTIVE.has(data.phase)) finish(scan, data.phase, typeof data.message === 'string' ? data.message.slice(0, 300) : '');
    return true;
};

exports.cancelScan = (companyId, message = 'Scan cancelled') => {
    const scan = activeScans.get(String(companyId));
    if (!scan || !ACTIVE.has(scan.phase)) return null;
    finish(scan, 'cancelled', message);
    return { scanId: scan.scanId, gatewayId: scan.gatewayId };
};

exports.failScan = (companyId, message) => {
    const scan = activeScans.get(String(companyId));
    if (scan && ACTIVE.has(scan.phase)) finish(scan, 'failed', message);
};

exports.gatewayOffline = (companyId, gatewayId) => {
    const scan = activeScans.get(String(companyId));
    if (scan?.gatewayId === String(gatewayId)) exports.failScan(companyId, 'Factory Connector disconnected during discovery');
};
