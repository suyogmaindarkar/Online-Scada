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
console.log('║        OnlineSCADA Factory Connector v1.0.0              ║');
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

        if (config.apiKey === 'YOUR_API_KEY_HERE' || config.companyId === 'YOUR_COMPANY_ID_HERE') {
            console.error('[ERROR] config.json still has placeholder values!');
            process.exit(1);
        }

        return config;
    } catch (err) {
        console.error(`[ERROR] Failed to parse config.json: ${err.message}`);
        process.exit(1);
    }
}

// ─── Network Discovery Scanner ────────────────────────────
async function scanNetwork(options, cloudBridge) {
    const { startIP, endIP } = options;
    let start = startIP, end = endIP;

    if (!start || !end) {
        const interfaces = os.networkInterfaces();
        let localIp = '192.168.1.1';
        for (let k in interfaces) {
            for (let k2 in interfaces[k]) {
                const address = interfaces[k][k2];
                if (address.family === 'IPv4' && !address.internal) {
                    localIp = address.address;
                    break;
                }
            }
        }
        const parts = localIp.split('.');
        start = `${parts[0]}.${parts[1]}.${parts[2]}.1`;
        end = `${parts[0]}.${parts[1]}.${parts[2]}.254`;
    }

    console.log(`[o] Scanning IP range: ${start} to ${end}`);
    await cloudBridge.reportDiscovery('pinging', { scannedIPs: 0, aliveHosts: 0, devices: [] });

    const ipToInt = (ip) => ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
    const intToIp = (int) => `${(int >>> 24)}.${(int >> 16 & 255)}.${(int >> 8 & 255)}.${int & 255}`;

    const startInt = ipToInt(start);
    const endInt = ipToInt(end);
    const totalIPs = endInt - startInt + 1;

    let scanned = 0;
    let alive = 0;
    const devices = [];

    const checkPort = (ip, port) => {
        return new Promise((resolve) => {
            const s = new net.Socket();
            s.setTimeout(800); // Fast timeout for LAN
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

    for (let i = startInt; i <= endInt; i++) {
        const ip = intToIp(i);
        scanned++;

        const results = await Promise.all(
            Object.keys(portsToProtocols).map(async (port) => {
                const isOpen = await checkPort(ip, parseInt(port));
                return { port, isOpen };
            })
        );

        const openPorts = results.filter(r => r.isOpen);
        if (openPorts.length > 0) {
            alive++;
            console.log(`[+] Found active industrial device at ${ip}`);
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

        // Report progress every 10 IPs or at the end
        if (scanned % 10 === 0 || scanned === totalIPs) {
            await cloudBridge.reportDiscovery('probing', { scannedIPs: scanned, aliveHosts: alive, devices });
        }
    }

    console.log(`[x] Scan complete. Found ${devices.length} machines.`);
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