// ═══════════════════════════════════════════════════════════
// OnlineSCADA Factory Connector — SCADA Dashboard Engine v2.2
// ═══════════════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
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

    // Application State Tracker
    const state = {
        cloudConnected: false,
        gatewayHealth: 'HEALTHY',
        machines: config.plcs || [],
        dataEngineStatus: 'WAITING',
        machineLayerStatus: 'Waiting',
        dataAcqStatus: 'Waiting',
        logs: [
            'OnlineSCADA Edge Gateway is ready',
            'Starting gateway diagnostic monitor',
            'Initializing secure WebSocket tunnel...'
        ]
    };

    function addLog(msg) {
        state.logs.unshift(msg);
        if (state.logs.length > 5) state.logs.pop();
        redrawDashboard();
    }

    function redrawDashboard() {
        console.clear();

        const w = 76; // Standard terminal width layout
        const cCyan = '\x1b[36m';
        const cGreen = '\x1b[32m';
        const cYellow = '\x1b[33m';
        const cWhite = '\x1b[37m';
        const cGray = '\x1b[90m';
        const cBold = '\x1b[1m';
        const cReset = '\x1b[0m';

        const line = (txt = '', align = 'left') => {
            const cleanTxt = txt.replace(/\x1b\[[0-9;]*m/g, '');
            const padLen = Math.max(0, w - cleanTxt.length);
            if (align === 'right') return cCyan + '║ ' + cReset + ' '.repeat(padLen) + txt + cCyan + ' ║' + cReset;
            if (align === 'center') {
                const leftPad = Math.floor(padLen / 2);
                const rightPad = padLen - leftPad;
                return cCyan + '║ ' + cReset + ' '.repeat(leftPad) + txt + ' '.repeat(rightPad) + cCyan + ' ║' + cReset;
            }
            return cCyan + '║ ' + cReset + txt + ' '.repeat(padLen) + cCyan + ' ║' + cReset;
        };

        const divider = () => cCyan + '╠' + '═'.repeat(w + 2) + '╣' + cReset;

        console.log(cCyan + '╔' + '═'.repeat(w + 2) + '╗' + cReset);
        console.log(line(`${cBold}${cCyan}O N L I N E S C A D A${cReset} Cloud Data Bridge`, 'center'));
        console.log(line(`${cGray}Industrial Edge Gateway  •  Factory → Cloud Data Bridge${cReset}`, 'center'));
        console.log(cCyan + '╠' + '═'.repeat(w + 2) + '╣' + cReset);

        // System Header Block
        const cloudStatusStr = state.cloudConnected ? `${cGreen}● ONLINE${cReset}` : `${cYellow}● CONNECTING${cReset}`;
        console.log(line(`${cBold}ONLINE SCADA${cReset}${' '.repeat(42)}${cloudStatusStr}`));
        console.log(line(`${cGray}Secure Industrial Connectivity${cReset}${' '.repeat(38)}Gateway v2.2.0`));
        console.log(divider());

        // Status Metrics Block
        const tunnelStr = state.cloudConnected ? `${cGreen}● CONNECTED${cReset} Secure tunnel active` : `${cYellow}● WAITING${cReset} Connecting to cloud...`;
        const healthStr = `${cGreen}● HEALTHY${cReset} Diagnostic monitor active`;
        const machineCount = state.machines.length;
        const totalTags = state.machines.reduce((acc, m) => acc + (m.tags?.length || 0), 0);

        console.log(line(`CLOUD CONNECTION${' '.repeat(20)}${tunnelStr}`));
        console.log(line(`GATEWAY HEALTH${' '.repeat(22)}${healthStr}`));
        console.log(line(`MACHINES${' '.repeat(30)}${cBold}${machineCount}${cReset} Configured machines`));
        console.log(line(`TAGS${' '.repeat(32)}${cBold}${totalTags}${cReset} Tags configured`));
        console.log(divider());

        // Machine Status Table Header
        console.log(line(`${cCyan}► MACHINE STATUS${cReset}`));
        console.log(line(`${cGray}DEVICE                  PROTOCOL        STATUS          TAGS${cReset}`));
        console.log(cCyan + '╟' + '─'.repeat(w + 2) + '╢' + cReset);

        if (state.machines.length === 0) {
            console.log(line(`${cGray}No machine connections configured.${cReset}`));
        } else {
            state.machines.forEach(m => {
                const devName = (m.plcName || 'Machine').padEnd(23).substring(0, 23);
                const proto = (m.protocol || 'UNKNOWN').toUpperCase().padEnd(15).substring(0, 15);
                const stat = state.cloudConnected ? `${cGreen}ONLINE${cReset}` : `${cYellow}WAITING${cReset}`;
                const tagsLen = String(m.tags?.length || 0).padEnd(6);
                console.log(line(`${cWhite}${devName}${cReset} ${cGray}${proto}${cReset} ${stat}${' '.repeat(8)}${tagsLen}`));
            });
        }
        console.log(divider());

        // Data Engine Status
        const engineCol = state.dataEngineStatus === 'ACTIVE' ? cGreen : cYellow;
        console.log(line(`DATA ENGINE ${engineCol}● ${state.dataEngineStatus}${cReset}  ${totalTags} tags configured for acquisition`));
        console.log(divider());

        // Connection Status Block
        console.log(line(`${cCyan}► CONNECTION STATUS${cReset}`));
        const cServ = state.cloudConnected ? `${cGreen}● Connected${cReset}` : `${cYellow}● Connecting...${cReset}`;
        const mLayer = state.machines.length > 0 ? `${cGreen}● Active${cReset}` : `${cYellow}● Waiting${cReset}`;
        const dAcq = totalTags > 0 ? `${cGreen}● Polling${cReset}` : `${cYellow}● Waiting${cReset}`;

        console.log(line(`Cloud service${' '.repeat(21)}${cServ}`));
        console.log(line(`Machine layer${' '.repeat(21)}${mLayer}`));
        console.log(line(`Data acquisition${' '.repeat(18)}${dAcq}`));
        console.log(divider());

        // Latest Activity Log Block
        console.log(line(`${cCyan}► LATEST ACTIVITY${cReset}`));
        state.logs.slice(0, 4).forEach(lg => {
            console.log(line(`› ${cGray}${lg}${cReset}`));
        });

        console.log(cCyan + '╚' + '═'.repeat(w + 2) + '╝' + cReset);
        console.log(`${cCyan}OnlineSCADA${cReset} Industrial Cloud SCADA${' '.repeat(34)}Ctrl + C ${cYellow}Stop Gateway${cReset}`);
    }

    // Initialize Bridge & Readers
    const cloudBridge = new CloudBridge(config, false);
    const plcReader = new PLCReader(config, cloudBridge, false);
    const healthMonitor = new HealthMonitor(config, cloudBridge, false);

    cloudBridge.onWriteCommand((cmd) => {
        addLog(`Write command -> Tag: ${cmd.tagName} = ${cmd.value}`);
        plcReader.handleWriteCommand(cmd);
    });

    cloudBridge.onConfigUpdate((newConfig) => {
        if (Array.isArray(newConfig?.plcs)) {
            state.machines = newConfig.plcs;
            state.dataEngineStatus = 'ACTIVE';
            state.machineLayerStatus = 'Active';
            state.dataAcqStatus = 'Polling';
            addLog(`Hot-reloaded ${newConfig.plcs.length} machine connection(s)`);
            plcReader.reload(newConfig.plcs);
            redrawDashboard();
        }
    });

    // Handle connection state callbacks
    setInterval(() => {
        const isOnline = cloudBridge.isConnected;
        if (state.cloudConnected !== isOnline) {
            state.cloudConnected = isOnline;
            if (isOnline) {
                state.dataEngineStatus = 'ACTIVE';
                addLog('Secure WebSocket tunnel established');
            } else {
                state.dataEngineStatus = 'WAITING';
                addLog('Connection lost - reconnecting...');
            }
            redrawDashboard();
        }
    }, 1000);

    redrawDashboard();

    await cloudBridge.connect();
    await plcReader.startAll();
    healthMonitor.start();

    state.cloudConnected = true;
    state.dataEngineStatus = 'ACTIVE';
    addLog('OnlineSCADA Factory Connector is online');
    redrawDashboard();
}

main().catch((err) => {
    console.error('\x1b[31m[CRITICAL ERROR] Gateway engine halted:', err.message, '\x1b[0m');
});