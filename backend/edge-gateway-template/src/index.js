// ═══════════════════════════════════════════════════════════
// OnlineSCADA Edge Gateway
// Main Entry Point + Terminal SCADA Dashboard
//
// IMPORTANT:
// This file keeps the gateway workflow intact.
// The dashboard is presentation only.
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

// ═══════════════════════════════════════════════════════════
// TERMINAL UI
// ═══════════════════════════════════════════════════════════

const UI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',

    cyan: '\x1b[36m',
    brightCyan: '\x1b[96m',

    green: '\x1b[32m',
    brightGreen: '\x1b[92m',

    yellow: '\x1b[33m',
    brightYellow: '\x1b[93m',

    red: '\x1b[31m',
    brightRed: '\x1b[91m',

    blue: '\x1b[34m',
    brightBlue: '\x1b[94m',

    white: '\x1b[37m',
    brightWhite: '\x1b[97m',

    gray: '\x1b[90m',
    magenta: '\x1b[35m',
    brightMagenta: '\x1b[95m',

    clear: '\x1b[2J\x1b[H',
    hideCursor: '\x1b[?25l',
    showCursor: '\x1b[?25h'
};

const UI_WIDTH = 118;

const dashboard = {
    startedAt: Date.now(),

    state: 'STARTING',
    cloud: false,
    health: false,

    devices: [],
    totalTags: 0,
    readingTags: 0,

    discovery: {
        active: false,
        phase: '',
        scanned: 0,
        alive: 0,
        devices: 0
    },

    activity: [
        'Gateway initializing...'
    ],

    lastRefresh: 0,
    timer: null,

    draw() {
        try {
            process.stdout.write(UI.clear);
            process.stdout.write(UI.hideCursor);

            const width = getTerminalWidth();

            const lines = [];

            lines.push('');
            lines.push(center(
                `${UI.bold}${UI.brightCyan}O N L I N E S C A D A${UI.reset}`,
                width
            ));

            lines.push(center(
                `${UI.gray}Industrial Edge Gateway${UI.reset}  ${UI.dim}•${UI.reset}  ${UI.white}Factory → Cloud Data Bridge${UI.reset}`,
                width
            ));

            lines.push('');

            lines.push(boxTop(width));

            lines.push(row(
                ` ${UI.bold}${UI.brightWhite}ONLINE SCADA${UI.reset}`,
                `${UI.bold}${stateDot(this.state)} ${this.state}${UI.reset}`,
                width
            ));

            lines.push(row(
                `${UI.gray}Secure Industrial Connectivity${UI.reset}`,
                `${UI.gray}Gateway v2.0.0${UI.reset}`,
                width
            ));

            lines.push(boxDivider(width));

            // STATUS CARDS
            lines.push(
                cardLine(
                    'CLOUD CONNECTION',
                    this.cloud
                        ? `${UI.brightGreen}● CONNECTED${UI.reset}`
                        : `${UI.brightYellow}● CONNECTING${UI.reset}`,
                    this.cloud
                        ? 'Secure tunnel active'
                        : 'Waiting for cloud',
                    width
                )
            );

            lines.push(
                cardLine(
                    'GATEWAY HEALTH',
                    this.health
                        ? `${UI.brightGreen}● HEALTHY${UI.reset}`
                        : `${UI.brightYellow}● STARTING${UI.reset}`,
                    this.health
                        ? 'Diagnostic monitor active'
                        : 'Initializing diagnostics',
                    width
                )
            );

            lines.push(
                cardLine(
                    'MACHINES',
                    `${UI.brightCyan}${this.devices.length}${UI.reset}`,
                    'Configured machines',
                    width
                )
            );

            lines.push(
                cardLine(
                    'TAGS',
                    `${UI.brightMagenta}${this.readingTags}${UI.reset}`,
                    'Configured tags',
                    width
                )
            );

            lines.push(boxDivider(width));

            // MACHINE STATUS
            lines.push(sectionTitle('MACHINE STATUS', width));

            if (this.devices.length === 0) {
                lines.push(
                    contentLine(
                        `${UI.gray}No machine connections configured.${UI.reset}`,
                        width
                    )
                );
            } else {
                lines.push(
                    contentLine(
                        `${UI.gray}${pad('DEVICE', 27)}${pad('PROTOCOL', 17)}${pad('STATUS', 17)}${pad('TAGS', 12)}${UI.reset}`,
                        width
                    )
                );

                lines.push(
                    contentLine(
                        `${UI.gray}${'─'.repeat(Math.min(88, width - 10))}${UI.reset}`,
                        width
                    )
                );

                for (const device of this.devices.slice(0, 8)) {
                    const status = device.connected
                        ? `${UI.brightGreen}● ONLINE${UI.reset}`
                        : `${UI.brightYellow}● CONNECTING${UI.reset}`;

                    lines.push(
                        contentLine(
                            `${pad(clean(device.name), 27)}${pad(clean(device.protocol), 17)}${padAnsi(status, 17)}${pad(String(device.tags), 12)}`,
                            width
                        )
                    );
                }

                if (this.devices.length > 8) {
                    lines.push(
                        contentLine(
                            `${UI.gray}+ ${this.devices.length - 8} more machine(s)${UI.reset}`,
                            width
                        )
                    );
                }
            }

            lines.push(boxDivider(width));

            // DATA / DISCOVERY
            const tagStatus = this.readingTags > 0
                ? `${UI.brightGreen}● READING${UI.reset}`
                : `${UI.brightYellow}● WAITING${UI.reset}`;

            lines.push(
                contentLine(
                    `${UI.bold}${UI.brightWhite}DATA ENGINE${UI.reset}    ${tagStatus}    ${UI.gray}${this.readingTags} tags configured for acquisition${UI.reset}`,
                    width
                )
            );

            if (this.discovery.active) {
                lines.push('');
                lines.push(
                    contentLine(
                        `${UI.brightYellow}● NETWORK DISCOVERY${UI.reset}    ${UI.white}${this.discovery.phase}${UI.reset}    ` +
                        `${UI.gray}Scanned: ${this.discovery.scanned}   Active: ${this.discovery.alive}   Devices: ${this.discovery.devices}${UI.reset}`,
                        width
                    )
                );
            }

            lines.push(boxDivider(width));

            // ACTIVITY
            lines.push(sectionTitle('SYSTEM ACTIVITY', width));

            const activity = this.activity.slice(-4);

            for (const message of activity) {
                lines.push(
                    contentLine(
                        `${UI.gray}›${UI.reset} ${message}`,
                        width
                    )
                );
            }

            while (lines.length < 25) {
                lines.push('');
            }

            lines.push(boxDivider(width));

            lines.push(
                contentLine(
                    `${UI.brightCyan}OnlineSCADA${UI.reset}  ${UI.gray}Industrial Cloud SCADA${UI.reset}`,
                    width
                )
            );

            lines.push(
                contentLine(
                    `${UI.gray}Gateway running normally${UI.reset}                         ${UI.gray}Ctrl+C${UI.reset} ${UI.white}Stop Gateway${UI.reset}`,
                    width
                )
            );

            lines.push(boxBottom(width));
            lines.push('');

            process.stdout.write(lines.join('\n'));

            this.lastRefresh = Date.now();
        } catch (err) {
            // UI failure must never stop the gateway.
        }
    }
};

