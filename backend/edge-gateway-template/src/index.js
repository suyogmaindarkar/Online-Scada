// ═══════════════════════════════════════════════════════════
// OnlineSCADA Factory Connector — Fixed Screen SCADA Dashboard
// ═══════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const net = require('net');
const CloudBridge = require('./cloudBridge');
const PLCReader = require('./plcReader');
const HealthMonitor = require('./healthMonitor');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) process.exit(1);
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

async function main() {
    let config = loadConfig();
    const state = {
        cloudConnected: false, machines: config.plcs || [],
        logs: ['OnlineSCADA Edge Gateway is ready', 'Starting gateway diagnostic monitor'],
        addLog(msg) { this.logs.unshift(msg); if (this.logs.length > 4) this.logs.pop(); renderDashboard(); }
    };

    console.log = (...args) => { const txt = args.join(' '); if (!txt.includes('node-opcua') && !txt.includes('verify')) state.addLog(txt.substring(0, 65)); };
    console.error = (...args) => state.addLog(`ERR: ${args.join(' ').substring(0, 60)}`);

    const cloudBridge = new CloudBridge(config, false);
    const plcReader = new PLCReader(config, cloudBridge, false);
    const healthMonitor = new HealthMonitor(config, cloudBridge, plcReader, false);

    let isFirstRender = true;

    function renderDashboard() {
        const w = 76;
        const boxTop = '┌' + '─'.repeat(w + 2) + '┐', boxMid = '├' + '─'.repeat(w + 2) + '┤', boxBot = '└' + '─'.repeat(w + 2) + '┘';
        const row = (txt = '') => '│ ' + txt + ' '.repeat(Math.max(0, w - txt.replace(/\x1b\[[0-9;]*m/g, '').length)) + ' │';

        let buf = (isFirstRender ? '\x1b[2J' : '') + '\x1b[H' + boxTop + '\n';
        buf += row('\x1b[1m\x1b[36m                       O N L I N E S C A D A\x1b[0m') + '\n';
        buf += row('\x1b[90m                 Industrial Edge Gateway\x1b[0m') + '\n' + boxMid + '\n';

        buf += row(`ONLINE SCADA${' '.repeat(48)}${state.cloudConnected ? '\x1b[32m● ONLINE\x1b[0m' : '\x1b[33m● CONNECTING\x1b[0m'}`) + '\n';
        buf += row(`\x1b[90mSecure Industrial Connectivity\x1b[0m${' '.repeat(40)}Gateway v2.0.0`) + '\n' + boxMid + '\n';

        const machCount = String(state.machines.length), tagCount = String(state.machines.reduce((acc, m) => acc + (m.tags?.length || 0), 0));
        buf += row(`CLOUD CONNECTION                    ${state.cloudConnected ? '\x1b[32m● CONNECTED\x1b[0m    Secure tunnel active' : '\x1b[33m● WAITING\x1b[0m      Connecting to cloud...'}`) + '\n';
        buf += row(`GATEWAY HEALTH                      \x1b[32m● HEALTHY\x1b[0m      Diagnostic monitor`) + '\n';
        buf += row(`MACHINES                            \x1b[1m${machCount}\x1b[0m             Connected`) + '\n';
        buf += row(`TAGS                                \x1b[1m${tagCount}\x1b[0m             Reading`) + '\n' + boxMid + '\n';

        buf += row('\x1b[36m▸ MACHINE STATUS\x1b[0m') + '\n' + row('') + '\n';
        buf += row('\x1b[90mDEVICE                         PROTOCOL       STATUS                TAGS\x1b[0m') + '\n';

        if (state.machines.length === 0) buf += row('\x1b[90mNo machine connections configured.\x1b[0m') + '\n';
        else state.machines.forEach(m => {
            buf += row(`${(m.plcName || 'Machine').padEnd(30).substring(0, 30)}${(m.protocol || 'OPCUA').toUpperCase().padEnd(14).substring(0, 14)}${m.isConnected ? '\x1b[32m● ONLINE\x1b[0m' : '\x1b[33m● WAITING\x1b[0m'}${' '.repeat(14)}${String(m.tags?.length || 0)}`) + '\n';
        });

        const activeTagCount = state.machines.reduce((acc, m) => acc + (m.tags?.length || 0), 0);
        buf += boxMid + '\n' + row(`DATA ENGINE         ${state.machines.some(m => m.isConnected) ? '\x1b[32m● READING\x1b[0m' : '\x1b[33m● WAITING\x1b[0m'}       \x1b[1m${activeTagCount} TAGS ACTIVE\x1b[0m`) + '\n' + boxMid + '\n';
        buf += row('\x1b[36mCONNECTION                     STATUS\x1b[0m') + '\n';
        buf += row(`Cloud                          ${state.cloudConnected ? '\x1b[32m● Connected\x1b[0m' : '\x1b[33m● Connecting...\x1b[0m'}`) + '\n';
        buf += row(`Machine                        ${state.machines.some(m => m.isConnected) ? '\x1b[32m● Online\x1b[0m' : '\x1b[33m● Waiting\x1b[0m'}`) + '\n';
        buf += row(`Data acquisition               ${activeTagCount > 0 ? '\x1b[32m● Active\x1b[0m' : '\x1b[33m● Waiting\x1b[0m'}`) + '\n' + boxMid + '\n';

        buf += row('\x1b[36m▸ LATEST ACTIVITY\x1b[0m') + '\n';
        state.logs.slice(0, 3).forEach(lg => buf += row(`\x1b[90m› ${lg}\x1b[0m`) + '\n');

        process.stdout.write(buf + row('OnlineSCADA • Industrial Cloud SCADA                         \x1b[33mCtrl+C Stop\x1b[0m') + '\n' + boxBot);
        isFirstRender = false;
    }

    cloudBridge.onWriteCommand((cmd) => { state.addLog(`Write -> ${cmd.tagName} = ${cmd.value}`); plcReader.handleWriteCommand(cmd); });

    cloudBridge.onConfigUpdate((newConfig) => {
        if (Array.isArray(newConfig?.plcs)) {
            state.machines = newConfig.plcs; state.addLog(`Hot-reloaded ${newConfig.plcs.length} machine(s)`);
            plcReader.reload(newConfig.plcs); renderDashboard();
        }
    });

    // ─── HIGH-SPEED NETWORK SCANNER ───
    cloudBridge.onStartDiscovery(async (options) => {
        state.addLog(`Network scan started: ${options.startIP} to ${options.endIP}`);
        const results = [];
        const ports = { 102: 'S7', 502: 'MODBUS_TCP', 4840: 'OPC_UA', 44818: 'ETHERNET_IP' };

        try {
            const base = options.startIP.substring(0, options.startIP.lastIndexOf('.'));
            const start = parseInt(options.startIP.split('.').pop());
            const end = parseInt(options.endIP.split('.').pop());

            for (let i = start; i <= end; i++) {
                const ip = `${base}.${i}`;
                for (const [portStr, proto] of Object.entries(ports)) {
                    await new Promise(res => {
                        const s = new net.Socket();
                        s.setTimeout(300);
                        s.on('connect', () => { results.push({ ip, port: parseInt(portStr), protocol: proto }); state.addLog(`Discovered ${proto} at ${ip}`); s.destroy(); res(); });
                        s.on('timeout', () => { s.destroy(); res(); });
                        s.on('error', () => { res(); });
                        s.connect(parseInt(portStr), ip);
                    });
                }
                cloudBridge.reportDiscovery('progress', results);
            }
            state.addLog(`Scan complete. Found ${results.length} machine(s).`);
        } catch (err) { state.addLog(`Scan failed: ${err.message}`); }

        cloudBridge.reportDiscovery('completed', results);
    });

    setInterval(() => { state.cloudConnected = cloudBridge.isConnected; renderDashboard(); }, 1000);
    renderDashboard();

    await cloudBridge.connect(); await plcReader.startAll(); healthMonitor.start();
    state.cloudConnected = true; renderDashboard();
}

main().catch(() => { });
