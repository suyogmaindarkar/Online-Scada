// ═══════════════════════════════════════════════════════════
// OnlineSCADA Edge Gateway — Main Entry Point
//
// Reads PLCs on the local factory network and pushes
// live tag data to the OnlineSCADA cloud via WebSocket.
//
// Usage:
//   1. Download config.json from OnlineSCADA dashboard
//   2. Place it in this folder
//   3. Run: node src/index.js
//      OR double-click start.bat (Windows) / start.sh (Linux)
// ═══════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const CloudBridge = require('./cloudBridge');
const PLCReader = require('./plcReader');
const HealthMonitor = require('./healthMonitor');

const VERBOSE = process.argv.includes('--verbose');
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// ─── Banner ───────────────────────────────────────────────
console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║        🏭 OnlineSCADA Edge Gateway v1.0.0               ║');
console.log('║        Factory → Cloud PLC Data Bridge                  ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

// ─── Load Config ──────────────────────────────────────────
function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error('❌ config.json not found!');
        console.error('');
        console.error('   Please download your gateway config from:');
        console.error('   OnlineSCADA Dashboard → Settings → Edge Gateways → Download Config');
        console.error('');
        console.error('   Then place the config.json file in this folder:');
        console.error(`   ${path.join(__dirname, '..')}`);
        console.error('');
        process.exit(1);
    }

    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(raw);

        // Validate required fields
        const required = ['cloudUrl', 'companyId', 'apiKey', 'plcs'];
        const missing = required.filter((k) => !config[k]);

        if (missing.length > 0) {
            console.error(`❌ config.json is missing required fields: ${missing.join(', ')}`);
            process.exit(1);
        }

        if (config.apiKey === 'YOUR_API_KEY_HERE' || config.companyId === 'YOUR_COMPANY_ID_HERE') {
            console.error('❌ config.json still has placeholder values!');
            console.error('   Please download your real config from the OnlineSCADA dashboard.');
            process.exit(1);
        }

        if (VERBOSE) {
            console.log('📄 Config loaded:');
            console.log(`   Cloud:     ${config.cloudUrl}`);
            console.log(`   Company:   ${config.companyId}`);
            console.log(`   Gateway:   ${config.gatewayName || config.gatewayId}`);
            console.log(`   PLCs:      ${config.plcs.length}`);
            console.log(`   API Key:   ${config.apiKey.substring(0, 11)}...`);
            console.log('');
        }

        return config;
    } catch (err) {
        console.error(`❌ Failed to parse config.json: ${err.message}`);
        process.exit(1);
    }
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
    const config = loadConfig();

    // Initialize components
    const cloudBridge = new CloudBridge(config, VERBOSE);
    const plcReader = new PLCReader(config, cloudBridge, VERBOSE);
    const healthMonitor = new HealthMonitor(config, cloudBridge, VERBOSE);

    // Wire up: cloud write commands → PLC reader
    cloudBridge.onWriteCommand((cmd) => {
        plcReader.handleWriteCommand(cmd);
    });

    // Wire up: cloud config updates → hot reload
    cloudBridge.onConfigUpdate((newConfig) => {
        console.log('🔄 Received config update from cloud — reloading PLC connections...');
        plcReader.reload(newConfig.plcs);
    });

    // ─── Graceful Shutdown ──────────────────────────────────
    const shutdown = async (signal) => {
        console.log(`\n⏹️  Received ${signal} — shutting down gracefully...`);
        healthMonitor.stop();
        plcReader.stopAll();
        cloudBridge.disconnect();
        console.log('👋 Gateway stopped. Goodbye!');
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (err) => {
        console.error('💥 Uncaught exception:', err.message);
        if (VERBOSE) console.error(err.stack);
    });
    process.on('unhandledRejection', (err) => {
        console.error('💥 Unhandled rejection:', err?.message || err);
    });

    // ─── Start Everything ───────────────────────────────────
    console.log('🔌 Connecting to OnlineSCADA cloud...');
    await cloudBridge.connect();

    console.log('🏭 Starting PLC readers...');
    await plcReader.startAll();

    console.log('💓 Starting health monitor...');
    healthMonitor.start();

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   ✅ EDGE GATEWAY IS RUNNING                            ║');
    console.log('║                                                          ║');
    console.log(`║   PLCs Active:    ${String(config.plcs.length).padEnd(38)}║`);
    console.log(`║   Cloud:          ${config.cloudUrl.substring(0, 38).padEnd(38)}║`);
    console.log('║                                                          ║');
    console.log('║   Press Ctrl+C to stop                                   ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
}

main().catch((err) => {
    console.error('💥 Fatal error:', err.message);
    process.exit(1);
});