// ═══════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════

function getTerminalWidth() {
    const width = process.stdout.columns || 120;

    // Keep dashboard readable on smaller terminals.
    return Math.max(90, Math.min(width, UI_WIDTH));
}

function stripAnsi(value) {
    return String(value).replace(/\x1b\[[0-9;]*m/g, '');
}

function visibleLength(value) {
    return stripAnsi(value).length;
}

function pad(value, length) {
    const text = String(value);
    const missing = Math.max(0, length - visibleLength(text));
    return text + ' '.repeat(missing);
}

function padAnsi(value, length) {
    return pad(value, length);
}

function clean(value) {
    return String(value || '')
        .replace(/\r/g, '')
        .replace(/\n/g, '')
        .slice(0, 25);
}

function center(value, width) {
    const visible = visibleLength(value);
    const left = Math.max(0, Math.floor((width - visible) / 2));
    return ' '.repeat(left) + value;
}

function boxTop(width) {
    return `${UI.cyan}╔${'═'.repeat(width - 2)}╗${UI.reset}`;
}

function boxBottom(width) {
    return `${UI.cyan}╚${'═'.repeat(width - 2)}╝${UI.reset}`;
}

function boxDivider(width) {
    return `${UI.cyan}╠${'═'.repeat(width - 2)}╣${UI.reset}`;
}

function row(left, right, width) {
    const inner = width - 4;
    const available = inner - visibleLength(left) - visibleLength(right);

    return `${UI.cyan}║${UI.reset}  ${left}${' '.repeat(Math.max(1, available))}${right}  ${UI.cyan}║${UI.reset}`;
}

function contentLine(content, width) {
    const inner = width - 4;
    const clipped = String(content).slice(0, inner);

    return `${UI.cyan}║${UI.reset}  ${clipped}${' '.repeat(Math.max(0, inner - visibleLength(clipped)))}  ${UI.cyan}║${UI.reset}`;
}

function sectionTitle(title, width) {
    return contentLine(
        `${UI.bold}${UI.brightCyan}▸ ${title}${UI.reset}`,
        width
    );
}

function cardLine(title, value, subtitle, width) {
    const left = `${UI.bold}${UI.brightWhite}${title}${UI.reset}`;
    const right = `${value}  ${UI.gray}${subtitle}${UI.reset}`;

    return row(left, right, width);
}

function stateDot(state) {
    if (state === 'ONLINE') return `${UI.brightGreen}●${UI.reset}`;
    if (state === 'DEGRADED') return `${UI.brightYellow}●${UI.reset}`;
    if (state === 'ERROR') return `${UI.brightRed}●${UI.reset}`;
    return `${UI.brightCyan}●${UI.reset}`;
}

function addActivity(message) {
    const text = String(message)
        .replace(/\x1b\[[0-9;]*m/g, '')
        .replace(/\r?\n/g, ' ')
        .trim();

    if (!text) return;

    dashboard.activity.push(text.slice(0, 110));

    if (dashboard.activity.length > 30) {
        dashboard.activity.shift();
    }

    dashboard.draw();
}

function startDashboard() {
    if (dashboard.timer) return;

    dashboard.timer = setInterval(() => {
        updateDashboardState();
        dashboard.draw();
    }, 1000);

    dashboard.draw();
}

function updateDashboardState() {
    if (global.cloudBridge) {
        dashboard.cloud = !!global.cloudBridge.isConnected;
    }

    if (global.healthMonitor) {
        dashboard.health = !!global.healthMonitor.isRunning;
    }

    if (global.plcReader) {
        const status = global.plcReader.getStatus();

        dashboard.devices = status.devices;
        dashboard.totalTags = status.totalTags;
        dashboard.readingTags = status.readingTags;
    }

    if (dashboard.cloud && dashboard.health) {
        dashboard.state = 'ONLINE';
    } else if (dashboard.cloud) {
        dashboard.state = 'DEGRADED';
    } else {
        dashboard.state = 'STARTING';
    }
}

// ═══════════════════════════════════════════════════════════
// LOAD CONFIG
// ═══════════════════════════════════════════════════════════

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error('config.json not found');
    }

    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const config = JSON.parse(raw);

        const required = ['cloudUrl', 'companyId', 'apiKey', 'plcs'];
        const missing = required.filter((k) => !config[k]);

        if (missing.length > 0) {
            throw new Error(
                `config.json is missing required fields: ${missing.join(', ')}`
            );
        }

        return config;
    } catch (err) {
        throw new Error(`Failed to load configuration: ${err.message}`);
    }
}

