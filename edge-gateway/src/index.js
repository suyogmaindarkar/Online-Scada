// ═══════════════════════════════════════════════════════════
// OnlineSCADA Factory Connector — Fixed Screen SCADA Dashboard
// ═══════════════════════════════════════════════════════════

const CloudBridge = require('./cloudBridge');
const PLCReader = require('./plcReader');
const HealthMonitor = require('./healthMonitor');
const runtime = require('./serviceRuntime');
const secretStore = require('./secretStore');

const RUNTIME_PATHS = runtime.getPaths();

function loadConfig() {
    return runtime.loadConfig(RUNTIME_PATHS);
}

async function main() {
    runtime.ensureRuntimeFolders(RUNTIME_PATHS);
    const releaseInstance = runtime.acquireSingleInstance(RUNTIME_PATHS);
    let config = loadConfig();
    config.apiKey = secretStore.loadSecret(config, RUNTIME_PATHS);

    const state = {
        cloudConnected: false,
        machines: config.plcs || [],
    };

    const cloudBridge = new CloudBridge(config, false);
    const plcReader = new PLCReader(config, cloudBridge, false);
    const healthMonitor = new HealthMonitor(config, cloudBridge, plcReader, false);

    // Live Cursor-Managed Dashboard Renderer
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
        if (isFirstRender) {
            buf += '\x1b[2J'; // Clear screen once on startup
        }
        buf += '\x1b[H'; // Move cursor to top-left (0,0) without creating scroll entries

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
                // Shows ONLINE immediately upon successful connection handshake
                const stat = m.isConnected ? '\x1b[32m● ONLINE\x1b[0m' : '\x1b[33m● WAITING\x1b[0m';
                const tagsLen = String(m.tags?.length || 0);
                buf += row(`${name}${proto}${stat}${' '.repeat(14)}${tagsLen}`) + '\n';
            });
        }

        buf += boxMid + '\n';
        const engineStat = state.machines.some(m => m.isConnected) ? '\x1b[32m● READING\x1b[0m' : '\x1b[33m● WAITING\x1b[0m';
        const activeTagCount = state.machines.reduce((acc, m) => acc + (m.tags?.length || 0), 0);
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

        buf += row('OnlineSCADA • Industrial Cloud SCADA                         \x1b[33mCtrl+C Stop\x1b[0m') + '\n';
        buf += boxBot;

        process.stdout.write(buf);
        isFirstRender = false;
    }

    cloudBridge.onWriteCommand((cmd) => {
        plcReader.handleWriteCommand(cmd);
    });

    cloudBridge.onConfigUpdate((newConfig) => {
        if (Array.isArray(newConfig?.plcs)) {
            state.machines = newConfig.plcs;
            plcReader.reload(newConfig.plcs);
            renderDashboard();
        }
    });

    // ─── REMOTE EQUIPMENT COMMANDS (start/stop/restart from website) ───
    cloudBridge.onEquipmentCommand((cmd) => {
        plcReader.handleEquipmentCommand(cmd).catch((err) => {
            console.error('[x] Equipment command error:', err.message);
            cloudBridge.sendEquipmentCommandResult({
                requestId: cmd && cmd.requestId,
                equipmentId: cmd && cmd.equipmentId,
                action: cmd && cmd.action,
                success: false,
                state: 'error',
                message: 'Internal command error: ' + err.message,
            });
        });
    });

    // ─── PER-EQUIPMENT STATUS PUSH (every 3s) so the website shows live states ───
    let statusTick = 0;
    setInterval(() => {
        state.cloudConnected = cloudBridge.isConnected;
        renderDashboard();
        statusTick += 1;
        if (statusTick % 3 === 0 && cloudBridge.isConnected) {
            const statuses = plcReader.getEquipmentStatuses();
            if (statuses.length > 0) cloudBridge.sendEquipmentStatuses(statuses);
        }
    }, 1000);

    renderDashboard();

    await cloudBridge.connect();
    await plcReader.startAll();
    healthMonitor.start();

    runtime.installShutdownHandlers({
        release: releaseInstance,
        stop: async () => {
            healthMonitor.stop();
            plcReader.stopAll();
            cloudBridge.disconnect();
        },
    });

    state.cloudConnected = true;
    renderDashboard();
}

main().catch((err) => {
    console.error('\x1b[31m[CRITICAL ERROR] Gateway engine halted:', err.message, '\x1b[0m');
});
