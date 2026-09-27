// ═══════════════════════════════════════════════════════════
// OnlineSCADA Factory Connector — Main Entry Point
//
// Reads PLCs on the local factory network and pushes
// live tag data to the OnlineSCADA cloud via WebSocket.
// ═══════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const CloudBridge = require('./cloudBridge');
const PLCReader = require('./plcReader');
const HealthMonitor = require('./healthMonitor');

const VERBOSE = process.argv.includes('--verbose');
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// ─── Banner ───────────────────────────────────────────────
console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║        OnlineSCADA Factory Connector v2.0.0              ║');
console.log('║        Factory -> Cloud Machine Data Bridge              ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

// ─── Load Config ──────────────────────────────────────────
function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error('[ERROR] config.json not found!');
        console.error('  Please download your connector config from the cloud dashboard');
        process.exit(1);
    }

    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(raw);

        const required = ['cloudUrl', 'companyId', 'apiKey', 'plcs'];
        const missing = required.filter((k) => !config[k]);

        if (missing.length > 0) {
            console.error(`[ERROR] config.json is missing required fields: ${missing.join(', ')}`);
            process.exit(1);
        }

        return config;
    } catch (err) {
        console.error(`[ERROR] Failed to parse config.json: ${err.message}`);
        process.exit(1);
    }
}

