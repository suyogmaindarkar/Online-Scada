// ═══════════════════════════════════════════════════════════
// OnlineSCADA Factory Connector — SCADA Dashboard & Network Scan
// ═══════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const net = require('net');
const CloudBridge = require('./cloudBridge');
const PLCReader = require('./plcReader');
const HealthMonitor = require('./healthMonitor');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error('[ERROR] config.json missing in workspace.');
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

async function main() {
    let config = loadConfig();

    const state = {
        cloudConnected: false,
        machines: config.plcs || [],
        logs: [
            'OnlineSCADA Edge Gateway is ready',
            'Starting gateway diagnostic monitor',
            'Initializing secure WebSocket tunnel...'
        ],
        addLog(msg) {
            this.logs.unshift(msg);
            if (this.logs.length > 4) this.logs.pop();
            renderDashboard();
        }
    };

    console.log = (...args) => {
        const txt = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        if (!txt.includes('node-opcua') && !txt.includes('verify')) state.addLog(txt.substring(0, 65));
    };
    console.error = (...args) => {
        const txt = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        state.addLog(`ERR: ${txt.substring(0, 60)}`);
    };

    const cloudBridge = new CloudBridge(config, false);
    const plcReader = new PLCReader(config, cloudBridge, false);
    const healthMonitor = new HealthMonitor(config, cloudBridge, false);

    let isFirstRender = true;

    function renderDashboard() {
        const w = 76;
        const boxTop = '┌' + '─'.repeat(w + 2) + '┐';
        const boxMid = '├' + '─'.repeat(w + 2) + '┤';
        const boxBot = '└' + '─'.repeat(w + 2) + '┘';
        const row = (txt = '') => {
            const clean = txt.replace(/\x1b\[[0-9;]*m/g, '');
            const pad = Math.max(0, w - clean.length);
            return '│ ' + txt + ' '.repeat(pad) + ' │';
        };

        let buf = '';
        if (isFirstRender) buf += '\x1b[2J';
        buf += '\x1b[H';

        buf += boxTop + '\n';
        buf += row('\x1b[1m\x1b[36m                       O N L I N E S C A D A\x1b[0m') + '\n';
        buf += row('\x1b[90m                 Industrial Edge Gateway\x1b[0m') + '\n';
        buf += boxMid + '\n';

        const cloudStat = state.cloudConnected ? '\x1b[32m● ONLINE\x1b[0m' : '\x1b[33m● CONNECTING\x1b[0m';
        buf += row(`ONLINE SCADA${' '.repeat(48)}${cloudStat}`) + '\n';
        buf += row(`\x1b[90mSecure Industrial Connectivity\x1b[0m${' '.repeat(40)}Gateway v2.0.0`) + '\n';
        buf += boxMid + '\n';

        const tunnelStat = state.cloudConnected ? '\x1b[32m● CONNECTED\x1b[0m    Secure tunnel active' : '\x1b[33m● WAITING\x1b[0m      Connecting to cloud...';
        const healthStat = '\x1b[32m● HEALTHY\x1b[0m      Diagnostic monitor';
        const machCount = String(state.machines.length);
        const tagCount = String(state.machines.reduce((acc, m) => acc + (m.tags?.length || 0), 0));

        buf += row(`CLOUD CONNECTION                    ${tunnelStat}`) + '\n';
        buf += row(`GATEWAY HEALTH                      ${healthStat}`) + '\n';
        buf += row(`MACHINES                            \x1b[1m${machCount}\x1b[0m             Connected`) + '\n';
        buf += row(`TAGS                                \x1b[1m${tagCount}\x1b[0m             Reading`) + '\n';
        buf += boxMid + '\n';

        buf += row('\x1b[36m▸ MACHINE STATUS\x1b[0m') + '\n';
        buf += row('') + '\n';
        buf += row('\x1b[90mDEVICE                         PROTOCOL       STATUS                TAGS\x1b[0m') + '\n';

        if (state.machines.length === 0) {
            buf += row('\x1b[90mNo machine connections configured.\x1b[0m') + '\n';
        } else {
            state.machines.forEach(m => {
                const name = (m.plcName || 'Machine').padEnd(30).substring(0, 30);
                const proto = (m.protocol || 'OPCUA').toUpperCase().padEnd(14).substring(0, 14);
                const stat = m.isConnected ? '\x1b[32m● ONLINE\x1b[0m' : '\x1b[33m● WAITING\x1b[0m';
                const tagsLen = String(m.tags?.length || 0);
                buf += row(`${name}${proto}${stat}${' '.repeat(14)}${tagsLen}`) + '\n';
            });
        }

        buf += boxMid + '\n';
        const activeTagCount = state.machines.reduce((acc, m) => acc + (m.tags?.length || 0), 0);
        const engineStat = state.machines.some(m => m.isConnected) ? '\x1b[32m● READING\x1b[0m' : '\x1b[33m● WAITING\x1b[0m';
        buf += row(`DATA ENGINE         ${engineStat}       \x1b[1m${activeTagCount} TAGS ACTIVE\x1b[0m`) + '\n';
        buf += boxMid + '\n';

        buf += row('\x1b[36mCONNECTION                     STATUS\x1b[0m') + '\n';
        const cStatus = state.cloudConnected ? '\x1b[32m● Connected\x1b[0m' : '\x1b[33m● Connecting...\x1b[0m';
        const mStatus = state.machines.some(m => m.isConnected) ? '\x1b[32m● Online\x1b[0m' : '\x1b[33m● Waiting\x1b[0m';
        const dStatus = activeTagCount > 0 ? '\x1b[32m● Active\x1b[0m' : '\x1b[33m● Waiting\x1b[0m';
        buf += row(`Cloud                          ${cStatus}`) + '\n';
        buf += row(`Machine                        ${mStatus}`) + '\n';
        buf += row(`Data acquisition               ${dStatus}`) + '\n';
        buf += boxMid + '\n';

        buf += row('\x1b[36m▸ LATEST ACTIVITY\x1b[0m') + '\n';
        state.logs.slice(0, 3).forEach(lg => {
            buf += row(`\x1b[90m› ${lg}\x1b[0m`) + '\n';
        });

        buf += row('OnlineSCADA • Industrial Cloud SCADA                         \x1b[33mCtrl+C Stop\x1b[0m') + '\n';
        buf += boxBot;

        process.stdout.write(buf);
        isFirstRender = false;
    }

    cloudBridge.onWriteCommand((cmd) => {
        state.addLog(`Write -> ${cmd.tagName} = ${cmd.value}`);
        plcReader.handleWriteCommand(cmd);
    });

    cloudBridge.onConfigUpdate((newConfig) => {
        if (Array.isArray(newConfig?.plcs)) {
            state.machines = newConfig.plcs;
            state.addLog(`Hot-reloaded ${newConfig.plcs.length} machine(s)`);
            plcReader.reload(newConfig.plcs);
            renderDashboard();
        }
    });

    // ─── Restore Network Discovery Scanner ───
    cloudBridge.onStartDiscovery(async (options) => {
        state.addLog(`Network scan started: ${options.startIP} to ${options.endIP}`);
        cloudBridge.reportDiscovery('started', []);

        const results = [];
        const targetPorts = { 102: 'S7', 502: 'MODBUS_TCP', 4840: 'OPC_UA', 44818: 'ETHERNET_IP' };

        try {
            const base = options.startIP.substring(0, options.startIP.lastIndexOf('.'));
            const start = parseInt(options.startIP.split('.').pop());
            const end = parseInt(options.endIP.split('.').pop());

            for (let i = start; i <= end; i++) {
                const ip = `${base}.${i}`;
                for (const [portStr, proto] of Object.entries(targetPorts)) {
                    const port = parseInt(portStr);
                    await new Promise((resolve) => {
                        const socket = new net.Socket();
                        socket.setTimeout(400);
                        socket.on('connect', () => {
                            results.push({ ip, port, protocol: proto });
                            state.addLog(`Discovered ${proto} at ${ip}:${port}`);
                            socket.destroy();
                            resolve();
                        });
                        socket.on('timeout', () => { socket.destroy(); resolve(); });
                        socket.on('error', () => resolve());
                        socket.connect(port, ip);
                    });
                }
            }
        } catch (err) {
            state.addLog(`Scan failed: ${err.message}`);
        }

        cloudBridge.reportDiscovery('completed', results);
        state.addLog(`Scan complete. Found ${results.length} device(s).`);
    });

    setInterval(() => {
        state.cloudConnected = cloudBridge.isConnected;
        renderDashboard();
    }, 1000);

    renderDashboard();

    await cloudBridge.connect();
    await plcReader.startAll();
    healthMonitor.start();

    state.cloudConnected = true;
    renderDashboard();
}

main().catch((err) => {
    console.error('[FATAL ERROR]', err.message);
});