// ═══════════════════════════════════════════════════════════
// NETWORK DISCOVERY
// ═══════════════════════════════════════════════════════════

async function scanNetwork(options, cloudBridge) {
    const { startIP, endIP } = options;
    let rangesToScan = [];

    if (startIP && endIP) {
        rangesToScan.push({
            start: startIP,
            end: endIP
        });
    } else {
        const interfaces = os.networkInterfaces();

        for (const name of Object.keys(interfaces)) {
            if (
                name.toLowerCase().includes('wsl') ||
                name.toLowerCase().includes('veth')
            ) continue;

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

    rangesToScan = rangesToScan.filter(
        (v, i, a) =>
            a.findIndex(t => t.start === v.start) === i
    );

    if (rangesToScan.length === 0) {
        dashboard.discovery.active = false;
        dashboard.discovery.phase = 'No physical IPv4 networks found';

        await cloudBridge.reportDiscovery(
            'done',
            {
                scannedIPs: 0,
                aliveHosts: 0,
                devices: []
            }
        );

        dashboard.draw();
        return;
    }

    dashboard.discovery.active = true;
    dashboard.discovery.phase = 'SCANNING NETWORK';
    dashboard.discovery.scanned = 0;
    dashboard.discovery.alive = 0;
    dashboard.discovery.devices = 0;

    dashboard.draw();

    await cloudBridge.reportDiscovery(
        'pinging',
        {
            scannedIPs: 0,
            aliveHosts: 0,
            devices: []
        }
    );

    const ipToInt = (ip) =>
        ip.split('.')
            .reduce(
                (acc, octet) =>
                    (acc << 8) + parseInt(octet),
                0
            );

    const intToIp = (int) =>
        `${int >>> 24}.${(int >> 16) & 255}.${(int >> 8) & 255}.${int & 255}`;

    let scanned = 0;
    let alive = 0;

    const devices = [];

    const checkPort = (ip, port) => {
        return new Promise((resolve) => {
            const s = new net.Socket();

            s.setTimeout(500);

            s.on('connect', () => {
                s.destroy();
                resolve(true);
            });

            s.on('timeout', () => {
                s.destroy();
                resolve(false);
            });

            s.on('error', () => {
                s.destroy();
                resolve(false);
            });

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

    for (const range of rangesToScan) {
        const startInt = ipToInt(range.start);
        const endInt = ipToInt(range.end);

        const ipsToScan = [];

        for (let i = startInt; i <= endInt; i++) {
            ipsToScan.push(intToIp(i));
        }

        const BATCH_SIZE = 40;

        for (let i = 0; i < ipsToScan.length; i += BATCH_SIZE) {
            const batch = ipsToScan.slice(i, i + BATCH_SIZE);

            await Promise.all(
                batch.map(async (ip) => {
                    const results = await Promise.all(
                        Object.keys(portsToProtocols).map(
                            async (port) => {
                                const isOpen = await checkPort(
                                    ip,
                                    parseInt(port)
                                );

                                return {
                                    port,
                                    isOpen
                                };
                            }
                        )
                    );

                    scanned++;

                    const openPorts =
                        results.filter(r => r.isOpen);

                    if (openPorts.length > 0) {
                        alive++;

                        for (const { port } of openPorts) {
                            devices.push({
                                ip,
                                port: parseInt(port),
                                protocol: portsToProtocols[port],
                                vendorName: vendorNames[port],
                                verified: true,
                                deepInfo: {
                                    model:
                                        'Identified via Hardware Port Scan'
                                }
                            });
                        }
                    }
                })
            );

            dashboard.discovery.scanned = scanned;
            dashboard.discovery.alive = alive;
            dashboard.discovery.devices = devices.length;

            await cloudBridge.reportDiscovery(
                'probing',
                {
                    scannedIPs: scanned,
                    aliveHosts: alive,
                    devices
                }
            );

            dashboard.draw();
        }
    }

    dashboard.discovery.phase = 'SCAN COMPLETE';
    dashboard.discovery.scanned = scanned;
    dashboard.discovery.alive = alive;
    dashboard.discovery.devices = devices.length;

    await cloudBridge.reportDiscovery(
        'done',
        {
            scannedIPs: scanned,
            aliveHosts: alive,
            devices
        }
    );

    setTimeout(() => {
        dashboard.discovery.active = false;
        dashboard.draw();
    }, 3000);
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

async function main() {

    let config;

    try {
        config = loadConfig();
    } catch (err) {
        process.stdout.write(UI.showCursor);

        console.error('');
        console.error('OnlineSCADA Gateway Error');
        console.error(err.message);
        console.error('');

        process.exit(1);
    }

    const cloudBridge =
        new CloudBridge(config, VERBOSE);

    const plcReader =
        new PLCReader(
            config,
            cloudBridge,
            VERBOSE
        );

    const healthMonitor =
        new HealthMonitor(
            config,
            cloudBridge,
            VERBOSE
        );

    global.cloudBridge = cloudBridge;
    global.plcReader = plcReader;
    global.healthMonitor = healthMonitor;

    // Start dashboard before gateway initialization.
    startDashboard();

    addActivity('Loading OnlineSCADA gateway configuration');

    cloudBridge.onWriteCommand((cmd) => {
        addActivity(
            `Write command received for ${cmd.tagName || 'tag'}`
        );

        plcReader.handleWriteCommand(cmd);
    });

    cloudBridge.onConfigUpdate((payload) => {
        const newPlcs = payload?.plcs;

        if (!Array.isArray(newPlcs)) return;

        addActivity(
            `Cloud configuration update received • ${newPlcs.length} machine(s)`
        );

        config.plcs = newPlcs;

        plcReader
            .reload(newPlcs)
            .catch((err) => {
                addActivity(
                    `Hot reload failed • ${err.message}`
                );
            });
    });

    cloudBridge.onStartDiscovery((options) => {
        addActivity('Network discovery requested by OnlineSCADA');

        scanNetwork(
            options,
            cloudBridge
        ).catch(err => {
            addActivity(
                `Discovery failed • ${err.message}`
            );
        });
    });

    const shutdown = async (signal) => {
        dashboard.state = 'STOPPING';
        dashboard.draw();

        addActivity(
            `Gateway shutdown requested (${signal})`
        );

        healthMonitor.stop();
        plcReader.stopAll();
        cloudBridge.disconnect();

        if (dashboard.timer) {
            clearInterval(dashboard.timer);
            dashboard.timer = null;
        }

        process.stdout.write(UI.showCursor);
        process.stdout.write('\n');

        process.exit(0);
    };

    process.on('SIGINT', () =>
        shutdown('SIGINT')
    );

    process.on('SIGTERM', () =>
        shutdown('SIGTERM')
    );

    process.on(
        'uncaughtException',
        (err) => {
            addActivity(
                `Gateway error • ${err.message}`
            );

            console.error(err);
        }
    );

    process.on(
        'unhandledRejection',
        (err) => {
            addActivity(
                `Unhandled gateway error • ${err?.message || err}`
            );

            console.error(err);
        }
    );

    addActivity('Connecting to OnlineSCADA cloud');

    await cloudBridge.connect();

    if (cloudBridge.isConnected) {
        addActivity(
            'Secure cloud connection established'
        );
    } else {
        addActivity(
            'Cloud connection pending — automatic reconnection enabled'
        );
    }

    addActivity(
        'Starting industrial machine protocol readers'
    );

    await plcReader.startAll();

    addActivity(
        `${config.plcs?.length || 0} machine connection(s) initialized`
    );

    addActivity(
        'Starting gateway diagnostic monitor'
    );

    healthMonitor.start();

    addActivity(
        'OnlineSCADA Edge Gateway is ready'
    );

    updateDashboardState();
    dashboard.draw();
}

main().catch((err) => {

    process.stdout.write(UI.showCursor);

    console.error('');
    console.error(
        '[OnlineSCADA] Fatal gateway error:',
        err.message
    );
    console.error('');

    process.exit(1);
});