// ─── High-Speed Multi-Subnet Discovery Scanner ────────────
async function scanNetwork(options, cloudBridge) {
    const { startIP, endIP } = options;
    let rangesToScan = [];

    // 1. Determine Subnets to Scan
    if (startIP && endIP) {
        rangesToScan.push({ start: startIP, end: endIP });
    } else {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            // Skip common virtual/hyper-v/WSL adapters to avoid false IPs
            if (name.toLowerCase().includes('wsl') || name.toLowerCase().includes('veth')) continue;

            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    const parts = iface.address.split('.');
                    rangesToScan.push({
                        start: `${parts[0]}.${parts[1]}.${parts[2]}.1`,
                        end: `${parts[0]}.${parts[1]}.${parts[2]}.254`
                    });
                }
            }
        }
    }

    // Deduplicate ranges in case of multiple IPs on one subnet
    rangesToScan = rangesToScan.filter((v, i, a) => a.findIndex(t => (t.start === v.start)) === i);

    if (rangesToScan.length === 0) {
        console.log('[x] No physical IPv4 networks found to scan.');
        await cloudBridge.reportDiscovery('done', { scannedIPs: 0, aliveHosts: 0, devices: [] });
        return;
    }

    console.log(`[o] Commencing hardware scan across ${rangesToScan.length} subnet(s)...`);
    await cloudBridge.reportDiscovery('pinging', { scannedIPs: 0, aliveHosts: 0, devices: [] });

    const ipToInt = (ip) => ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
    const intToIp = (int) => `${(int >>> 24)}.${(int >> 16 & 255)}.${(int >> 8 & 255)}.${int & 255}`;

    let scanned = 0;
    let alive = 0;
    const devices = [];

    const checkPort = (ip, port) => {
        return new Promise((resolve) => {
            const s = new net.Socket();
            s.setTimeout(500); // 500ms timeout for ultra-fast LAN sweeps
            s.on('connect', () => { s.destroy(); resolve(true); });
            s.on('timeout', () => { s.destroy(); resolve(false); });
            s.on('error', () => { s.destroy(); resolve(false); });
            s.connect(port, ip);
        });
    };

    const portsToProtocols = {
        102: 'S7',
        502: 'MODBUS_TCP',
        4840: 'OPC_UA',
        44818: 'ETHERNET_IP'
    };
    const vendorNames = {
        102: 'Siemens PLC (S7)',
        502: 'Modbus TCP Device',
        4840: 'OPC-UA Server',
        44818: 'Allen-Bradley (EIP)'
    };

    // 2. High-Speed Concurrent Batch Processing
    for (const range of rangesToScan) {
        console.log(`[o] Sweeping IP Range: ${range.start} -> ${range.end}`);
        const startInt = ipToInt(range.start);
        const endInt = ipToInt(range.end);

        const ipsToScan = [];
        for (let i = startInt; i <= endInt; i++) {
            ipsToScan.push(intToIp(i));
        }

        const BATCH_SIZE = 40; // Scan 40 IPs simultaneously
        for (let i = 0; i < ipsToScan.length; i += BATCH_SIZE) {
            const batch = ipsToScan.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (ip) => {
                const results = await Promise.all(
                    Object.keys(portsToProtocols).map(async (port) => {
                        const isOpen = await checkPort(ip, parseInt(port));
                        return { port, isOpen };
                    })
                );

                scanned++;
                const openPorts = results.filter(r => r.isOpen);

                if (openPorts.length > 0) {
                    alive++;
                    console.log(`[+] Found active industrial machine at ${ip}`);
                    for (const { port } of openPorts) {
                        devices.push({
                            ip,
                            port: parseInt(port),
                            protocol: portsToProtocols[port],
                            vendorName: vendorNames[port],
                            verified: true,
                            deepInfo: { model: 'Identified via Hardware Port Scan' }
                        });
                    }
                }
            }));

            // Stream progress back to the cloud UI
            await cloudBridge.reportDiscovery('probing', { scannedIPs: scanned, aliveHosts: alive, devices });
        }
    }

    console.log(`[x] Scan complete. Found ${devices.length} valid machines.`);
    await cloudBridge.reportDiscovery('done', { scannedIPs: scanned, aliveHosts: alive, devices });
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
    const config = loadConfig();

    const cloudBridge = new CloudBridge(config, VERBOSE);
    const plcReader = new PLCReader(config, cloudBridge, VERBOSE);
    const healthMonitor = new HealthMonitor(config, cloudBridge, VERBOSE);

    cloudBridge.onWriteCommand((cmd) => {
        plcReader.handleWriteCommand(cmd);
    });

    cloudBridge.onConfigUpdate((payload) => {
        const newPlcs = payload?.plcs;
        if (!Array.isArray(newPlcs)) return;
        console.log(`[o] Hot-reloading ${newPlcs.length} Machine connection(s)...`);
        config.plcs = newPlcs;
        plcReader.reload(newPlcs).catch((err) => {
            console.error('[ERROR] Hot reload failed:', err.message);
        });
    });

    cloudBridge.onStartDiscovery((options) => {
        scanNetwork(options, cloudBridge).catch(err => {
            console.error(`[ERROR] Scan failed: ${err.message}`);
        });
    });

    const shutdown = async (signal) => {
        console.log(`\n[x] Received ${signal} — shutting down gracefully...`);
        healthMonitor.stop();
        plcReader.stopAll();
        cloudBridge.disconnect();
        console.log('[x] Connector stopped.');
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (err) => console.error('[ERROR] Uncaught exception:', err.message));
    process.on('unhandledRejection', (err) => console.error('[ERROR] Unhandled rejection:', err?.message || err));

    console.log('[o] Connecting to Cloud Environment...');
    await cloudBridge.connect();

    console.log('[o] Starting Machine Protocol Readers...');
    await plcReader.startAll();

    console.log('[o] Starting Diagnostic Health Monitor...');
    healthMonitor.start();

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   SYSTEM ONLINE - FACTORY CONNECTOR ACTIVE               ║');
    console.log('║                                                          ║');
    console.log(`║   Machines Active: ${String(config.plcs.length).padEnd(38)}║`);
    console.log(`║   Cloud Link:      Secure WSS Tunnel Active              ║`);
    console.log('║                                                          ║');
    console.log('║   Press Ctrl+C to stop                                   ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
}

main().catch((err) => {
    console.error('[ERROR] Fatal error:', err.message);
    process.exit(1);
});