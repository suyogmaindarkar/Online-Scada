// ═══════════════════════════════════════════════════════════
// Cloud Bridge — Secure Socket.io Tunnel Client
// ═══════════════════════════════════════════════════════════

const { io } = require('socket.io-client');
const os = require('os');

class CloudBridge {
    constructor(config, verbose = false) {
        this.config = config;
        this.socket = null;
        this.isConnected = false;
    }

    connect() {
        return new Promise((resolve) => {
            let baseUrl = (this.config.cloudUrl || 'https://onlinescada-api.onrender.com').replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/$/, '');
            this.socket = io(`${baseUrl}/edge`, { auth: { apiKey: this.config.apiKey, companyId: this.config.companyId }, transports: ['websocket', 'polling'] });

            this.socket.on('connect', () => { this.isConnected = true; resolve(); });
            this.socket.on('connect_error', () => { this.isConnected = false; resolve(); });

            this.socket.on('edge:writeCommand', (data) => { if (this.writeCallback) this.writeCallback(data); });
            this.socket.on('edge:configUpdate', (data) => { if (this.configCallback && Array.isArray(data?.plcs)) this.configCallback(data); });
            this.socket.on('edge:startDiscovery', (options) => { if (this.discoveryCallback) this.discoveryCallback(options); });

            setTimeout(() => resolve(), 4000);
        });
    }

    sendTagValues(tags) { if (this.isConnected) this.socket.emit('edge:tagValues', { tags }); }
    sendHeartbeat(stats) { if (this.isConnected) this.socket.emit('edge:heartbeat', { ...stats, hostname: os.hostname(), os: os.type() }); }
    reportDiscovery(phase, results) { if (this.isConnected) this.socket.emit('edge:discoveryReport', { companyId: this.config.companyId, apiKey: this.config.apiKey, phase, results }); }

    onWriteCommand(cb) { this.writeCallback = cb; }
    onConfigUpdate(cb) { this.configCallback = cb; }
    onStartDiscovery(cb) { this.discoveryCallback = cb; }
    disconnect() { if (this.socket) this.socket.disconnect(); this.isConnected = false; }
}

module.exports = CloudBridge;x